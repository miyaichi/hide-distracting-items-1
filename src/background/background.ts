import { ExtensionMessage, MessageHandler, TabInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

class BackgroundService {
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private activeTabInfo: TabInfo | null = null;
  private contentScriptContext: Context = 'undefined';
  private readonly ports = new Map<string, chrome.runtime.Port>();

  constructor() {
    this.logger = new Logger('background');
    this.connectionManager = new ConnectionManager('background', this.handleMessage);
    this.setupConnection();
    this.setupChromeListeners();
    this.setupSidepanel();
  }

  private async setupConnection() {
    try {
      this.connectionManager.connect();

      setInterval(() => {
        if (this.connectionManager.getStatus() !== 'connected') {
          this.logger.debug('Reconnecting background service...');
          this.connectionManager.connect();
        }
      }, 5000);
    } catch (error) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private setupChromeListeners() {
    // Monitor tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        this.activeTabChanged(activeInfo.windowId, activeInfo.tabId, tab.url || '');
      } catch (error) {
        this.logger.error('Failed to handle tab activation:', error);
      }
    });

    // Monitor tab URL change
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      try {
        if (changeInfo.status === 'complete') {
          if (!tab.windowId) return;

          this.activeTabChanged(tab.windowId, tabId, tab.url || '');
        }
      } catch (error) {
        this.logger.error('Failed to handle tab update:', error);
      }
    });

    // Monitor window focus
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) return;

        const [tab] = await chrome.tabs.query({ active: true, windowId });
        this.activeTabChanged(windowId, tab.id || -1, tab.url || '');
      } catch (error) {
        this.logger.error('Failed to handle window focus change:', error);
      }
    });

    // Monitor connections and message forwarding
    chrome.runtime.onConnect.addListener((port) => {
      this.ports.set(port.name, port);

      // Handle sidepanel disconnection
      if (port.name === 'sidepanel') {
        port.onDisconnect.addListener(async () => {
          try {
            this.logger.debug('Side panel disconnected');
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              if (tab.id) {
                try {
                  // Directly use chrome.tabs.sendMessage instead of ConnectionManager
                  await chrome.tabs.sendMessage(tab.id, {
                    type: 'SIDEPANEL_CLOSED',
                    payload: undefined,
                  });
                } catch (error) {
                  this.logger.debug(`Failed to send message to tab ${tab.id}:`, error);
                }
              }
            }
          } catch (error) {
            this.logger.error('Failed to notify content scripts:', error);
          }
        });
      }

      // Forward messages
      port.onMessage.addListener((message: ExtensionMessage) => {
        this.logger.debug('Forwarding message:', message);
        const targetPort = this.ports.get(message.target);
        targetPort?.postMessage(message);
      });

      port.onDisconnect.addListener(() => {
        this.ports.delete(port.name);
        this.logger.debug('Port disconnected:', port.name);
      });
    });

    // Get sender tab ID for content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_TAB_ID' && sender.tab?.id) {
        sendResponse({ tabId: sender.tab.id });
      }
    });
  }

  private activeTabChanged = (windowId: number, tabId: number, url: string) => {
    this.activeTabInfo = { tabId, windowId, url };
    this.contentScriptContext = tabId ? `content-${tabId}` : 'undefined';
    this.logger.debug('Active tab changed', this.contentScriptContext);

    // Notify to content scripts
    if (this.connectionManager && this.contentScriptContext !== 'undefined') {
      this.connectionManager.sendMessage(this.contentScriptContext, {
        type: 'INITIALIZE_CONTENT',
        payload: {},
      });
    }
  };

  private async setupSidepanel(): Promise<void> {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      this.logger.error('Failed to set panel behavior:', error);
    }
  }

  private handleMessage: MessageHandler = (message) => {
    // Implement other message handling here ..
    this.logger.debug('Message received', { type: message.type });
    switch (message.type) {
      case 'GET_TAB_ID':
        this.handleGetTabId(message.source);
        break;
    }
  };

  private async handleGetTabId(source: Context) {
    if (!source.startsWith('content-')) return;

    const tabId = parseInt(source.split('-')[1]);
    await this.connectionManager.sendMessage(source, {
      type: 'GET_TAB_ID_RESPONSE',
      payload: { tabId },
    });
  }
}

// Initialize the background service
new BackgroundService();
