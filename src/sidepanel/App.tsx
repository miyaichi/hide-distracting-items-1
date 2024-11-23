// src/sidepanel/App.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ElementIdentifier } from '../types/types';
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

interface DomainSettings {
  hiddenElements: ElementIdentifier[];
  enabled: boolean;
}

export const App: React.FC = () => {
  // State管理
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hiddenElements, setHiddenElements] = useState<ElementIdentifier[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [connection] = useState(() => new ConnectionManager());

  // ドメイン設定の読み込み
  const loadDomainSettings = useCallback(async (domain: string) => {
    try {
      const settings = await StorageManager.getDomainSettings(domain);
      console.log('Loaded settings for domain:', domain, settings);
      setHiddenElements(settings.hiddenElements);
    } catch (error) {
      console.error('Error loading domain settings:', error);
    }
  }, []);

  // ドメイン設定の保存
  const saveDomainSettings = useCallback(async (domain: string, elements: ElementIdentifier[]) => {
    try {
      await StorageManager.saveDomainSettings(domain, {
        hiddenElements: elements,
        enabled: true,
      });
    } catch (error) {
      console.error('Error saving domain settings:', error);
    }
  }, []);

  // メッセージハンドラ
  const handleMessage = useCallback(
    async (message: MessagePayload) => {
      console.log('Side panel received message:', message);

      switch (message.type) {
        case 'DOMAIN_INFO': {
          const domain = message.payload?.domain;
          if (domain) {
            console.log('Received domain info:', domain);
            setCurrentDomain(domain);
            await loadDomainSettings(domain);
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
    [loadDomainSettings]
  );

  // 要素選択のハンドラ
  const handleElementSelected = async (element: ElementIdentifier, domain: string) => {
    console.log('Handling element selection for domain:', domain);
    const newElements = [...hiddenElements, element];
    setHiddenElements(newElements);
    await saveDomainSettings(domain, newElements);
  };

  // 要素削除のハンドラ
  const handleRemoveElement = async (element: ElementIdentifier) => {
    if (!currentDomain) {
      console.error('No current domain set');
      return;
    }

    const newElements = hiddenElements.filter((e) => e.domPath !== element.domPath);
    setHiddenElements(newElements);

    // 要素を表示
    connection.sendMessage('content-script', {
      type: 'SHOW_ELEMENT',
      identifier: element,
    });

    await saveDomainSettings(currentDomain, newElements);
  };

  // 選択モード切り替えのハンドラ
  const handleToggleSelectionMode = useCallback(
    (enabled: boolean) => {
      setIsSelectionMode(enabled);
      connection.sendMessage('content-script', {
        type: 'TOGGLE_SELECTION_MODE',
        enabled,
      });
    },
    [connection]
  );

  // 全要素クリアのハンドラ
  const handleClearAll = async () => {
    if (!currentDomain) {
      console.error('No current domain set');
      return;
    }

    setHiddenElements([]);
    connection.sendMessage('content-script', { type: 'CLEAR_ALL' });
    await saveDomainSettings(currentDomain, []);
  };

  // 接続の設定
  useEffect(() => {
    console.log('Side panel App mounted');

    const port = connection.connect('sidepanel');
    console.log('Side panel connected');

    port.onMessage.addListener(handleMessage);

    return () => {
      console.log('Side panel unmounting');
      port.disconnect();
    };
  }, [connection, handleMessage]);

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
