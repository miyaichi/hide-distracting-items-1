import React, { useCallback, useEffect, useState } from 'react';
import { DomainSettings, ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { StorageManager } from '../utils/storageManager';
import { Controls } from './components/Controls';
import { ElementTree } from './components/ElementTree';

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
      console.log('Loaded settings for domain:', domain, settings);
      setHiddenElements(settings.hiddenElements);
    } catch (error) {
      console.error('Error loading domain settings:', error);
    }
  }, []);

  const handleDomainChange = useCallback(
    async (newDomain: string) => {
      console.log('Domain changed to:', newDomain);
      if (newDomain !== currentDomain) {
        setCurrentDomain(newDomain);
        setIsSelectionMode(false);
        await loadDomainSettings(newDomain);
      }
    },
    [currentDomain, loadDomainSettings]
  );

  const handleMessage = useCallback(
    async (message: MessagePayload) => {
      console.log('Side panel received message:', message);

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
    console.log('Handling element selection for domain:', domain);
    const newElements = [...hiddenElements, element];
    setHiddenElements(newElements);
    await StorageManager.saveDomainSettings(domain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleRemoveElement = async (element: ElementIdentifier) => {
    if (!currentDomain) {
      console.error('No current domain set');
      return;
    }

    const newElements = hiddenElements.filter((e) => e.domPath !== element.domPath);
    setHiddenElements(newElements);

    connection.sendMessage('content-script', {
      type: 'SHOW_ELEMENT',
      identifier: element,
    });

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleToggleSelectionMode = (enabled: boolean) => {
    console.log('Toggling selection mode:', enabled);
    if (!currentDomain) {
      console.error('Cannot toggle selection mode: No domain set');
      return;
    }

    setIsSelectionMode(enabled);
    connection.sendMessage('content-script', {
      type: 'TOGGLE_SELECTION_MODE',
      enabled,
    });
  };

  const handleClearAll = async () => {
    if (!currentDomain) {
      console.error('Cannot clear elements: No domain set');
      return;
    }

    setHiddenElements([]);
    connection.sendMessage('content-script', {
      type: 'CLEAR_ALL',
    });

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: [],
      enabled: true,
    });
  };

  useEffect(() => {
    console.log('Side panel App mounted');

    const port = connection.connect('sidepanel');
    console.log('Side panel connected');

    port.onMessage.addListener(handleMessage);

    return () => {
      console.log('Side panel unmounting');
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
