import * as vscode from 'vscode';
import { DebugSession } from '../debug/DebugSession';
import { getDashboardHtml } from './DashboardPanel';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'reduxDashboard';

  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly resolveWaiters: Array<() => void> = [];

  constructor(private readonly session: DebugSession) {
    this.disposables.push(
      this.session.onDidChange(snapshot => {
        this.view?.webview.postMessage({ type: 'snapshot', snapshot });
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = getDashboardHtml(this.session.getSnapshot());

    webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });

    while (this.resolveWaiters.length) {
      this.resolveWaiters.pop()?.();
    }
  }

  reveal() {
    this.view?.show?.(true);
    this.view?.webview.postMessage({
      type: 'snapshot',
      snapshot: this.session.getSnapshot(),
    });
  }

  isResolved() {
    return this.view !== undefined;
  }

  waitForResolve(timeoutMs = 750) {
    if (this.view) return Promise.resolve(true);

    return new Promise<boolean>(resolve => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);
      this.resolveWaiters.push(() => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  dispose() {
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
