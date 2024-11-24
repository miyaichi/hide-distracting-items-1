import React, { useCallback, useEffect, useState } from 'react';
import { DomainSettings, ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';
import { StorageManager } from '../utils/storageManager';
import { Controls } from './components/Controls';
import { ElementTree } from './components/ElementTree';

const logger = new Logger('Sidepanel');

interface MessagePayload {
  type: string;
  payload?: {
    domain: string;
    identifier?: ElementIdentifier;
  };
}

export const App: React.FC = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hiddenElements, setHiddenElements] = useState<ElementIdentifier[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [connection] = useState(() => new ConnectionManager());

  const loadDomainSettings = useCallback(async (domain: string) => {
    try {
      const settings: DomainSettings = await StorageManager.getDomainSettings(domain);
      logger.debug('Loaded settings for domain:', domain, settings);
      setHiddenElements(settings.hiddenElements);
    } catch (error) {
      logger.error('Error loading domain settings:', error);
    }
  }, []);

  const handleDomainChange = useCallback(
    async (newDomain: string) => {
      logger.log('Domain changed to:', newDomain);
      setCurrentDomain(newDomain);
      setIsSelectionMode(false);
      handleToggleSelectionMode(false);
      await loadDomainSettings(newDomain);
    },
    [currentDomain, loadDomainSettings]
  );

  const handleMessage = useCallback(
    async (message: MessagePayload) => {
      logger.debug('Received message:', message);

      switch (message.type) {
        case 'DOMAIN_INFO': {
          const domain = message.payload?.domain;
          if (domain) {
            await handleDomainChange(domain);
          }
          break;
        }
        case 'ELEMENT_SELECTED': {
          const { identifier, domain } = message.payload || {};
          if (identifier && domain) {
            await handleElementSelected(identifier, domain);
          }
          break;
        }
      }
    },
    [handleDomainChange]
  );

  const handleElementSelected = async (element: ElementIdentifier, domain: string) => {
    logger.log('Element selected for domain:', domain);
    const newElements = [...hiddenElements, element];
    setHiddenElements(newElements);
    await StorageManager.saveDomainSettings(domain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleRemoveElement = async (element: ElementIdentifier) => {
    if (!currentDomain) {
      logger.error('No current domain set');
      return;
    }

    logger.log('Removing element:', element);
    const newElements = hiddenElements.filter((e) => e.domPath !== element.domPath);
    setHiddenElements(newElements);

    connection.sendMessage('background', {
      type: 'CONTENT_ACTION',
      payload: { action: 'SHOW_ELEMENT', identifier: element },
    });

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleToggleSelectionMode = (enabled: boolean) => {
    if (!currentDomain) {
      logger.error('Cannot toggle selection mode: No domain set');
      return;
    }

    logger.log('Selection mode toggled:', enabled);
    setIsSelectionMode(enabled);
    connection.sendMessage('background', {
      type: 'CONTENT_ACTION',
      payload: { action: 'TOGGLE_SELECTION_MODE', enabled },
    });
  };

  const handleClearAll = async () => {
    if (!currentDomain) {
      logger.error('Cannot clear elements: No domain set');
      return;
    }

    logger.log('Clearing all elements');
    setHiddenElements([]);
    connection.sendMessage('background', {
      type: 'CONTENT_ACTION',
      payload: { action: 'CLEAR_ALL' },
    });

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: [],
      enabled: true,
    });
  };

  useEffect(() => {
    logger.log('Side panel mounted');

    const port = connection.connect('sidepanel');
    logger.debug('Connected to background');

    port.onMessage.addListener(handleMessage);

    return () => {
      logger.debug('Side panel unmounting');
      setIsSelectionMode(false);
      port.disconnect();
    };
  }, [connection, handleMessage]);

  return (
    <div className="side-panel-container">
      <div className="side-panel-header">
        <h1 className="text-xl font-bold">Hide Distracting Elements</h1>
        {currentDomain && (
          <p className="text-sm text-gray-500 mt-1">Domain: {currentDomain || 'No domain set'}</p>
        )}
      </div>

      <Controls
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
        onClearAll={handleClearAll}
      />

      <div className="side-panel-content custom-scrollbar">
        <ElementTree elements={hiddenElements} onRemoveElement={handleRemoveElement} />
      </div>
    </div>
  );
};

export default App;
