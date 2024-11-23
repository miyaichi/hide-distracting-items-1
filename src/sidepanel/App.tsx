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

    const port = connection.connect('sidepanel');
    console.log('Side panel connected');

    port.onMessage.addListener((message) => {
      console.log('Side panel received message:', message);

      switch (message.type) {
        case 'DOMAIN_INFO':
          const domain = message.payload.domain;
          console.log('Received domain info:', domain);
          setCurrentDomain(domain);
          // ドメインが設定されたら設定を読み込む
          StorageManager.getDomainSettings(domain).then((settings) => {
            console.log('Loaded settings for domain:', domain, settings);
            setHiddenElements(settings.hiddenElements);
          });
          break;

        case 'ELEMENT_SELECTED':
          // ドメイン情報をメッセージから取得
          const { identifier, domain: messageDomain } = message.payload;
          handleElementSelected(identifier, messageDomain);
          break;
      }
    });

    return () => {
      console.log('Side panel unmounting');
      port.disconnect();
    };
  }, []);

  const handleElementSelected = async (element: ElementIdentifier, domain: string) => {
    // currentDomainの状態に依存せず、メッセージから受け取ったドメインを使用
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

    // コンテンツスクリプトに要素を表示するよう通知
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
    setIsSelectionMode(enabled);
    connection.sendMessage('content-script', {
      type: 'TOGGLE_SELECTION_MODE',
      enabled,
    });
  };

  const handleClearAll = async () => {
    if (!currentDomain) {
      console.error('No current domain set');
      return;
    }

    setHiddenElements([]);

    // コンテンツスクリプトにすべての要素を表示するよう通知
    connection.sendMessage('content-script', {
      type: 'CLEAR_ALL',
    });

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
