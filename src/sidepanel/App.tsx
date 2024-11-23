// src/sidepanel/App.tsx
import React, { useEffect, useState } from 'react';
import { ElementIdentifier } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { StorageManager } from '../utils/storageManager';
import { Controls } from './components/Controls';
import { ElementTree } from './components/ElementTree';

export const App: React.FC = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hiddenElements, setHiddenElements] = useState<ElementIdentifier[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [connection] = useState(() => new ConnectionManager());

  useEffect(() => {
    console.log('Side panel App mounted');

    // Get current tab's domain and load settings
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (tab.url) {
        const domain = new URL(tab.url).hostname;
        console.log('Current domain:', domain);
        setCurrentDomain(domain);
        const settings = await StorageManager.getDomainSettings(domain);
        console.log('Loaded settings:', settings);
        setHiddenElements(settings.hiddenElements);
      }
    });

    // Setup message listeners
    const port = connection.connect('sidepanel');
    console.log('Side panel connected');

    port.onMessage.addListener((message) => {
      console.log('Side panel received message:', message);
      if (message.type === 'ELEMENT_SELECTED') {
        handleElementSelected(message.identifier);
      }
    });

    return () => {
      console.log('Side panel unmounting');
      port.disconnect();
    };
  }, []);

  const handleElementSelected = async (element: ElementIdentifier) => {
    const newElements = [...hiddenElements, element];
    setHiddenElements(newElements);

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleRemoveElement = async (element: ElementIdentifier) => {
    const newElements = hiddenElements.filter((e) => e.domPath !== element.domPath);
    setHiddenElements(newElements);

    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: newElements,
      enabled: true,
    });
  };

  const handleToggleSelectionMode = (enabled: boolean) => {
    setIsSelectionMode(enabled);
    connection.sendMessage('content-script', {
      type: 'TOGGLE_SELECTION_MODE',
      enabled,
    });
  };

  const handleClearAll = async () => {
    setHiddenElements([]);
    await StorageManager.saveDomainSettings(currentDomain, {
      hiddenElements: [],
      enabled: true,
    });
  };

  return (
    <div className="side-panel-container">
      <div className="side-panel-header">
        <h1 className="text-xl font-bold">Hide Distracting Elements</h1>
        {currentDomain && <p className="text-sm text-gray-500 mt-1">{currentDomain}</p>}
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
