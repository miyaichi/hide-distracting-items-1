// src/background/background.ts
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// サイドパネルの有効化
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

let connections: { [key: string]: chrome.runtime.Port } = {};

chrome.runtime.onConnect.addListener((port) => {
  console.log('New connection:', port.name);

  connections[port.name] = port;

  port.onMessage.addListener((message) => {
    console.log('Received message in background:', message);

    // 他のコンポーネントにメッセージを転送
    Object.keys(connections).forEach((connectionName) => {
      if (connectionName !== port.name) {
        connections[connectionName].postMessage(message);
      }
    });
  });

  port.onDisconnect.addListener(() => {
    console.log('Disconnected:', port.name);
    delete connections[port.name];
  });
});
