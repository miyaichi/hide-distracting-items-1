// src/background/background.ts
let connections: { [key: string]: chrome.runtime.Port } = {};
let currentDomain: string | null = null;

// サイドパネルの有効化
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  connections = {};
});

chrome.runtime.onConnect.addListener((port) => {
  console.log('New connection:', port.name);

  if (connections[port.name]) {
    console.log('Disconnecting existing connection:', port.name);
    connections[port.name].disconnect();
  }

  connections[port.name] = port;

  port.onMessage.addListener((message) => {
    console.log('Received message in background:', message);

    if (message.type === 'DOMAIN_INFO') {
      currentDomain = message.payload.domain;
      // サイドパネルに転送
      if (connections['sidepanel']) {
        connections['sidepanel'].postMessage({
          type: 'DOMAIN_INFO',
          payload: message.payload,
        });
      }
    } else {
      // 他のメッセージの転送
      Object.entries(connections).forEach(([name, connection]) => {
        if (name !== port.name) {
          try {
            connection.postMessage(message);
          } catch (error) {
            console.error(`Failed to forward message to ${name}:`, error);
          }
        }
      });
    }
  });

  // 新しい接続がサイドパネルの場合、現在のドメイン情報を送信
  if (port.name === 'sidepanel' && currentDomain) {
    port.postMessage({
      type: 'DOMAIN_INFO',
      payload: {
        domain: currentDomain,
      },
    });
  }

  port.onDisconnect.addListener(() => {
    console.log('Disconnected:', port.name);
    delete connections[port.name];
  });
});
