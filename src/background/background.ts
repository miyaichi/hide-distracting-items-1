// src/background/background.ts
import { Connection, TabState } from '../types/types';

class BackgroundService {
  private lastActivatedTab: { tabId: number; windowId: number } | null = null;
  private tabStates: Map<number, TabState> = new Map();
  private connections: Connection = {};

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.initializeExtension();
    this.setupSidePanelBehavior();
    this.registerTabEventListeners();
    this.registerWindowEventListener();
    this.registerConnectionListener();
  }

  private initializeExtension() {
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Extension installed');
      this.tabStates.clear();
      this.connections = {};
    });
  }

  private setupSidePanelBehavior() {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set panel behavior:', error));
  }

  private registerTabEventListeners() {
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
  }

  private registerWindowEventListener() {
    chrome.windows.onFocusChanged.addListener(this.handleWindowFocusChanged.bind(this));
  }

  private registerConnectionListener() {
    chrome.runtime.onConnect.addListener(this.handleConnection.bind(this));
  }

  private async handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    const { tabId, windowId } = activeInfo;

    // 直前のアクティブ化と同じ場合はスキップ
    if (this.lastActivatedTab?.tabId === tabId && this.lastActivatedTab?.windowId === windowId) {
      console.log('Skipping duplicate tab activation');
      return;
    }

    console.log('Tab activated:', { tabId, windowId });
    this.lastActivatedTab = { tabId, windowId };

    // タブの状態を取得または作成
    let tabState = this.tabStates.get(tabId);
    if (!tabState) {
      tabState = {
        tabId,
        windowId,
        domain: null,
        contentScriptPort: null,
        sidePanelPort: null,
      };
      this.tabStates.set(tabId, tabState);
    }

    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const domain = new URL(tab.url).hostname;
        tabState.domain = domain;

        // ContentScriptとの接続確立を試みる
        if (!tabState.contentScriptPort) {
          console.log('No content script connection, injecting script...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['contentScript/contentScript.js'],
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error('Failed to inject content script:', error);
          }
        }

        // ContentScriptが利用可能な場合は初期化を要求
        if (tabState.contentScriptPort) {
          tabState.contentScriptPort.postMessage({
            type: 'INITIALIZE_CONTENT',
            payload: { domain },
          });
        }

        // サイドパネルに新しいドメイン情報を通知
        this.notifyDomainChange(tabState);
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  private async handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ) {
    if (changeInfo.status === 'complete' && tab.url) {
      const domain = new URL(tab.url).hostname;
      const tabState = this.tabStates.get(tabId) || {
        tabId,
        windowId: tab.windowId,
        domain,
        contentScriptPort: null,
        sidePanelPort: null,
      };

      tabState.domain = domain;
      this.tabStates.set(tabId, tabState);

      if (tabState.contentScriptPort) {
        tabState.contentScriptPort.postMessage({
          type: 'INITIALIZE_CONTENT',
          payload: { domain },
        });
      }

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
      if (tab && tab.id) {
        // handleTabActivatedを直接呼び出し
        await this.handleTabActivated({
          tabId: tab.id,
          windowId,
        });
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
    const senderTabId = sender?.tab?.id;

    if (name === 'sidepanel') {
      // アクティブなタブのIDを取得
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          const activeTabId = tab.id; // アクティブタブのID
          console.log('Sidepanel connected, associated with tab:', activeTabId);

          const tabState = this.tabStates.get(activeTabId) || {
            tabId: activeTabId,
            windowId: tab.windowId!,
            domain: null,
            contentScriptPort: null,
            sidePanelPort: null,
          };
          tabState.sidePanelPort = port;
          this.tabStates.set(activeTabId, tabState);

          // 現在のドメイン情報があれば、すぐに通知
          if (tabState.domain) {
            this.notifyDomainChange(tabState);
          }

          // メッセージリスナーを設定（activeTabIdを使用）
          port.onMessage.addListener((message) => {
            this.handleMessage(message, port, activeTabId);
          });

          // 切断リスナーを設定
          port.onDisconnect.addListener(() => {
            this.handleDisconnection(port, activeTabId);
          });
        }
      });
    } else if (senderTabId) {
      // content-scriptの場合は従来通り
      const tabState = this.tabStates.get(senderTabId) || {
        tabId: senderTabId,
        windowId: sender.tab!.windowId,
        domain: null,
        contentScriptPort: null,
        sidePanelPort: null,
      };

      if (name === 'content-script') {
        tabState.contentScriptPort = port;
      }

      this.tabStates.set(senderTabId, tabState);

      // メッセージと切断リスナーを設定
      port.onMessage.addListener((message) => {
        this.handleMessage(message, port, senderTabId);
      });

      port.onDisconnect.addListener(() => {
        this.handleDisconnection(port, senderTabId);
      });
    }
  }

  private handleMessage(message: any, port: chrome.runtime.Port, tabId: number | undefined) {
    console.log('Received message:', message, 'from:', port.name);

    if (message.type === 'DOMAIN_INFO' && tabId) {
      console.log('Processing DOMAIN_INFO message for tab:', tabId);
      const tabState = this.tabStates.get(tabId);
      if (tabState) {
        console.log('Current tab state:', tabState);
        tabState.domain = message.payload.domain;
        this.notifyDomainChange(tabState);
      } else {
        console.log('No tab state found for tabId:', tabId);
      }
    } else {
      // target指定のあるメッセージを適切に処理
      if (message.target) {
        this.forwardTargetedMessage(message, port, tabId);
      } else {
        // 他のメッセージの処理
        this.forwardMessage(message, port, tabId);
      }
    }
  }

  private forwardTargetedMessage(
    message: any,
    sourcePort: chrome.runtime.Port,
    tabId: number | undefined
  ) {
    console.log(`Forwarding message to the other port:`, message, sourcePort, tabId);
    if (tabId) {
      const tabState = this.tabStates.get(tabId);
      if (tabState) {
        if (message.target === 'content-script' && tabState.contentScriptPort) {
          console.log('Forwarding message to content-script:', message);
          tabState.contentScriptPort.postMessage(message);
        } else if (message.target === 'background' && tabState.sidePanelPort) {
          console.log('Forwarding message to sidepanel:', message);
          tabState.sidePanelPort.postMessage(message);
        }
      }
    } else {
      console.log('No tabId specified for targeted message:', message);
    }
  }

  private forwardMessage(message: any, sourcePort: chrome.runtime.Port, tabId: number | undefined) {
    console.log(`Forwarding message to the other port:`, message, sourcePort, tabId);
    if (tabId) {
      const tabState = this.tabStates.get(tabId);
      if (tabState) {
        if (sourcePort === tabState.contentScriptPort && tabState.sidePanelPort) {
          console.log('Forwarding message to sidepanel:', message);
          tabState.sidePanelPort.postMessage(message);
        } else if (sourcePort === tabState.sidePanelPort && tabState.contentScriptPort) {
          console.log('Forwarding message to content-script:', message);
          tabState.contentScriptPort.postMessage(message);
        }
      }
    } else {
      console.log('No tabId specified for message forwarding:', message);
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
    console.log('Notifying domain change:', {
      domain: tabState.domain,
      hasSidePanelPort: !!tabState.sidePanelPort,
    });

    if (tabState.domain && tabState.sidePanelPort) {
      tabState.sidePanelPort.postMessage({
        type: 'DOMAIN_INFO',
        payload: { domain: tabState.domain },
      });
      console.log('Domain change notification sent');
    } else {
      console.log('Cannot notify domain change: missing domain or sidePanel port');
    }
  }
}

const backgroundService = new BackgroundService();
