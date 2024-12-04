import { BaseMessage, ExtensionMessage, TabInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

class BackgroundService {
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private activeTabInfo: TabInfo | null = null;
  private contentScriptContext: Context = 'undefined';
  private readonly ports = new Map<string, chrome.runtime.Port>();
  private readonly RESTRICTED_PATTERNS = [
    'chrome://',
    'chrome-extension://',
    'devtools://',
    'edge://',
    'about:',
  ];

  constructor() {
    this.logger = new Logger('background');
    this.connectionManager = new ConnectionManager('background');
    this.setupConnection();
    this.setupChromeListeners();
    this.setupSidepanel();
  }

  private isScriptInjectionAllowed(url: string): boolean {
    if (!url) return false;
    return !this.RESTRICTED_PATTERNS.some((pattern) => url.startsWith(pattern));
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
    } catch (error: any) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private setupChromeListeners() {
    // Monitor tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await this.handleTabActivation(tab);
      } catch (error) {
        this.logger.error('Failed to handle tab activation:', error);
      }
    });

    // Monitor tab URL change
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      try {
        if (changeInfo.status === 'complete' && tab.active) {
          await this.handleTabActivation(tab);
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
        if (tab) {
          await this.handleTabActivation(tab);
        }
      } catch (error) {
        this.logger.error('Failed to handle window focus change:', error);
      }
    });

    // Monitor connections
    chrome.runtime.onConnect.addListener((port) => {
      this.ports.set(port.name, port);

      if (port.name === 'sidepanel') {
        port.onDisconnect.addListener(this.handleSidePanelDisconnection);
      }

      port.onMessage.addListener((message: ExtensionMessage) => {
        if (message.target === 'background') {
          // Handle messages targeted to background
          this.handleMessage(port, message);
          return;
        }

        // Forward messages between content script and side panel
        this.logger.debug('Forwarding message:', message);
        const targetPort = this.ports.get(message.target);
        targetPort?.postMessage(message);
      });

      port.onDisconnect.addListener(() => {
        this.ports.delete(port.name);
        this.logger.debug('Port disconnected:', port.name);
      });
    });
  }

  private handleSidePanelDisconnection = async () => {
    this.logger.debug('Side panel disconnected');
    try {
      if (this.activeTabInfo?.tabId && this.activeTabInfo.isScriptInjectionAllowed) {
        await chrome.tabs.sendMessage(this.activeTabInfo.tabId, {
          type: 'SIDEPANEL_CLOSED',
          payload: undefined,
        });
      }
    } catch (error) {
      this.logger.error('Failed to notify content script:', error);
    }
  };

  private async handleTabActivation(tab: chrome.tabs.Tab) {
    if (!tab.id || !tab.url) return;

    const isAllowed = this.isScriptInjectionAllowed(tab.url);
    this.activeTabInfo = {
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      isScriptInjectionAllowed: isAllowed,
    };

    // Store the active tab info
    await chrome.storage.local.set({ activeTabInfo: this.activeTabInfo });

    if (!isAllowed) {
      this.logger.info('Script injection not allowed for this URL:', tab.url);
      this.contentScriptContext = 'undefined';
      return;
    }

    try {
      // Check if content script is already injected
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    } catch (error: any) {
      // Inject only if allowed and not already injected
      if (error.toString().includes('Could not establish connection')) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript/contentScript.js'],
        });
      }
    }

    // Set the context for the content script in the active tab
    this.contentScriptContext = `content-${tab.id}`;
  }

  private async setupSidepanel(): Promise<void> {
    try {
      // Open the side panel on action clicks
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      this.logger.error('Failed to set panel behavior:', error);
    }
  }

  /**
   * Helper function to send messages from background to other components.
   * Uses direct port.postMessage for reliable message delivery.
   */
  private sendMessage<T extends BaseMessage>(
    target: Context,
    port: chrome.runtime.Port,
    messageData: Omit<T, 'source' | 'target' | 'timestamp'>
  ): void {
    const message = {
      ...messageData,
      source: 'background',
      target,
      timestamp: Date.now(),
    } as T;

    port.postMessage(message);
    this.logger.debug('Message sent', { target, type: message.type });
  }

  private handleMessage = (port: chrome.runtime.Port, message: ExtensionMessage) => {
    this.logger.debug('Message received', { type: message.type });
    // Implement message handling if needed
    //
    // When replying to a message, use this.sendMessage instead of ConnectionManager.sendMessage
    // to keep the flow of messages consistent and avoid port disconnection issues.
  };
}

// Initialize the background service
new BackgroundService();
