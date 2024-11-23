// src/contentScript/contentScript.ts
import { ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { ElementFinder } from '../utils/elementFinder';
import { StorageManager } from '../utils/storageManager';

class ContentScript {
  private connection: ConnectionManager;
  private isSelectionMode = false;
  private hoveredElement: Element | null = null;
  private currentDomain: string;

  constructor() {
    console.log('Content script initialized');
    this.connection = new ConnectionManager();
    this.currentDomain = new URL(window.location.href).hostname;
    console.log('Current domain:', this.currentDomain);

    this.injectStyles();
    this.setupMessageListeners();
    this.setupEventListeners();
    this.loadSavedSettings();

    // ドメイン情報をサイドパネルに送信
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
      style.textContent = `
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
      document.head.appendChild(style);
    }
  }

  private async loadSavedSettings() {
    try {
      const settings = await StorageManager.getDomainSettings(this.currentDomain);
      console.log('Loaded settings:', settings);

      if (settings.hiddenElements && settings.hiddenElements.length > 0) {
        settings.hiddenElements.forEach((identifier) => {
          this.hideElement(identifier);
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private hideElement(identifier: ElementIdentifier) {
    console.log('Hiding element:', identifier);
    try {
      let element: Element | null = null;

      try {
        element = document.querySelector(identifier.domPath);
      } catch (e) {
        console.log('Failed to find element by domPath:', e);
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

      if (element) {
        element.classList.add('hde-hidden');
        console.log('Element hidden successfully');
      }
    } catch (error) {
      console.error('Error hiding element:', error);
    }
  }

  private showElement(identifier: ElementIdentifier) {
    console.log('Showing element:', identifier);
    try {
      let element: Element | null = null;

      try {
        element = document.querySelector(identifier.domPath);
      } catch (e) {
        console.log('Failed to find element by domPath:', e);
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

      if (element) {
        element.classList.remove('hde-hidden');
        console.log('Element shown successfully');
      }
    } catch (error) {
      console.error('Error showing element:', error);
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

    port.onMessage.addListener((message) => {
      console.log('Content script received message:', message);
      switch (message.type) {
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

  private toggleSelectionMode(enabled: boolean) {
    console.log('Selection mode toggled:', enabled);

    // 既存のモードをクリーンアップ
    if (this.isSelectionMode) {
      document.documentElement.classList.remove('hde-selection-mode');
      document.body.classList.remove('hde-selection-mode');
      if (this.hoveredElement) {
        this.hoveredElement.classList.remove('hde-highlight');
        this.hoveredElement = null;
      }
    }

    // 新しいモードを設定
    this.isSelectionMode = enabled;

    if (enabled) {
      document.documentElement.classList.add('hde-selection-mode');
      document.body.classList.add('hde-selection-mode');

      // 直接スタイルも適用
      document.documentElement.style.setProperty('cursor', 'crosshair', 'important');
      document.body.style.setProperty('cursor', 'crosshair', 'important');
    } else {
      document.documentElement.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
    }

    // 状態をログ出力
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
      const target = e.target as Element;
      this.highlightElement(target);
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!this.isSelectionMode || !this.hoveredElement) return;
      const target = e.target as Element;
      if (target === this.hoveredElement) {
        target.classList.remove('hde-highlight');
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

    // cleanup関数を返す
    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }
}

// シングルトンインスタンスを作成
console.log('Content script loading...');
const contentScript = new ContentScript();
