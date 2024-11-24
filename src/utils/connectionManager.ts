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
   * Established a new connection
   * @param name Connection name
   * @returns Port object
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
   * Send a message
   * @param target Target connection name
   * @param message Message object
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
   * Get the current connection status
   * @returns Connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Disconnect the connection forcibly
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
          currentAttempts: this.reconnectAttempts,
        });
        throw new Error(error);
      }

      logger.warn('No connection available. Attempting to reconnect...', {
        attempt: this.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts,
      });

      this.reconnectAttempts++;
      this.port = this.connect(target);

      // Wait for a short time until the connection is established
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
