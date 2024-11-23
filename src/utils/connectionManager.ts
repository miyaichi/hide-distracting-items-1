// src/utils/connectionManager.ts
export class ConnectionManager {
  private connections: { [key: string]: chrome.runtime.Port } = {};

  connect(name: string) {
    console.log(`Connecting as ${name}...`);
    const port = chrome.runtime.connect({ name });

    port.onDisconnect.addListener(() => {
      console.log(`Disconnected: ${name}`);
      delete this.connections[name];
    });

    this.connections[name] = port;
    console.log(`Connected as ${name}`);
    return port;
  }

  sendMessage(target: string, message: any) {
    console.log(`Sending message to ${target}:`, message);
    if (this.connections[target]) {
      this.connections[target].postMessage(message);
    } else {
      console.error(`No connection found for ${target}`);
    }
  }
}
