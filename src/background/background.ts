// src/background/background.ts

interface Connection {
  name: string;
  port: chrome.runtime.Port;
}

interface Message {
  type: string;
  payload: any;
}

class BackgroundService {
  private static instance: BackgroundService;
  private readonly connections: Map<string, Connection>;
  private currentDomain: string | null;

  private constructor() {
    this.connections = new Map();
    this.currentDomain = null;
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
    await this.initializeSidePanel();
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
    console.log('[background] Forwarding message from:', sourceName);

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
