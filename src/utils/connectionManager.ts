// src/utils/connectionManager.ts

// メッセージの型定義
interface Message {
  type: string;
  target?: string;
  enabled?: boolean;
  identifier?: any;
  payload?: any;
}

// 接続の状態を表す型
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export class ConnectionManager {
  private port: chrome.runtime.Port | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempts = 0;

  /**
   * 新しい接続を確立する
   * @param name 接続名
   * @returns 確立された接続ポート
   */
  connect(name: string): chrome.runtime.Port {
    try {
      console.log(`[connectionManager] Connecting as ${name}...`);
      this.connectionStatus = 'connecting';

      this.disconnectExistingPort();
      return this.establishNewConnection(name);
    } catch (error) {
      console.error('[connectionManager] Connection error:', error);
      this.connectionStatus = 'disconnected';
      throw new Error(`Failed to establish connection as ${name}`);
    }
  }

  /**
   * メッセージを送信する
   * @param target 送信先
   * @param message 送信メッセージ
   */
  async sendMessage(target: string, message: Message): Promise<void> {
    console.log(`[connectionManager] Sending message to ${target}:`, message);

    try {
      await this.ensureConnection(target);
      await this.postMessage(target, message);
    } catch (error) {
      console.error('[connectionManager] Message sending failed:', error);
      throw error;
    }
  }

  /**
   * 現在の接続状態を取得
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * 接続を強制的に切断
   */
  disconnect(): void {
    this.disconnectExistingPort();
  }

  private disconnectExistingPort(): void {
    if (this.port) {
      console.log('[connectionManager] Disconnecting existing connection');
      try {
        this.port.disconnect();
      } catch (error) {
        console.warn('Error during disconnection:', error);
      }
      this.port = null;
      this.connectionStatus = 'disconnected';
    }
  }

  private establishNewConnection(name: string): chrome.runtime.Port {
    const newPort = chrome.runtime.connect({ name });

    newPort.onDisconnect.addListener(() => {
      console.log(`[connectionManager] Disconnected: ${name}`);
      this.handleDisconnection();
    });

    this.port = newPort;
    this.connectionStatus = 'connected';
    this.reconnectAttempts = 0;
    console.log(`[connectionManager] Connected as ${name}`);

    return newPort;
  }

  private async ensureConnection(target: string): Promise<void> {
    if (!this.port) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Max reconnection attempts reached');
      }

      console.log('[connectionManager] No connection available. Attempting to reconnect...');
      this.reconnectAttempts++;
      this.port = this.connect(target);

      // 接続が確立されるまで短い待機
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async postMessage(target: string, message: Message): Promise<void> {
    if (!this.port) {
      throw new Error('No connection available');
    }

    try {
      const enrichedMessage = {
        target,
        timestamp: Date.now(),
        ...message,
      };

      this.port.postMessage(enrichedMessage);
      console.log('[connectionManager] Message sent successfully');
    } catch (error) {
      console.error('[connectionManager] Failed to send message:', error);
      this.handleDisconnection();
      throw error;
    }
  }

  private handleDisconnection(): void {
    this.port = null;
    this.connectionStatus = 'disconnected';
    // 接続状態の変更をログに記録
    console.log('[connectionManager] Connection status changed to:', this.connectionStatus);
  }
}
