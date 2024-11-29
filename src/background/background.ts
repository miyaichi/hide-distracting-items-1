import {
  ConnectionName,
  ContentActionMessage,
  DomainInfoMessage,
  ElementActionMessage,
  Message,
} from '../types/types';
import { Logger } from '../utils/logger';

interface Connection {
  name: ConnectionName;
  port: chrome.runtime.Port;
}

interface DomainInfo {
  domain: string;
  url: string;
}

const logger = new Logger('Background');

class BackgroundService {
  private static instance: BackgroundService;
  private readonly connections: Map<ConnectionName, Connection>;
  private currentDomain: string | null;
  private activeTabId: number | null;

  private constructor() {
    this.connections = new Map();
    this.currentDomain = null;
    this.activeTabId = null;
    this.initialize();
  }

  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  // Initialize
  private async initialize(): Promise<void> {
    this.setupInstallListener();
    this.setupConnectionListener();
    this.setupTabListeners();
    this.setupWindowListeners();
    await this.initializeSidePanel();
    await this.initializeActiveTab();
  }

  private setupInstallListener(): void {
    chrome.runtime.onInstalled.addListener(() => {
      logger.log('Extension installed');
      this.connections.clear();
    });
  }

  private setupConnectionListener(): void {
    chrome.runtime.onConnect.addListener(this.handlePortConnection.bind(this));
  }

  private setupTabListeners(): void {
    chrome.tabs.onActivated.addListener(async ({ tabId }) => {
      logger.debug('Tab activated:', tabId);
      this.activeTabId = tabId;
      await this.handleTabChange(tabId);
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (tabId === this.activeTabId && changeInfo.status === 'complete') {
        logger.debug('Tab updated:', tabId);
        await this.handleTabChange(tabId);
      }
    });
  }

  private setupWindowListeners(): void {
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        logger.debug('Window focus changed:', windowId);
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab?.id) {
          this.activeTabId = tab.id;
          await this.handleTabChange(tab.id);
        }
      }
    });
  }

  private async handleTabChange(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const url = new URL(tab.url);
        await this.updateDomainInfo({ domain: url.hostname, url: tab.url });
      }
    } catch (error) {
      logger.error('Failed to handle tab change:', error);
    }
  }

  private async updateDomainInfo(domainInfo: DomainInfo): Promise<void> {
    logger.log('Updating domain info:', domainInfo);
    this.currentDomain = domainInfo.domain;

    // Initialize ContentScript
    if (this.activeTabId) {
      const contentScriptConnection = this.connections.get('content-script');
      if (contentScriptConnection) {
        this.sendMessage<Message>(contentScriptConnection.port, {
          type: 'INITIALIZE_CONTENT',
          target: 'content-script',
          domain: domainInfo.domain,
        });
      }
    }

    // Notify SidePanel
    const sidepanelConnection = this.connections.get('sidepanel');
    if (sidepanelConnection) {
      this.sendMessage<DomainInfoMessage>(sidepanelConnection.port, {
        type: 'DOMAIN_INFO',
        target: 'sidepanel',
        domain: domainInfo.domain,
        url: domainInfo.url,
      });
    }
  }

  private async initializeSidePanel(): Promise<void> {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      logger.error('Failed to set panel behavior:', error);
    }
  }

  // Connection handling
  private handlePortConnection(port: chrome.runtime.Port): void {
    logger.debug('New connection:', port.name);
    const name = port.name as ConnectionName;
    this.updateConnection(name, port);
    this.setupMessageListener(port);
    this.setupDisconnectListener(name, port);
    this.initializeConnection(name, port);
  }

  private updateConnection(name: ConnectionName, port: chrome.runtime.Port): void {
    const existingConnection = this.connections.get(name);
    if (existingConnection) {
      logger.debug('Updating existing connection:', name);
      existingConnection.port.disconnect();
    }
    this.connections.set(name, { name, port });
  }

  private setupMessageListener(port: chrome.runtime.Port): void {
    port.onMessage.addListener((message: Message) => {
      logger.debug(`Processing message type: ${message.type}`);

      this.handleMessage(port.name as ConnectionName, message);
    });
  }

  private setupDisconnectListener(name: ConnectionName, port: chrome.runtime.Port): void {
    port.onDisconnect.addListener(() => {
      logger.log('Disconnected:', name);
      this.connections.delete(name);
    });
  }

  private initializeConnection(name: ConnectionName, port: chrome.runtime.Port): void {
    if (name === 'sidepanel' && this.currentDomain) {
      logger.debug('Initializing sidepanel with domain:', this.currentDomain);
      this.sendMessage<DomainInfoMessage>(port, {
        type: 'DOMAIN_INFO',
        target: 'sidepanel',
        domain: this.currentDomain,
        url: '',
      });
    }
  }

  // Message handling
  private handleMessage(sourceName: ConnectionName, message: Message): void {
    switch (message.type) {
      case 'DOMAIN_INFO':
        this.handleDomainInfo(message as DomainInfoMessage);
        break;
      case 'CONTENT_ACTION':
        this.handleContentAction(sourceName, message as ContentActionMessage);
        break;
      default:
        this.forwardMessage(sourceName, message);
    }
  }

  private handleDomainInfo(message: DomainInfoMessage): void {
    this.currentDomain = message.domain;
    const sidepanelConnection = this.connections.get('sidepanel');
    if (sidepanelConnection) {
      logger.log('Forwarding domain info:', message.domain);
      this.sendMessage<DomainInfoMessage>(sidepanelConnection.port, message);
    }
  }

  private handleContentAction(sourceName: ConnectionName, message: ContentActionMessage): void {
    const { action } = message;
    const targetConnections = Array.from(this.connections.entries())
      .filter(([name]) => name !== sourceName)
      .map(([, connection]) => connection);

    targetConnections.forEach((connection) => {
      switch (action.action) {
        case 'SHOW_ELEMENT':
          this.sendMessage<ElementActionMessage>(connection.port, {
            type: 'SHOW_ELEMENT',
            target: connection.name,
            identifier: action.identifier,
          });
          break;
        case 'TOGGLE_SELECTION_MODE':
          this.sendMessage(connection.port, {
            type: 'TOGGLE_SELECTION_MODE' as const,
            target: connection.name,
            enabled: action.enabled,
          });
          break;
        case 'CLEAR_ALL':
          this.sendMessage(connection.port, {
            type: 'CLEAR_ALL' as const,
            target: connection.name,
          });
          break;
        case 'APPLY_RULES':
          this.sendMessage(connection.port, {
            type: 'CONTENT_ACTION',
            target: connection.name,
            action: action,
          });
          break;
      }
    });
  }

  private forwardMessage(sourceName: ConnectionName, message: Message): void {
    this.connections.forEach((connection, name) => {
      if (name !== sourceName) {
        this.sendMessage(connection.port, { ...message, target: name });
      }
    });
  }

  private sendMessage<T extends Message>(port: chrome.runtime.Port, message: T): void {
    try {
      port.postMessage(message);
    } catch (error) {
      logger.error(`Failed to send message to ${port.name}:`, error);
    }
  }

  private async initializeActiveTab(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        this.activeTabId = tab.id;
        await this.handleTabChange(tab.id);
      }
    } catch (error) {
      logger.error('Failed to initialize active tab:', error);
    }
  }
}

export default BackgroundService.getInstance();
