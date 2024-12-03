import { MessageHandler, MessagePayloads } from '../types/messages';
import { DomainSettings, ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { ElementFinder } from '../utils/elementFinder';
import { Logger } from '../utils/logger';
import { StorageManager } from '../utils/storageManager';

class ContentScript {
  private connectionManager: ConnectionManager | null = null;
  private logger: Logger;
  private isSelectionMode = false;
  private hoveredElement: Element | null = null;
  private currentDomain: string | null = null;

  constructor() {
    this.logger = new Logger('content-script');
    this.initialize();

    this.injectStyles();
    this.setupCurrentDomain();
    this.setupEventListeners();
  }

  private async initialize() {
    try {
      // Listen for PING messages
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'PING') return true;
      });

      // Get activeTabInfo from storage
      const { activeTabInfo } = await chrome.storage.local.get('activeTabInfo');

      if (activeTabInfo?.isScriptInjectionAllowed) {
        this.setupConnection(activeTabInfo.tabId);
      } else {
        this.logger.debug('Script injection not allowed for this tab');
      }

      // Listen for storage changes
      chrome.storage.local.onChanged.addListener((changes) => {
        const oldTabId = changes.activeTabInfo?.oldValue?.tabId;
        const newTabId = changes.activeTabInfo?.newValue?.tabId;
        const isAllowed = changes.activeTabInfo?.newValue?.isScriptInjectionAllowed;

        if (newTabId && newTabId !== oldTabId && isAllowed) {
          this.setupConnection(newTabId);
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize content script:', error);
    }
  }

  private setupConnection(tabId: number) {
    if (this.connectionManager) {
      this.logger.debug('Connection already established');
      return;
    }

    try {
      this.logger.debug('Setting up connection', { tabId });
      this.connectionManager = new ConnectionManager(`content-${tabId}`, this.handleMessage);
      this.connectionManager.connect();
      this.logger.debug('Connection established', { tabId });
    } catch (error) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private handleMessage: MessageHandler = (message) => {
    this.logger.debug('Message received', { type: message.type });

    switch (message.type) {
      case 'SIDEPANEL_CLOSED':
        this.logger.debug('Sidepanel closed, performing cleanup');
        this.performCleanup();
        break;
      // Implement other message handling here ...
      case 'INITIALIZE_CONTENT':
        this.initialization();
        break;
      case 'RESTORE_HIDDEN_ELEMENTS':
        this.restoreHiddenElements();
        break;
      case 'UNHIDE_ELEMENT':
        const unhideElementPayload = message.payload as MessagePayloads['UNHIDE_ELEMENT'];
        this.unhideElement(unhideElementPayload.identifier);
        break;
      case 'TOGGLE_SELECTION_MODE':
        const togglePayload = message.payload as MessagePayloads['TOGGLE_SELECTION_MODE'];
        this.toggleSelectionMode(togglePayload.enabled);
        break;
    }
  };

  private performCleanup() {
    this.logger.debug('Starting cleanup');
    // Implement cleanup logic here ...
    this.toggleSelectionMode(false);
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

  // Domain setup
  private setupCurrentDomain() {
    this.currentDomain = new URL(window.location.href).hostname;
    this.logger.debug('Current domain:', this.currentDomain);
  }

  // Content initialization
  private async initialization() {
    this.setupCurrentDomain();

    this.logger.debug('Initializing content script for domain:', this.currentDomain);
    await this.loadAndApplySettings();
  }

  private async loadAndApplySettings() {
    try {
      if (!this.currentDomain) {
        this.logger.warn('Current domain not set');
        return;
      }

      const settings: DomainSettings = await StorageManager.getDomainSettings(this.currentDomain);
      this.logger.debug('Loaded settings:', settings);

      this.restoreHiddenElements();
      const applyed = this.applyHiddenElements(settings.hiddenElements);
      this.logger.debug(`Applied hidden settings to ${applyed} elements`);
    } catch (error) {
      this.logger.error('Error loading settings:', error);
    }
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

  // Toggle selection mode
  private toggleSelectionMode(enabled: boolean) {
    if (this.isSelectionMode === enabled) return;

    this.cleanupSelectionMode();
    this.isSelectionMode = enabled;

    if (enabled) {
      this.enableSelectionMode();
    } else {
      this.disableSelectionMode();
    }

    this.logger.debug('Selection mode toggled', { enabled });
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

    this.logger.log('Element selected:', identifier);
    this.connectionManager?.sendMessage('sidepanel', {
      type: 'ELEMENT_HIDDEN',
      payload: { domain: this.currentDomain, identifier },
    });

    target.classList.add('hde-hidden');
  }

  // Utility functions
  private restoreHiddenElements() {
    const hiddenElements = document.getElementsByClassName('hde-hidden');
    Array.from(hiddenElements).forEach((element) => {
      element.classList.remove('hde-hidden');
    });
  }

  private unhideElement(identifier: ElementIdentifier) {
    this.logger.debug('Showing element:', identifier);
    const element = this.findElement(identifier);
    if (element) {
      element.classList.remove('hde-hidden');
      this.logger.debug('Element shown successfully');
    } else {
      this.logger.warn('Failed to find element to show:', identifier);
    }
  }

  private hideElement(identifier: ElementIdentifier): boolean {
    this.logger.debug('Hiding element:', identifier);
    const element = this.findElement(identifier);
    if (element) {
      element.classList.add('hde-hidden');
      this.logger.debug('Element hidden successfully');
      return true;
    } else {
      this.logger.warn('Failed to find element to hide:', identifier);
      return false;
    }
  }

  private findElement(identifier: ElementIdentifier): Element | null {
    let element: Element | null = null;

    try {
      element = document.querySelector(identifier.domPath);
    } catch (e) {
      this.logger.debug('Failed to find element by domPath:', e);
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

// Initialize content script
if (!window.contentScriptInitialized) {
  window.contentScriptInitialized = true;
  new ContentScript();
}
