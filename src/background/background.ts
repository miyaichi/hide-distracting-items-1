// src/background/background.ts

interface Connection {
  name: string;
  port: chrome.runtime.Port;
}

interface Message {
  type: string;
  payload: any;
}

interface DomainInfo {
  domain: string;
  url: string;
}

class BackgroundService {
  private static instance: BackgroundService;
  private readonly connections: Map<string, Connection>;
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
      console.log('[background] Extension installed');
      this.connections.clear();
    });
  }

  private setupConnectionListener(): void {
    chrome.runtime.onConnect.addListener(this.handlePortConnection.bind(this));
  }

  private setupTabListeners(): void {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      console.log('[background] Tab activated:', activeInfo.tabId);
      this.activeTabId = activeInfo.tabId;
      await this.handleTabChange(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (tabId === this.activeTabId && changeInfo.status === 'complete') {
        console.log('[background] Tab updated:', tabId);
        await this.handleTabChange(tabId);
      }
    });
  }

  private setupWindowListeners(): void {
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        console.log('[background] Window focus changed:', windowId);
        const tabs = await chrome.tabs.query({ active: true, windowId });
        if (tabs[0]) {
          this.activeTabId = tabs[0].id ?? null;
          if (this.activeTabId) {
            await this.handleTabChange(this.activeTabId);
          }
        }
      }
    });
  }

  private async initializeActiveTab(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        this.activeTabId = tab.id;
        await this.handleTabChange(tab.id);
      }
    } catch (error) {
      console.error('[background] Failed to initialize active tab:', error);
    }
  }

  private async handleTabChange(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const url = new URL(tab.url);
        const domainInfo: DomainInfo = {
          domain: url.hostname,
          url: tab.url,
        };
        await this.updateDomainInfo(domainInfo);
      }
    } catch (error) {
      console.error('[background] Failed to handle tab change:', error);
    }
  }

  private async updateDomainInfo(domainInfo: DomainInfo): Promise<void> {
    console.log('[background] Updating domain info:', domainInfo);
    this.currentDomain = domainInfo.domain;

    // Initialize ContentScript
    if (this.activeTabId) {
      try {
        const connctionScriptConnection = this.connections.get('content-script');
        if (connctionScriptConnection) {
          this.sendMessage(connctionScriptConnection.port, {
            type: 'INITIALIZE_CONTENT',
            payload: {
              domain: domainInfo.domain,
            },
          });
        }
      } catch (error) {
        // Ignore errors since the ContentScript may not be loaded yet
        console.log('[background] ContentScript not ready yet');
      }
    }

    // Notify SidePanel
    const sidepanelConnection = this.connections.get('sidepanel');
    if (sidepanelConnection) {
      this.sendMessage(sidepanelConnection.port, {
        type: 'DOMAIN_INFO',
        payload: domainInfo,
      });
    }
  }

  private async initializeSidePanel(): Promise<void> {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.error('[background] Failed to set panel behavior:', error);
    }
  }

  // Connection handling
  private handlePortConnection(port: chrome.runtime.Port): void {
    console.log('[background] New connection:', port.name);
    this.updateConnection(port);
    this.setupMessageListener(port);
    this.setupDisconnectListener(port);
    this.initializeConnection(port);
  }

  private updateConnection(port: chrome.runtime.Port): void {
    const existingConnection = this.connections.get(port.name);
    if (existingConnection) {
      console.log('[background] Updating existing connection:', port.name);
      existingConnection.port.disconnect();
    }

    this.connections.set(port.name, {
      name: port.name,
      port: port,
    });
  }

  private setupMessageListener(port: chrome.runtime.Port): void {
    port.onMessage.addListener((message: Message) => {
      console.log('[background] Received message:', message);
      this.handleMessage(port.name, message);
    });
  }

  private setupDisconnectListener(port: chrome.runtime.Port): void {
    port.onDisconnect.addListener(() => {
      console.log('[background] Disconnected:', port.name);
      this.connections.delete(port.name);
    });
  }

  private initializeConnection(port: chrome.runtime.Port): void {
    if (port.name === 'sidepanel' && this.currentDomain) {
      console.log('[background] Initializing sidepanel with domain:', this.currentDomain);
      this.sendMessage(port, {
        type: 'DOMAIN_INFO',
        payload: { domain: this.currentDomain },
      });
    }
  }

  // Message handling
  private handleMessage(sourceName: string, message: Message): void {
    switch (message.type) {
      case 'DOMAIN_INFO':
        this.handleDomainInfo(message);
        break;
      case 'CONTENT_ACTION':
        // Convert { action: 'action', ...rest } to { type: 'action', ...rest }
        const { action, ...rest } = message.payload;
        this.forwardMessage(sourceName, { type: action, ...rest });
        break;
      default:
        this.forwardMessage(sourceName, message);
        break;
    }
  }

  private handleDomainInfo(message: Message): void {
    this.currentDomain = message.payload.domain;
    const sidepanelConnection = this.connections.get('sidepanel');

    if (sidepanelConnection) {
      console.log('[background] Forwarding domain info:', message.payload);
      this.sendMessage(sidepanelConnection.port, {
        type: 'DOMAIN_INFO',
        payload: message.payload,
      });
    }
  }

  private forwardMessage(sourceName: string, message: Message): void {
    console.log('[background] Forwarding message from:', sourceName, message);

    for (const [name, connection] of this.connections.entries()) {
      if (name !== sourceName) {
        this.sendMessage(connection.port, message);
      }
    }
  }

  private sendMessage(port: chrome.runtime.Port, message: Message): void {
    try {
      port.postMessage(message);
    } catch (error) {
      console.error(`[background] Failed to send message to ${port.name}:`, error);
    }
  }

  // Public methods
  public getCurrentDomain(): string | null {
    return this.currentDomain;
  }

  public getConnections(): Map<string, Connection> {
    return new Map(this.connections);
  }
}

const backgroundService = BackgroundService.getInstance();
export default backgroundService;
