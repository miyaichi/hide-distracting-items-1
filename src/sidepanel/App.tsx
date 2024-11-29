import React, { useCallback, useEffect, useState } from 'react';
import { ContentActionMessage, DomainSettings, ElementIdentifier, Message } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';
import { StorageManager } from '../utils/storageManager';
import { Controls } from './components/Controls';
import { ElementTree } from './components/ElementTree';

const logger = new Logger('Sidepanel');

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
    [loadDomainSettings]
  );

  const handleMessage = useCallback(
    async (message: Message) => {
      logger.debug('Received message:', message);
      switch (message.type) {
        case 'DOMAIN_INFO':
          await handleDomainChange(message.domain);
          break;
        case 'ELEMENT_SELECTED':
          await handleElementSelected(message.identifier, message.domain);
          break;
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
    if (!currentDomain) return;

    logger.log('Removing element:', element);
    const newElements = hiddenElements.filter((e) => e.domPath !== element.domPath);
    setHiddenElements(newElements);

    connection.sendMessage<ContentActionMessage>('background', {
      type: 'CONTENT_ACTION',
      action: {
        action: 'SHOW_ELEMENT',
        identifier: element,
      },
    });

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleToggleSelectionMode = (enabled: boolean) => {
    if (!currentDomain) return;

    logger.log('Selection mode toggled:', enabled);
    setIsSelectionMode(enabled);
    connection.sendMessage<ContentActionMessage>('background', {
      type: 'CONTENT_ACTION',
      action: {
        action: 'TOGGLE_SELECTION_MODE',
        enabled,
      },
    });
  };

  const handleClearAll = async () => {
    if (!currentDomain) return;

    logger.log('Clearing all elements');
    setHiddenElements([]);
    connection.sendMessage<ContentActionMessage>('background', {
      type: 'CONTENT_ACTION',
      action: { action: 'CLEAR_ALL' },
    });

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: [],
      enabled: true,
    });
  };

  useEffect(() => {
    logger.log('Side panel mounted');

    const port = connection.connect('sidepanel');
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
        {currentDomain && <p className="text-sm text-gray-500 mt-1">Domain: {currentDomain}</p>}
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
