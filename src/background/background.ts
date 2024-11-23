// src/background/background.ts
interface Connection {
  [key: string]: chrome.runtime.Port;
}

interface TabState {
  tabId: number;
  windowId: number;
  domain: string | null;
  contentScriptPort: chrome.runtime.Port | null;
  sidePanelPort: chrome.runtime.Port | null;
}

class BackgroundService {
  private tabStates: Map<number, TabState> = new Map();
  private connections: Connection = {};

  constructor() {
    this.initialize();
  }

  private initialize() {
    // 拡張機能インストール時の初期化
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Extension installed');
      this.tabStates.clear();
      this.connections = {};
    });

    // サイドパネルの設定
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set panel behavior:', error));

    // タブ切り替えの監視
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    
    // タブ更新の監視
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    
    // タブ削除の監視
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    
    // ウィンドウ切り替えの監視
    chrome.windows.onFocusChanged.addListener(this.handleWindowFocusChanged.bind(this));

    // 接続の監視
    chrome.runtime.onConnect.addListener(this.handleConnection.bind(this));
  }

  private async handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    const { tabId, windowId } = activeInfo;
    console.log('Tab activated:', { tabId, windowId });

    // タブの状態を取得または作成
    let tabState = this.tabStates.get(tabId);
    if (!tabState) {
      tabState = {
        tabId,
        windowId,
        domain: null,
        contentScriptPort: null,
        sidePanelPort: null
      };
      this.tabStates.set(tabId, tabState);
    }

    // アクティブなタブの情報を更新
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const domain = new URL(tab.url).hostname;
        tabState.domain = domain;
        
        // サイドパネルに新しいドメイン情報を通知
        this.notifyDomainChange(tabState);
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  private async handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      const domain = new URL(tab.url).hostname;
      const tabState = this.tabStates.get(tabId) || {
        tabId,
        windowId: tab.windowId,
        domain,
        contentScriptPort: null,
        sidePanelPort: null
      };

      tabState.domain = domain;
      this.tabStates.set(tabId, tabState);
      this.notifyDomainChange(tabState);
    }
  }

  private handleTabRemoved(tabId: number) {
    console.log('Tab removed:', tabId);
    this.tabStates.delete(tabId);
  }

  private async handleWindowFocusChanged(windowId: number) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) {
        await this.handleTabActivated({ tabId: tab.id!, windowId });
      }
    } catch (error) {
      console.error('Error handling window focus change:', error);
    }
  }

  private handleConnection(port: chrome.runtime.Port) {
    const { name } = port;
    console.log('New connection:', name);

    // タブIDを取得（content-scriptの場合）
    const sender = port.sender;
    const tabId = sender?.tab?.id;

    if (tabId) {
      const tabState = this.tabStates.get(tabId) || {
        tabId,
        windowId: sender.tab!.windowId,
        domain: null,
        contentScriptPort: null,
        sidePanelPort: null
      };

      if (name === 'content-script') {
        tabState.contentScriptPort = port;
      } else if (name === 'sidepanel') {
        tabState.sidePanelPort = port;
      }

      this.tabStates.set(tabId, tabState);
    }

    port.onMessage.addListener((message) => {
      this.handleMessage(message, port, tabId);
    });

    port.onDisconnect.addListener(() => {
      this.handleDisconnection(port, tabId);
    });
  }

  private handleMessage(message: any, port: chrome.runtime.Port, tabId: number | undefined) {
    console.log('Received message:', message, 'from:', port.name);

    if (message.type === 'DOMAIN_INFO' && tabId) {
      const tabState = this.tabStates.get(tabId);
      if (tabState) {
        tabState.domain = message.payload.domain;
        this.notifyDomainChange(tabState);
      }
    } else {
      // 他のメッセージの処理
      this.forwardMessage(message, port, tabId);
    }
  }

  private forwardMessage(message: any, sourcePort: chrome.runtime.Port, tabId: number | undefined) {
    if (tabId) {
      const tabState = this.tabStates.get(tabId);
      if (tabState) {
        if (sourcePort === tabState.contentScriptPort && tabState.sidePanelPort) {
          tabState.sidePanelPort.postMessage(message);
        } else if (sourcePort === tabState.sidePanelPort && tabState.contentScriptPort) {
          tabState.contentScriptPort.postMessage(message);
        }
      }
    }
  }

  private handleDisconnection(port: chrome.runtime.Port, tabId: number | undefined) {
    console.log('Disconnected:', port.name);
    
    if (tabId) {
      const tabState = this.tabStates.get(tabId);
      if (tabState) {
        if (port === tabState.contentScriptPort) {
          tabState.contentScriptPort = null;
        } else if (port === tabState.sidePanelPort) {
          tabState.sidePanelPort = null;
        }

        // もし両方の接続が切れた場合はタブの状態を削除
        if (!tabState.contentScriptPort && !tabState.sidePanelPort) {
          this.tabStates.delete(tabId);
        }
      }
    }
  }

  private notifyDomainChange(tabState: TabState) {
    if (tabState.domain && tabState.sidePanelPort) {
      tabState.sidePanelPort.postMessage({
        type: 'DOMAIN_INFO',
        payload: { domain: tabState.domain }
      });
    }
  }
}

// バックグラウンドサービスのインスタンスを作成
const backgroundService = new BackgroundService();