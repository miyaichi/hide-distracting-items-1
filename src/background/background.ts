// src/background/background.ts
interface Connection {
  [key: string]: chrome.runtime.Port;
}

interface DomainInfo {
  domain: string;
  url?: string;
}

// グローバル状態の管理
const state = {
  connections: {} as Connection,
  currentDomain: null as string | null,
};

// サイドパネルの初期設定
const initializeSidePanel = async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error('Failed to set panel behavior:', error);
  }
};

// メッセージの転送処理
const forwardMessage = (sourcePort: chrome.runtime.Port, message: any) => {
  console.log(`[background] Forwarding message from ${sourcePort.name}:`, message);
  Object.entries(state.connections).forEach(([name, connection]) => {
    if (name !== sourcePort.name) {
      try {
        console.log(`[Background] Forwarding message to ${name}:`, message);
        connection.postMessage(message);
      } catch (error) {
        console.error(`Failed to forward message to ${name}:`, error);
      }
    }
  });
};

// ドメイン情報の処理
const handleDomainInfo = (message: { payload: DomainInfo }) => {
  state.currentDomain = message.payload.domain;

  if (state.connections['sidepanel']) {
    console.log('[background] POSTING DOMAIN INFO:', message.payload);
    state.connections['sidepanel'].postMessage({
      type: 'DOMAIN_INFO',
      payload: message.payload,
    });
  }
};

// ポート接続の管理
const handlePortConnection = (port: chrome.runtime.Port) => {
  console.log('[background] New connection:', port.name);

  // 既存の接続を切断
  if (state.connections[port.name]) {
    console.log('[background] Disconnecting existing connection:', port.name);
    state.connections[port.name].disconnect();
  }

  // 新しい接続を保存
  state.connections[port.name] = port;

  // メッセージリスナーの設定
  port.onMessage.addListener((message) => {
    console.log('[background] Received message in background:', message);
    if (message.type === 'DOMAIN_INFO') {
      handleDomainInfo(message);
    } else {
      forwardMessage(port, message);
    }
  });

  // サイドパネル接続時の初期化
  if (port.name === 'sidepanel' && state.currentDomain) {
    console.log('[background] POSTING DOMAIN INFO:', state.currentDomain);
    port.postMessage({
      type: 'DOMAIN_INFO',
      payload: { domain: state.currentDomain },
    });
  }

  // 切断ハンドラの設定
  port.onDisconnect.addListener(() => {
    console.log('[background] Disconnected:', port.name);
    delete state.connections[port.name];
  });
};

// 拡張機能のインストール/更新時の初期化
chrome.runtime.onInstalled.addListener(() => {
  console.log('[background] Extension installed');
  state.connections = {};
});

// ポート接続リスナーの設定
chrome.runtime.onConnect.addListener(handlePortConnection);

// サイドパネルの初期化
initializeSidePanel();
