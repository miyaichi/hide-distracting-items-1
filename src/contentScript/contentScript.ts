import {
  ContentActionMessage,
  DomainInfoMessage,
  DomainSettings,
  ElementIdentifier,
  ElementSelectedMessage,
  Message,
} from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { createContentScriptName } from '../utils/connectionTypes';
import { ElementFinder } from '../utils/elementFinder';
import { Logger } from '../utils/logger';
import { StorageManager } from '../utils/storageManager';

const logger = new Logger('ContentScript');

class ContentScript {
  private static instance: ContentScript | null = null;
  private connection: ConnectionManager;
  private isSelectionMode = false;
  private hoveredElement: Element | null = null;
  private currentDomain: string;

  private constructor() {
    logger.log('Content script instance created');
    this.connection = new ConnectionManager();
    this.currentDomain = new URL(window.location.href).hostname;

    this.injectStyles();
    this.setupMessageListeners();
    this.setupEventListeners();
    this.notifyDomain();
  }

  public static getInstance(): ContentScript {
    if (!ContentScript.instance) {
      ContentScript.instance = new ContentScript();
      logger.debug('Created new ContentScript instance');
    } else {
      logger.debug('Returning existing ContentScript instance');
    }
    return ContentScript.instance;
  }

  public static isInstantiated(): boolean {
    return !!ContentScript.instance;
  }

  public reinitialize(): void {
    logger.log('Reinitializing content script');
    this.currentDomain = new URL(window.location.href).hostname;
    this.notifyDomain();
    this.loadSavedSettings();
  }

  private notifyDomain() {
    logger.debug('Notifying domain info:', this.currentDomain);
    this.connection.sendMessage<DomainInfoMessage>('background', {
      type: 'DOMAIN_INFO',
      domain: this.currentDomain,
      url: window.location.href,
    });
  }

  private injectStyles() {
    if (!document.getElementById('hde-styles')) {
      const style = document.createElement('style');
      style.id = 'hde-styles';
      style.textContent = this.getInjectedStyles();
      document.head.appendChild(style);
    }
  }

  private getInjectedStyles(): string {
    return `
      .hde-selection-mode,
      .hde-selection-mode * {
        cursor: crosshair !important;
      }
      
      .hde-highlight {
        outline: 2px dashed #3b82f6 !important;
        outline-offset: 2px;
        background-color: rgba(59, 130, 246, 0.1) !important;
      }
      
      .hde-hidden {
        display: none !important;
      }

      html.hde-selection-mode,
      html.hde-selection-mode body,
      html.hde-selection-mode * {
        cursor: crosshair !important;
      }
    `;
  }

  private async setupMessageListeners() {
    this.disconnectExistingConnection();

    const tabId = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
    this.connection = new ConnectionManager();
    const port = this.connection.connect(createContentScriptName(tabId));

    port.onMessage.addListener(async (message: Message) => {
      logger.debug(`Processing message type: ${message.type}`);

      switch (message.type) {
        case 'INITIALIZE_CONTENT':
          await this.handleInitialization(message.domain);
          break;
        case 'TOGGLE_SELECTION_MODE':
          this.toggleSelectionMode(message.enabled);
          break;
        case 'HIDE_ELEMENT':
          this.hideElement(message.identifier);
          break;
        case 'SHOW_ELEMENT':
          this.showElement(message.identifier);
          break;
        case 'CLEAR_ALL':
          this.showAllElements();
          break;
      }
    });
  }

  private async handleInitialization(domain: string) {
    logger.debug('Handling initialization for domain:', domain);
    if (this.currentDomain !== domain) {
      this.currentDomain = domain;
      await this.loadSavedSettings();
    }
  }

  private async loadSavedSettings() {
    try {
      const settings: DomainSettings = await StorageManager.getDomainSettings(this.currentDomain);
      logger.debug('Loaded settings:', settings);

      this.showAllElements();
      const rules = settings.hiddenElements.length;
      const applyed = this.applyHiddenElements(settings.hiddenElements);
      logger.debug(`Applied ${applyed} / ${rules} rules`);
      this.NotifyApplyRules(rules, applyed);
    } catch (error) {
      logger.error('Error loading settings:', error);
    }
  }

  private NotifyApplyRules(rules: number, applyed: number) {
    this.connection.sendMessage<ContentActionMessage>('background', {
      type: 'CONTENT_ACTION',
      action: {
        action: 'APPLY_RULES',
        rules,
        applyed,
      },
    });
  }

  private applyHiddenElements(hiddenElements: ElementIdentifier[]): number {
    let applyed = 0;
    if (hiddenElements && hiddenElements.length > 0) {
      hiddenElements.forEach((identifier) => {
        if (this.hideElement(identifier)) {
          applyed++;
        }
      });
    }
    return applyed;
  }

  private hideElement(identifier: ElementIdentifier): boolean {
    logger.debug('Hiding element:', identifier);
    const element = this.findElement(identifier);
    if (element) {
      element.classList.add('hde-hidden');
      logger.debug('Element hidden successfully');
      return true;
    } else {
      logger.warn('Failed to find element to hide:', identifier);
      return false;
    }
  }

  private showElement(identifier: ElementIdentifier) {
    logger.debug('Showing element:', identifier);
    const element = this.findElement(identifier);
    if (element) {
      element.classList.remove('hde-hidden');
      logger.debug('Element shown successfully');
    } else {
      logger.warn('Failed to find element to show:', identifier);
    }
  }

  private showAllElements() {
    const hiddenElements = document.getElementsByClassName('hde-hidden');
    Array.from(hiddenElements).forEach((element) => {
      element.classList.remove('hde-hidden');
    });
  }

  private toggleSelectionMode(enabled: boolean) {
    if (this.isSelectionMode === enabled) return;

    this.cleanupSelectionMode();
    this.isSelectionMode = enabled;

    if (enabled) {
      this.enableSelectionMode();
    } else {
      this.disableSelectionMode();
    }

    if (enabled) {
      logger.debug('Selection mode enabled');
    } else {
      logger.debug('Selection mode disabled');
    }
  }

  private cleanupSelectionMode() {
    if (this.isSelectionMode) {
      document.documentElement.classList.remove('hde-selection-mode');
      document.body.classList.remove('hde-selection-mode');
      if (this.hoveredElement) {
        this.hoveredElement.classList.remove('hde-highlight');
        this.hoveredElement = null;
      }
    }
  }

  private enableSelectionMode() {
    document.documentElement.classList.add('hde-selection-mode');
    document.body.classList.add('hde-selection-mode');
    document.documentElement.style.setProperty('cursor', 'crosshair', 'important');
    document.body.style.setProperty('cursor', 'crosshair', 'important');
  }

  private disableSelectionMode() {
    document.documentElement.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');
  }

  private highlightElement(element: Element) {
    if (!this.isSelectionMode) return;

    if (this.hoveredElement && this.hoveredElement !== element) {
      this.hoveredElement.classList.remove('hde-highlight');
    }

    this.hoveredElement = element;
    element.classList.add('hde-highlight');
  }

  private setupEventListeners() {
    const handleMouseOver = (e: MouseEvent) => this.handleMouseOver(e);
    const handleMouseOut = (e: MouseEvent) => this.handleMouseOut(e);
    const handleClick = (e: MouseEvent) => this.handleClick(e);

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }

  private handleMouseOver(e: MouseEvent) {
    if (!this.isSelectionMode) return;
    const target = e.target as Element;
    this.highlightElement(target);
  }

  private handleMouseOut(e: MouseEvent) {
    if (!this.isSelectionMode || !this.hoveredElement) return;
    const target = e.target as Element;
    if (target === this.hoveredElement) {
      target.classList.remove('hde-highlight');
      this.hoveredElement = null;
    }
  }

  private handleClick(e: MouseEvent) {
    if (!this.isSelectionMode) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as Element;
    const identifier = ElementFinder.getElementIdentifier(target);

    logger.log('Element selected:', identifier);
    this.connection.sendMessage<ElementSelectedMessage>('background', {
      type: 'ELEMENT_SELECTED',
      domain: this.currentDomain,
      identifier,
    });

    target.classList.add('hde-hidden');
  }

  private disconnectExistingConnection() {
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch (e) {
        logger.warn('Error disconnecting existing connection:', e);
      }
    }
  }

  private findElement(identifier: ElementIdentifier): Element | null {
    let element: Element | null = null;

    try {
      element = document.querySelector(identifier.domPath);
    } catch (e) {
      logger.debug('Failed to find element by domPath:', e);
    }

    if (!element) {
      const elements = document.getElementsByTagName(identifier.tagName);
      for (const el of Array.from(elements)) {
        if (
          identifier.classNames.every((className) => el.classList.contains(className)) &&
          (!identifier.id || el.id === identifier.id)
        ) {
          element = el;
          break;
        }
      }
    }

    return element;
  }
}

// Check if the content script has already been initialized
if (!window.hasOwnProperty('hideDistractingElementsInitialized')) {
  logger.log('Content script loading for the first time...');
  // @ts-ignore
  window.hideDistractingElementsInitialized = true;
  const contentScript = ContentScript.getInstance();
} else {
  logger.log('Content script already initialized, reinitializing...');
  if (ContentScript.isInstantiated()) {
    const instance = ContentScript.getInstance();
    instance.reinitialize();
  }
}
