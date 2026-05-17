import { WebSocketServer } from '../server/WebSocketServer';

export class ReduxMonitor {
  private running = false;

  constructor(private readonly server: WebSocketServer) {}

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  isRunning() {
    return this.running && this.server.isListening();
  }
}
