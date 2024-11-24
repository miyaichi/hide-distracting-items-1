// src/background/background.ts

interface Connection {
  [key: string]: chrome.runtime.Port;
}

interface DomainInfo {
  domain: string;
  url?: string;
}

class BackgroundService {
  private static instance: BackgroundService;
  private connections: Connection;
  private currentDomain: string | null;

  private constructor() {
    this.connections = {};
    this.currentDomain = null;
    this.initialize();
  }

  public static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  private async initialize(): Promise<void> {
    // 拡張機能のインストール/更新時のリスナー
    chrome.runtime.onInstalled.addListener(() => {
      console.log('[background] Extension installed');
      this.connections = {};
    });

    // ポート接続リスナーの設定
    chrome.runtime.onConnect.addListener(this.handlePortConnection.bind(this));

    // サイドパネルの初期化
    await this.initializeSidePanel();
  }

  private async initializeSidePanel(): Promise<void> {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.error('Failed to set panel behavior:', error);
    }
  }

  private forwardMessage(sourcePort: chrome.runtime.Port, message: any): void {
    console.log(`[background] Forwarding message from ${sourcePort.name}:`, message);
    Object.entries(this.connections).forEach(([name, connection]) => {
      if (name !== sourcePort.name) {
        try {
          console.log(`[Background] Forwarding message to ${name}:`, message);
          connection.postMessage(message);
        } catch (error) {
          console.error(`Failed to forward message to ${name}:`, error);
        }
      }
    });
  }

  private handleDomainInfo(message: { payload: DomainInfo }): void {
    this.currentDomain = message.payload.domain;

    if (this.connections['sidepanel']) {
      console.log('[background] POSTING DOMAIN INFO:', message.payload);
      this.connections['sidepanel'].postMessage({
        type: 'DOMAIN_INFO',
        payload: message.payload,
      });
    }
  }

  private handlePortConnection(port: chrome.runtime.Port): void {
    console.log('[background] New connection:', port.name);

    // 既存の接続を切断
    if (this.connections[port.name]) {
      console.log('[background] Disconnecting existing connection:', port.name);
      this.connections[port.name].disconnect();
    }

    // 新しい接続を保存
    this.connections[port.name] = port;

    // メッセージリスナーの設定
    port.onMessage.addListener((message) => {
      console.log('[background] Received message in background:', message);
      if (message.type === 'DOMAIN_INFO') {
        this.handleDomainInfo(message);
      } else {
        this.forwardMessage(port, message);
      }
    });

    // サイドパネル接続時の初期化
    if (port.name === 'sidepanel' && this.currentDomain) {
      console.log('[background] POSTING DOMAIN INFO:', this.currentDomain);
      port.postMessage({
        type: 'DOMAIN_INFO',
        payload: { domain: this.currentDomain },
      });
    }

    // 切断ハンドラの設定
    port.onDisconnect.addListener(() => {
      console.log('[background] Disconnected:', port.name);
      delete this.connections[port.name];
    });
  }

  // 公開メソッド
  public getCurrentDomain(): string | null {
    return this.currentDomain;
  }

  public getConnections(): Connection {
    return { ...this.connections };
  }
}

// BackgroundServiceのインスタンスを作成して初期化
const backgroundService = BackgroundService.getInstance();

export default backgroundService;