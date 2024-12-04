import React, { useEffect, useState } from 'react';
import { BaseMessage, MessagePayloads } from '../types/messages';
import { Context, ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';
import { StorageManager } from '../utils/storageManager';
import { Controls } from './components/Controls';
import { HiddenElementList } from './components/HiddenElementList';

const logger = new Logger('sidepanel');

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [hiddenElements, setHiddenElements] = useState<ElementIdentifier[]>([]);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
  const initialized = React.useRef(false);

  useEffect(() => {
    if (initialized.current) {
      logger.debug('App already initialized, skipping...');
      return;
    }

    const initializeTab = async () => {
      if (initialized.current) {
        return;
      }

      try {
        const manager = new ConnectionManager('sidepanel', handleMessage);
        manager.connect();
        setConnectionManager(manager);

        // Initialize active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          setTabId(tab.id);
          setCurrentDomain(tab?.url ? new URL(tab.url).hostname : '');
          initialized.current = true;
        }

        logger.debug('Initalized', { tab });
      } catch (error) {
        logger.error('Tab initialization failed:', error);
      }
    };

    initializeTab();

    // Monitor active tab change
    const handleTabChange = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (!tab.url) return;

      setTabId(activeInfo.tabId);
      setCurrentDomain(tab?.url ? new URL(tab.url).hostname : '');
    };
    chrome.tabs.onActivated.addListener(handleTabChange);

    // Monitor tab URL change
    const handleTabUpdated = async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === 'complete') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab.id === tabId) {
          setTabId(tabId);
          setCurrentDomain(tab?.url ? new URL(tab.url).hostname : '');
        }
      }
    };
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    // Monitor window focus change
    const handleWindowFocus = async (windowId: number) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) return;

      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (!tab?.url) return;

      setTabId(tab.id!);
      setCurrentDomain(new URL(tab.url).hostname);
    };
    chrome.windows.onFocusChanged.addListener(handleWindowFocus);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.windows.onFocusChanged.removeListener(handleWindowFocus);
      connectionManager?.disconnect();
    };
  }, []);

  useEffect(() => {
    setContentScriptContext(tabId ? `content-${tabId}` : 'undefined');
  }, [tabId, currentDomain]);

  useEffect(() => {
    if (connectionManager && contentScriptContext !== 'undefined') {
      connectionManager?.sendMessage(contentScriptContext, {
        type: 'TOGGLE_SELECTION_MODE',
        payload: { enabled: isSelectionMode },
      });
    }
  }, [isSelectionMode, contentScriptContext]);

  useEffect(() => {
    if (!currentDomain) return;
    loadHiddenElements();
  }, [currentDomain]);

  // Message handler
  const handleMessage = (message: BaseMessage) => {
    logger.debug('Message received', { type: message.type });
    switch (message.type) {
      case 'ELEMENT_HIDDEN':
        const elementHiddenPayload = message.payload as MessagePayloads['ELEMENT_HIDDEN'];
        handleElementHidden(elementHiddenPayload.identifier);
        break;
      // Implement other message handling here ...
    }
  };

  const handleElementHidden = async (element: ElementIdentifier) => {
    const newElements = [...hiddenElements, element];
    await saveHiddenElements(newElements);
  };

  // Utility functions
  const loadHiddenElements = async () => {
    try {
      const settings = await StorageManager.getDomainSettings(currentDomain);
      setHiddenElements(settings.hiddenElements);
    } catch (error) {
      logger.error('Failed to load domain settings:', error);
    }
  };

  const saveHiddenElements = async (elements: ElementIdentifier[]) => {
    try {
      setHiddenElements(elements);
      await StorageManager.saveDomainSettings(currentDomain, {
        hiddenElements: elements,
        enabled: true,
      });
    } catch (error) {
      logger.error('Error saving domain settings:', error);
    }
  };

  // UI event handlers
  const handleToggleSelectionMode = (enabled: boolean) => {
    setIsSelectionMode(enabled);
  };

  const handleRestoreHiddenElements = async () => {
    const newElements: ElementIdentifier[] = [];
    await saveHiddenElements(newElements);
    connectionManager?.sendMessage(contentScriptContext, {
      type: 'RESTORE_HIDDEN_ELEMENTS',
      payload: undefined,
    });
  };

  const handleUnhideElement = async (identifier: ElementIdentifier) => {
    const newElements = hiddenElements.filter((element) => element.domPath !== identifier.domPath);
    await saveHiddenElements(newElements);
    connectionManager?.sendMessage(contentScriptContext, {
      type: 'UNHIDE_ELEMENT',
      payload: { identifier: identifier },
    });
  };

  return (
    <div className="side-panel-container">
      <div className="side-panel-header">
        <h1 className="text-xl font-bold">Hide Distracting Elements</h1>
        {currentDomain && <p className="text-sm text-gray-500 mt-1">Domain: {currentDomain}</p>}
      </div>

      <Controls
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
        onRestoreHiddenElements={handleRestoreHiddenElements}
      />

      <div className="side-panel-content custom-scrollbar">
        <HiddenElementList elements={hiddenElements} unUnhideElement={handleUnhideElement} />
      </div>
    </div>
  );
}
