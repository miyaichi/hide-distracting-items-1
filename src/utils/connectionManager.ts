import { Logger } from './logger';

const logger = new Logger('ConnectionManager');

interface Message {
  type: string;
  target?: string;
  enabled?: boolean;
  identifier?: any;
  payload?: any;
}

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
      logger.log(`Connecting as ${name}...`);
      this.connectionStatus = 'connecting';

      this.disconnectExistingPort();
      return this.establishNewConnection(name);
    } catch (error) {
      logger.error('Connection error:', error);
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
    logger.debug(`Sending message to ${target}:`, message);

    try {
      await this.ensureConnection(target);
      await this.postMessage(target, message);
    } catch (error) {
      logger.error('Message sending failed:', error);
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
      logger.debug('Disconnecting existing connection');
      try {
        this.port.disconnect();
      } catch (error) {
        logger.warn('Error during disconnection:', error);
      }
      this.port = null;
      this.connectionStatus = 'disconnected';
    }
  }

  private establishNewConnection(name: string): chrome.runtime.Port {
    const newPort = chrome.runtime.connect({ name });

    newPort.onDisconnect.addListener(() => {
      logger.log(`Disconnected: ${name}`);
      this.handleDisconnection();
    });

    this.port = newPort;
    this.connectionStatus = 'connected';
    this.reconnectAttempts = 0;
    logger.log(`Successfully connected as ${name}`);

    return newPort;
  }

  private async ensureConnection(target: string): Promise<void> {
    if (!this.port) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        const error = 'Max reconnection attempts reached';
        logger.error(error, {
          maxAttempts: this.maxReconnectAttempts,
          currentAttempts: this.reconnectAttempts
        });
        throw new Error(error);
      }

      logger.warn('No connection available. Attempting to reconnect...', {
        attempt: this.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts
      });
      
      this.reconnectAttempts++;
      this.port = this.connect(target);

      // 接続が確立されるまで短い待機
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async postMessage(target: string, message: Message): Promise<void> {
    if (!this.port) {
      const error = 'No connection available';
      logger.error(error);
      throw new Error(error);
    }

    try {
      const enrichedMessage = {
        target,
        timestamp: Date.now(),
        ...message,
      };

      this.port.postMessage(enrichedMessage);
      logger.debug('Message sent successfully', {
        target,
        messageType: message.type
      });
    } catch (error) {
      logger.error('Failed to send message:', error);
      this.handleDisconnection();
      throw error;
    }
  }

  private handleDisconnection(): void {
    this.port = null;
    this.connectionStatus = 'disconnected';
    logger.log('Connection status changed to:', this.connectionStatus);
  }
}