import * as vscode from 'vscode';
import { ReduxStateTreeProvider } from './providers/ReduxStateTreeProvider';
import { ActionHistoryProvider } from './providers/ActionHistoryProvider';
import { RerenderDetectorProvider } from './providers/RerenderDetectorProvider';
import { ReduxMonitor } from './monitor/ReduxMonitor';
import { WebSocketServer } from './server/WebSocketServer';

let monitor: ReduxMonitor | undefined;
let wsServer: WebSocketServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Redux State Debugger is now active');

  // Initialise providers
  const stateTreeProvider = new ReduxStateTreeProvider();
  const actionHistoryProvider = new ActionHistoryProvider();
  const rerenderDetectorProvider = new RerenderDetectorProvider();

  // Register tree views
  vscode.window.registerTreeDataProvider('reduxStateTree', stateTreeProvider);
  vscode.window.registerTreeDataProvider('reduxActionHistory', actionHistoryProvider);
  vscode.window.registerTreeDataProvider('rerenderDetector', rerenderDetectorProvider);

  // Initialise WebSocket server to receive data from browser DevTools
  wsServer = new WebSocketServer(8765);
  wsServer.onStateUpdate((state) => {
    stateTreeProvider.update(state);
  });
  wsServer.onAction((action) => {
    actionHistoryProvider.addAction(action);
  });
  wsServer.onRerender((rerenderData) => {
    rerenderDetectorProvider.addRerender(rerenderData);
    if (rerenderData.count >= getConfig('rerenderThreshold')) {
      highlightUnnecessaryRerender(rerenderData);
    }
  });

  // Register commands
  const startCmd = vscode.commands.registerCommand('reduxDebugger.start', () => {
    monitor = new ReduxMonitor(wsServer!);
    monitor.start();
    vscode.window.showInformationMessage('Redux Debugger: Monitoring started on port 8765');
  });

  const stopCmd = vscode.commands.registerCommand('reduxDebugger.stop', () => {
    monitor?.stop();
    vscode.window.showInformationMessage('Redux Debugger: Monitoring stopped');
  });

  const clearCmd = vscode.commands.registerCommand('reduxDebugger.clear', () => {
    actionHistoryProvider.clear();
    rerenderDetectorProvider.clear();
    vscode.window.showInformationMessage('Redux Debugger: History cleared');
  });

  const exportCmd = vscode.commands.registerCommand('reduxDebugger.exportReport', async () => {
    const report = generateReport(actionHistoryProvider, rerenderDetectorProvider);
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('redux-performance-report.json'),
      filters: { 'JSON': ['json'] }
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(report, null, 2)));
      vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
    }
  });

  context.subscriptions.push(startCmd, stopCmd, clearCmd, exportCmd);

  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = '$(debug) Redux Debugger';
  statusBar.command = 'reduxDebugger.start';
  statusBar.show();
  context.subscriptions.push(statusBar);
}

function highlightUnnecessaryRerender(rerenderData: { component: string; count: number; file?: string }) {
  const config = vscode.workspace.getConfiguration('reduxDebugger');
  if (!config.get('highlightUnnecessaryRerenders')) return;

  vscode.window.showWarningMessage(
    `⚠️ Unnecessary re-render detected: ${rerenderData.component} rendered ${rerenderData.count} times`,
    'View Details',
    'Dismiss'
  ).then(selection => {
    if (selection === 'View Details' && rerenderData.file) {
      vscode.workspace.openTextDocument(rerenderData.file).then(doc => {
        vscode.window.showTextDocument(doc);
      });
    }
  });
}

function getConfig(key: string) {
  return vscode.workspace.getConfiguration('reduxDebugger').get(key);
}

function generateReport(
  actionHistory: ActionHistoryProvider,
  rerenderDetector: RerenderDetectorProvider
) {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalActions: actionHistory.getCount(),
      unnecessaryRerenders: rerenderDetector.getCount(),
    },
    actions: actionHistory.getAll(),
    rerenders: rerenderDetector.getAll(),
  };
}

export function deactivate() {
  monitor?.stop();
  wsServer?.close();
}
