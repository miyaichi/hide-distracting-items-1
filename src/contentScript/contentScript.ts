import { DomainSettings, ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { ElementFinder } from '../utils/elementFinder';
import { StorageManager } from '../utils/storageManager';

class ContentScript {
  private static instance: ContentScript | null = null;
  private readonly connection: ConnectionManager;
  private isSelectionMode = false;
  private hoveredElement: Element | null = null;
  private currentDomain: string;

  private constructor() {
    console.log('[contentScript] Content script instance created');
    this.connection = new ConnectionManager();
    this.currentDomain = new URL(window.location.href).hostname;

    this.injectStyles();
    this.setupMessageListeners();
    this.setupEventListeners();
    this.notifyDomain();
  }

  public static getInstance(): ContentScript {
    if (!ContentScript.instance) {
      console.log('[contentScript] Creating new ContentScript instance');
      ContentScript.instance = new ContentScript();
    } else {
      console.log('[contentScript] Returning existing ContentScript instance');
    }
    return ContentScript.instance;
  }

  public static isInstantiated(): boolean {
    return !!ContentScript.instance;
  }

  public reinitialize(): void {
    console.log('[contentScript] Reinitializing content script');
    this.currentDomain = new URL(window.location.href).hostname;
    this.notifyDomain();
    this.loadSavedSettings();
  }

  private notifyDomain() {
    this.connection.sendMessage('background', {
      type: 'DOMAIN_INFO',
      payload: {
        domain: this.currentDomain,
        url: window.location.href,
      },
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

  private setupMessageListeners() {
    this.disconnectExistingConnection();
    const port = this.connection.connect('content-script');
    console.log('[contentScript] Content script connected to background');

    port.onMessage.addListener(async (message) => {
      console.log('[contentScript] Content script received message:', message);

      switch (message.type) {
        case 'INITIALIZE_CONTENT':
          await this.handleInitialization(message.payload.domain);
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
    console.log('[contentScript] Handling initialization for domain:', domain);
    if (this.currentDomain !== domain) {
      this.currentDomain = domain;
      await this.loadSavedSettings();
    } else {
      console.log('[contentScript] Domain unchanged, skipping initialization');
    }
  }

  private async loadSavedSettings() {
    try {
      const settings: DomainSettings = await StorageManager.getDomainSettings(this.currentDomain);
      console.log('[contentScript] Loaded settings:', settings);

      this.showAllElements();
      this.applyHiddenElements(settings.hiddenElements);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private applyHiddenElements(hiddenElements: ElementIdentifier[]) {
    if (hiddenElements && hiddenElements.length > 0) {
      hiddenElements.forEach((identifier) => {
        this.hideElement(identifier);
      });
    }
  }

  private hideElement(identifier: ElementIdentifier) {
    console.log('[contentScript] Hiding element:', identifier);
    const element = this.findElement(identifier);
    if (element) {
      element.classList.add('hde-hidden');
      console.log('[contentScript] Element hidden successfully');
    } else {
      console.error('Failed to find element to hide:', identifier);
    }
  }

  private showElement(identifier: ElementIdentifier) {
    console.log('[contentScript] Showing element:', identifier);
    const element = this.findElement(identifier);
    if (element) {
      element.classList.remove('hde-hidden');
      console.log('[contentScript] Element shown successfully');
    } else {
      console.error('Failed to find element to show:', identifier);
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

    console.log('[contentScript] Selection mode state:', {
      isSelectionMode: this.isSelectionMode,
      hasSelectionModeClass: document.documentElement.classList.contains('hde-selection-mode'),
      cursor: window.getComputedStyle(document.body).cursor,
      htmlCursor: window.getComputedStyle(document.documentElement).cursor,
    });
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
    console.log('[contentScript] Element selected:', identifier);

    this.connection.sendMessage('background', {
      type: 'ELEMENT_SELECTED',
      payload: {
        identifier,
        domain: this.currentDomain,
      },
    });

    target.classList.add('hde-hidden');
  }

  private disconnectExistingConnection() {
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch (e) {
        console.warn('Error disconnecting existing connection:', e);
      }
    }
  }

  private findElement(identifier: ElementIdentifier): Element | null {
    let element: Element | null = null;

    try {
      element = document.querySelector(identifier.domPath);
    } catch (e) {
      console.log('[contentScript] Failed to find element by domPath:', e);
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

// グローバルスコープでの初期化チェック
if (!window.hasOwnProperty('hideDistractingElementsInitialized')) {
  console.log('[contentScript] Content script loading for the first time...');
  // @ts-ignore
  window.hideDistractingElementsInitialized = true;
  const contentScript = ContentScript.getInstance();
} else {
  console.log('[contentScript] Content script already initialized, reinitializing...');
  if (ContentScript.isInstantiated()) {
    const instance = ContentScript.getInstance();
    instance.reinitialize();
  }
}
