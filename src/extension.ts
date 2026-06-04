import * as vscode from 'vscode';
import { ReduxStateTreeProvider } from './providers/ReduxStateTreeProvider';
import { ActionHistoryProvider, RerenderDetectorProvider } from './providers/ActionHistoryProvider';
import { ReduxMonitor } from './monitor/ReduxMonitor';
import { WebSocketServer } from './server/WebSocketServer';
import { DebugSession } from './debug/DebugSession';
import { DashboardPanel } from './webview/DashboardPanel';
import { DashboardViewProvider } from './webview/DashboardViewProvider';

let monitor: ReduxMonitor | undefined;
let wsServer: WebSocketServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Redux State Debugger is now active');
  const port = getNumberConfig('port', 8765);

  // Initialise providers
  const stateTreeProvider = new ReduxStateTreeProvider();
  const actionHistoryProvider = new ActionHistoryProvider();
  const rerenderDetectorProvider = new RerenderDetectorProvider();
  const debugSession = new DebugSession(getNumberConfig('maxActionHistory', 100));
  actionHistoryProvider.setMaxHistory(getNumberConfig('maxActionHistory', 100));
  const dashboardViewProvider = new DashboardViewProvider(debugSession);

  // Register tree views
  vscode.window.registerTreeDataProvider('reduxStateTree', stateTreeProvider);
  vscode.window.registerTreeDataProvider('reduxActionHistory', actionHistoryProvider);
  vscode.window.registerTreeDataProvider('rerenderDetector', rerenderDetectorProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DashboardViewProvider.viewType,
      dashboardViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    dashboardViewProvider
  );

  // Status bar item
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = `$(debug) Redux Debugger :${port}`;
  statusBar.tooltip = `Redux Debugger listening at http://localhost:${port}/update`;
  statusBar.command = 'reduxDebugger.start';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const refreshStatus = () => {
    const stats = wsServer?.getStats();
    statusBar.text = stats
      ? `$(debug) Redux ${stats.actions} actions`
      : `$(debug) Redux Debugger :${port}`;
  };

  // Initialise HTTP server to receive data from React apps
  wsServer = new WebSocketServer(port);
  wsServer.onError((error) => {
    vscode.window.showErrorMessage(
      `Redux Debugger could not listen on port ${port}: ${error.message}. Change reduxDebugger.port in VS Code settings.`
    );
  });
  wsServer.onStateUpdate((state) => {
    debugSession.updateState(state);
    stateTreeProvider.update(state);
    refreshStatus();
  });
  wsServer.onAction((action) => {
    debugSession.addAction(action);
    actionHistoryProvider.addAction(action);
    refreshStatus();
  });
  wsServer.onRerender((rerenderData) => {
    debugSession.addRerender(rerenderData);
    rerenderDetectorProvider.addRerender(rerenderData);
    refreshStatus();
    if (rerenderData.count >= getNumberConfig('rerenderThreshold', 3)) {
      highlightUnnecessaryRerender(rerenderData);
    }
  });

  // Register commands
  const startCmd = vscode.commands.registerCommand('reduxDebugger.start', () => {
    monitor = new ReduxMonitor(wsServer!);
    monitor.start();
    vscode.window.showInformationMessage(`Redux Debugger: Monitoring at http://localhost:${port}/update`);
  });

  const stopCmd = vscode.commands.registerCommand('reduxDebugger.stop', () => {
    monitor?.stop();
    vscode.window.showInformationMessage('Redux Debugger: Monitoring stopped');
  });

  const clearCmd = vscode.commands.registerCommand('reduxDebugger.clear', () => {
    debugSession.clear();
    stateTreeProvider.clear();
    actionHistoryProvider.clear();
    rerenderDetectorProvider.clear();
    vscode.window.showInformationMessage('Redux Debugger: History cleared');
    refreshStatus();
  });

  const dashboardCmd = vscode.commands.registerCommand('reduxDebugger.openDashboard', () => {
    vscode.commands.executeCommand('workbench.view.extension.reduxDebugger');
    vscode.commands.executeCommand('reduxDashboard.focus');
    dashboardViewProvider.reveal();
  });

  const dashboardEditorCmd = vscode.commands.registerCommand('reduxDebugger.openDashboardEditor', () => {
    DashboardPanel.show(context, debugSession);
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

  const copySetupCmd = vscode.commands.registerCommand('reduxDebugger.copySetupSnippet', async () => {
    const snippet = `import { reduxDebuggerMiddleware } from 'redux-state-debugger/middleware';

const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(
      reduxDebuggerMiddleware({
        port: ${port},
        enabled: process.env.NODE_ENV === 'development',
      })
    ),
});`;

    await vscode.env.clipboard.writeText(snippet);
    vscode.window.showInformationMessage('Redux Debugger middleware setup copied to clipboard');
  });

  context.subscriptions.push(startCmd, stopCmd, clearCmd, exportCmd, copySetupCmd, dashboardCmd, dashboardEditorCmd);
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

function getNumberConfig(key: string, fallback: number) {
  const value = getConfig(key);
  return typeof value === 'number' ? value : fallback;
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
