import * as http from 'http';
import * as vscode from 'vscode';

type StateUpdateHandler = (state: Record<string, unknown>) => void;
type ActionHandler = (action: { type: string; payload?: unknown; timestamp: number; duration?: number }) => void;
type RerenderHandler = (data: { component: string; count: number; file?: string; lastSeen: number }) => void;
type ErrorHandler = (error: Error) => void;

/**
 * Simple WebSocket-like server using HTTP long-polling for VS Code extension context.
 * In production, swap this for the 'ws' npm package for true WebSocket support.
 */
export class WebSocketServer {
  private server: http.Server;
  private stateHandlers: StateUpdateHandler[] = [];
  private actionHandlers: ActionHandler[] = [];
  private rerenderHandlers: RerenderHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private listening = false;
  private stats = {
    actions: 0,
    stateUpdates: 0,
    rerenders: 0,
    invalidMessages: 0,
    startedAt: Date.now(),
  };

  constructor(private port: number) {
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'GET' && (req.url === '/' || req.url === '/health' || req.url === '/update')) {
        this.sendJson(res, 200, {
          ok: true,
          service: 'Redux State Debugger',
          port: this.port,
          endpoint: `http://localhost:${this.port}/update`,
          usage: 'Send POST requests with { "type": "ACTION" | "STATE_UPDATE" | "RERENDER", "payload": ... }',
          stats: this.stats,
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/update') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const accepted = this.handleMessage(data);
            if (!accepted) {
              this.stats.invalidMessages++;
              this.sendJson(res, 400, {
                ok: false,
                error: 'Unsupported message. Expected ACTION, STATE_UPDATE, or RERENDER.',
              });
              return;
            }
            this.sendJson(res, 200, { ok: true, stats: this.stats });
          } catch {
            this.stats.invalidMessages++;
            this.sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(port, () => {
      this.listening = true;
      console.log(`Redux Debugger server listening on port ${port}`);
    });

    this.server.on('error', error => {
      this.errorHandlers.forEach(handler => handler(error));
    });

    this.server.on('close', () => {
      this.listening = false;
    });
  }

  private handleMessage(data: { type?: string; payload?: unknown }) {
    switch (data.type) {
      case 'STATE_UPDATE':
        this.stats.stateUpdates++;
        this.stateHandlers.forEach(h => h(data.payload as Record<string, unknown>));
        return true;
      case 'ACTION':
        this.stats.actions++;
        this.actionHandlers.forEach(h => h(data.payload as Parameters<ActionHandler>[0]));
        return true;
      case 'RERENDER':
        this.stats.rerenders++;
        this.rerenderHandlers.forEach(h => h(data.payload as Parameters<RerenderHandler>[0]));
        return true;
      default:
        return false;
    }
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  onStateUpdate(handler: StateUpdateHandler) { this.stateHandlers.push(handler); }
  onAction(handler: ActionHandler) { this.actionHandlers.push(handler); }
  onRerender(handler: RerenderHandler) { this.rerenderHandlers.push(handler); }
  onError(handler: ErrorHandler) { this.errorHandlers.push(handler); }

  isListening() { return this.listening; }
  getPort() { return this.port; }
  getStats() { return { ...this.stats }; }

  close() { this.server.close(); }
}
