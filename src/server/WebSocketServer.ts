import * as http from 'http';
import * as vscode from 'vscode';

type StateUpdateHandler = (state: Record<string, unknown>) => void;
type ActionHandler = (action: { type: string; payload?: unknown; timestamp: number; duration?: number }) => void;
type RerenderHandler = (data: { component: string; count: number; file?: string; lastSeen: number }) => void;

/**
 * Simple WebSocket-like server using HTTP long-polling for VS Code extension context.
 * In production, swap this for the 'ws' npm package for true WebSocket support.
 */
export class WebSocketServer {
  private server: http.Server;
  private stateHandlers: StateUpdateHandler[] = [];
  private actionHandlers: ActionHandler[] = [];
  private rerenderHandlers: RerenderHandler[] = [];

  constructor(private port: number) {
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/update') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            this.handleMessage(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400);
            res.end('Invalid JSON');
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(port, () => {
      console.log(`Redux Debugger server listening on port ${port}`);
    });
  }

  private handleMessage(data: { type: string; payload: unknown }) {
    switch (data.type) {
      case 'STATE_UPDATE':
        this.stateHandlers.forEach(h => h(data.payload as Record<string, unknown>));
        break;
      case 'ACTION':
        this.actionHandlers.forEach(h => h(data.payload as Parameters<ActionHandler>[0]));
        break;
      case 'RERENDER':
        this.rerenderHandlers.forEach(h => h(data.payload as Parameters<RerenderHandler>[0]));
        break;
    }
  }

  onStateUpdate(handler: StateUpdateHandler) { this.stateHandlers.push(handler); }
  onAction(handler: ActionHandler) { this.actionHandlers.push(handler); }
  onRerender(handler: RerenderHandler) { this.rerenderHandlers.push(handler); }

  close() { this.server.close(); }
}
