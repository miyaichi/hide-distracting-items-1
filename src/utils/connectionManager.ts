import { ConnectionName, ConnectionStatus, Message } from '../types/types';
import { Logger } from './logger';

const logger = new Logger('ConnectionManager');

export class ConnectionManager {
  private port: chrome.runtime.Port | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempts = 0;

  /**
   * Established a new connection
   * @param name Connection name
   * @returns Port object
   */
  connect(name: ConnectionName): chrome.runtime.Port {
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
   * Send a message to the target connection
   * @param target Target connection name
   * @param message Message object
   */
  async sendMessage<T extends Message>(
    target: T['target'],
    message: Omit<T, 'target' | 'timestamp'>
  ): Promise<void> {
    logger.debug(`Sending message to ${target}:`, message);

    try {
      await this.ensureConnection(target);
      await this.postMessage(target, message as T);
    } catch (error) {
      logger.error('Message sending failed:', error);
      throw error;
    }
  }

  /**
   * Get the current connection status
   * @returns Connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Disconnect from the current connection
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

  private establishNewConnection(name: ConnectionName): chrome.runtime.Port {
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

  private async ensureConnection(target: ConnectionName): Promise<void> {
    const baseDelay = 100; // Base delay for exponential backoff (Milliseconds)
    const maxDelay = 5000; // Maximum delay for exponential backoff (Milliseconds)

    while (!this.port && this.reconnectAttempts < this.maxReconnectAttempts) {
      // Exponential backoff
      // If you not want to use exponential backoff, you can use the following code:
      // const delay = baseDelay;
      const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay);

      logger.warn('No connection available. Attempting to reconnect...', {
        attempt: this.reconnectAttempts + 1,
        delay,
      });

      this.reconnectAttempts++;
      await this.sleep(delay);

      try {
        this.port = this.connect(target);
      } catch (error) {
        logger.error('Reconnection attempt failed:', error);
      }
    }

    if (!this.port) {
      throw new Error('Failed to establish connection after maximum attempts');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async postMessage<T extends Message>(
    target: T['target'],
    message: Omit<T, 'target' | 'timestamp'>
  ): Promise<void> {
    if (!this.port) {
      throw new Error('No connection available');
    }

    try {
      const enrichedMessage = {
        ...message,
        target,
        timestamp: Date.now(),
      };

      this.port.postMessage(enrichedMessage);
      logger.debug('Message sent successfully', {
        target,
        messageType: message.type,
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
