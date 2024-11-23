// src/contentScript/contentScript.ts
import { ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { ElementFinder } from '../utils/elementFinder';
import { StorageManager } from '../utils/storageManager';

interface MessagePayload {
  type: string;
  enabled?: boolean;
  identifier?: ElementIdentifier;
}

interface StyleDefinitions {
  [key: string]: string;
}

class ContentScript {
  private readonly connection: ConnectionManager;
  private readonly currentDomain: string;
  private isSelectionMode = false;
  private hoveredElement: Element | null = null;

  // スタイル定義
  private static readonly STYLES: StyleDefinitions = {
    selectionMode: `
      .hde-selection-mode,
      .hde-selection-mode *,
      html.hde-selection-mode,
      html.hde-selection-mode body,
      html.hde-selection-mode * {
        cursor: crosshair !important;
      }
    `,
    highlight: `
      .hde-highlight {
        outline: 2px dashed #3b82f6 !important;
        outline-offset: 2px;
        background-color: rgba(59, 130, 246, 0.1) !important;
      }
    `,
    hidden: `
      .hde-hidden {
        display: none !important;
      }
    `,
  };

  constructor() {
    console.log('Content script loading...');
    this.connection = new ConnectionManager();
    this.currentDomain = new URL(window.location.href).hostname;

    this.initialize();
  }

  private async initialize() {
    console.log('Content script initialized');
    console.log('Current domain:', this.currentDomain);

    this.injectStyles();
    this.setupMessageListeners();
    this.setupEventListeners();
    await this.loadSavedSettings();
    this.notifyDomain();
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
      style.textContent = Object.values(ContentScript.STYLES).join('\n');
      document.head.appendChild(style);
    }
  }

  private async loadSavedSettings() {
    try {
      const settings = await StorageManager.getDomainSettings(this.currentDomain);
      console.log('Loaded settings:', settings);

      settings.hiddenElements?.forEach((identifier) => this.hideElement(identifier));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private findElement(identifier: ElementIdentifier): Element | null {
    try {
      // まずdomPathで検索
      let element = document.querySelector(identifier.domPath);
      if (element) return element;

      // 代替の検索方法
      const elements = document.getElementsByTagName(identifier.tagName);
      return (
        Array.from(elements).find(
          (el) =>
            identifier.classNames.every((className) => el.classList.contains(className)) &&
            (!identifier.id || el.id === identifier.id)
        ) || null
      );
    } catch (error) {
      console.error('Error finding element:', error);
      return null;
    }
  }

  private hideElement(identifier: ElementIdentifier) {
    console.log('Hiding element:', identifier);
    const element = this.findElement(identifier);

    if (element) {
      element.classList.add('hde-hidden');
      console.log('Element hidden successfully');
    }
  }

  private showElement(identifier: ElementIdentifier) {
    console.log('Showing element:', identifier);
    const element = this.findElement(identifier);

    if (element) {
      element.classList.remove('hde-hidden');
      console.log('Element shown successfully');
    }
  }

  private showAllElements() {
    const hiddenElements = document.getElementsByClassName('hde-hidden');
    Array.from(hiddenElements).forEach((element) => {
      element.classList.remove('hde-hidden');
    });
  }

  private setupMessageListeners() {
    const port = this.connection.connect('content-script');
    console.log('Content script connected to background');

    port.onMessage.addListener((message: MessagePayload) => {
      console.log('Content script received message:', message);
      this.handleMessage(message);
    });
  }

  private handleMessage(message: MessagePayload) {
    switch (message.type) {
      case 'TOGGLE_SELECTION_MODE':
        this.toggleSelectionMode(message.enabled || false);
        break;
      case 'HIDE_ELEMENT':
        message.identifier && this.hideElement(message.identifier);
        break;
      case 'SHOW_ELEMENT':
        message.identifier && this.showElement(message.identifier);
        break;
      case 'CLEAR_ALL':
        this.showAllElements();
        break;
    }
  }

  private toggleSelectionMode(enabled: boolean) {
    console.log('Selection mode toggled:', enabled);

    this.cleanupSelectionMode();
    this.isSelectionMode = enabled;
    this.applySelectionMode(enabled);

    this.logSelectionModeState();
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

  private applySelectionMode(enabled: boolean) {
    if (enabled) {
      document.documentElement.classList.add('hde-selection-mode');
      document.body.classList.add('hde-selection-mode');
      document.documentElement.style.setProperty('cursor', 'crosshair', 'important');
      document.body.style.setProperty('cursor', 'crosshair', 'important');
    } else {
      document.documentElement.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
    }
  }

  private logSelectionModeState() {
    console.log('Selection mode state:', {
      isSelectionMode: this.isSelectionMode,
      hasSelectionModeClass: document.documentElement.classList.contains('hde-selection-mode'),
      cursor: window.getComputedStyle(document.body).cursor,
      htmlCursor: window.getComputedStyle(document.documentElement).cursor,
    });
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
    const handleMouseOver = (e: MouseEvent) => {
      if (!this.isSelectionMode) return;
      this.highlightElement(e.target as Element);
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!this.isSelectionMode || !this.hoveredElement) return;
      if (e.target === this.hoveredElement) {
        this.hoveredElement.classList.remove('hde-highlight');
        this.hoveredElement = null;
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!this.isSelectionMode) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;
      const identifier = ElementFinder.getElementIdentifier(target);
      console.log('Element selected:', identifier);

      this.connection.sendMessage('background', {
        type: 'ELEMENT_SELECTED',
        payload: {
          identifier,
          domain: this.currentDomain,
        },
      });

      target.classList.add('hde-hidden');
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }
}

// シングルトンインスタンスを作成
const contentScript = new ContentScript();
