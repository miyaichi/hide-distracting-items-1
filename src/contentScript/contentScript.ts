// src/contentScript/contentScript.ts
import { ConnectionManager } from '../utils/connectionManager';
import { ElementFinder } from '../utils/elementFinder';

class ContentScript {
  private connection: ConnectionManager;
  private isSelectionMode = false;
  private hoveredElement: Element | null = null;

  constructor() {
    console.log('Content script initialized');
    this.connection = new ConnectionManager();
    this.setupMessageListeners();
    this.setupEventListeners();
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
      }
    });
  }

  private setupEventListeners() {
    document.addEventListener('mouseover', (e) => {
      if (!this.isSelectionMode) return;
      const target = e.target as Element;
      this.highlightElement(target);
    });

    document.addEventListener('click', (e) => {
      if (!this.isSelectionMode) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;
      const identifier = ElementFinder.getElementIdentifier(target);
      console.log('Element selected:', identifier);

      this.connection.sendMessage('background', {
        type: 'ELEMENT_SELECTED',
        identifier,
      });
    });
  }

  private toggleSelectionMode(enabled: boolean) {
    console.log('Selection mode toggled:', enabled);
    this.isSelectionMode = enabled;
    document.body.style.cursor = enabled ? 'crosshair' : 'default';
  }

  private highlightElement(element: Element) {
    if (this.hoveredElement) {
      this.hoveredElement.classList.remove('hde-highlight');
    }
    this.hoveredElement = element;
    element.classList.add('hde-highlight');
  }

  private hideElement(identifier: any) {
    console.log('Hiding element:', identifier);
    // Implementation for hiding elements based on identifier
  }
}

console.log('Content script loading...');
new ContentScript();
