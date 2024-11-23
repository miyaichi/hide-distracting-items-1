// src/utils/connectionManager.ts
export class ConnectionManager {
  private port: chrome.runtime.Port | null = null;

  connect(name: string): chrome.runtime.Port {
    console.log(`Connecting as ${name}...`);

    // 既存の接続があれば切断
    if (this.port) {
      console.log('Disconnecting existing connection');
      this.port.disconnect();
    }

    // 新しい接続を確立
    this.port = chrome.runtime.connect({ name });

    this.port.onDisconnect.addListener(() => {
      console.log(`Disconnected: ${name}`);
      this.port = null;
    });

    console.log(`Connected as ${name}`);
    return this.port;
  }

  sendMessage(target: string, message: any) {
    console.log(`Sending message to ${target}:`, message);
    if (this.port) {
      try {
        this.port.postMessage({ target, ...message });
        console.log('Message sent successfully');
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    } else {
      console.error('No connection available. Attempting to reconnect...');
      // 接続を再確立して再試行
      const newPort = this.connect(target);
      newPort.postMessage({ target, ...message });
    }
  }
}
