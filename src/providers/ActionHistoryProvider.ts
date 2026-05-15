import * as vscode from 'vscode';

// ── Action History Provider ──────────────────────────────────────────────────

export interface ReduxAction {
  type: string;
  payload?: unknown;
  timestamp: number;
  duration?: number; // ms to process
  stateDiff?: Record<string, unknown>;
}

export class ActionNode extends vscode.TreeItem {
  constructor(public readonly action: ReduxAction) {
    super(action.type, vscode.TreeItemCollapsibleState.Collapsed);
    const time = new Date(action.timestamp).toLocaleTimeString();
    this.description = `${time}${action.duration ? ` · ${action.duration}ms` : ''}`;
    this.tooltip = JSON.stringify(action, null, 2);
    this.iconPath = new vscode.ThemeIcon('symbol-event');
    this.contextValue = 'action';
  }
}

export class ActionHistoryProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private actions: ReduxAction[] = [];
  private maxHistory = 100;

  addAction(action: ReduxAction) {
    this.actions.unshift(action); // newest first
    if (this.actions.length > this.maxHistory) {
      this.actions = this.actions.slice(0, this.maxHistory);
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  clear() {
    this.actions = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getCount() { return this.actions.length; }
  getAll() { return this.actions; }

  getTreeItem(element: vscode.TreeItem) { return element; }

  getChildren(element?: ActionNode): vscode.TreeItem[] {
    if (!element) {
      if (this.actions.length === 0) {
        const empty = new vscode.TreeItem('No actions dispatched yet');
        empty.iconPath = new vscode.ThemeIcon('info');
        return [empty];
      }
      return this.actions.map(a => new ActionNode(a));
    }

    // Show action details as children
    const items: vscode.TreeItem[] = [];
    if (element.action.payload !== undefined) {
      const payloadItem = new vscode.TreeItem('payload');
      payloadItem.description = JSON.stringify(element.action.payload).substring(0, 60);
      payloadItem.iconPath = new vscode.ThemeIcon('symbol-object');
      items.push(payloadItem);
    }
    if (element.action.duration !== undefined) {
      const durationItem = new vscode.TreeItem('duration');
      durationItem.description = `${element.action.duration}ms`;
      durationItem.iconPath = new vscode.ThemeIcon('clock');
      items.push(durationItem);
    }
    return items;
  }
}

// ── Re-render Detector Provider ──────────────────────────────────────────────

export interface RerenderData {
  component: string;
  count: number;
  file?: string;
  lastSeen: number;
  props?: string[];
}

export class RerenderNode extends vscode.TreeItem {
  constructor(public readonly data: RerenderData) {
    super(data.component, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${data.count}x renders`;
    this.tooltip = `Component: ${data.component}\nRe-renders: ${data.count}\nFile: ${data.file ?? 'unknown'}`;
    this.iconPath = data.count >= 5
      ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'))
      : new vscode.ThemeIcon('info');
    this.contextValue = 'rerender';
  }
}

export class RerenderDetectorProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private rerenders: Map<string, RerenderData> = new Map();

  addRerender(data: RerenderData) {
    const existing = this.rerenders.get(data.component);
    if (existing) {
      existing.count += data.count;
      existing.lastSeen = data.lastSeen;
    } else {
      this.rerenders.set(data.component, { ...data });
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  clear() {
    this.rerenders.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  getCount() { return this.rerenders.size; }
  getAll() { return Array.from(this.rerenders.values()); }

  getTreeItem(element: vscode.TreeItem) { return element; }

  getChildren(element?: RerenderNode): vscode.TreeItem[] {
    if (!element) {
      if (this.rerenders.size === 0) {
        const empty = new vscode.TreeItem('No unnecessary re-renders detected ✅');
        empty.iconPath = new vscode.ThemeIcon('check');
        return [empty];
      }

      // Sort by count descending — worst offenders first
      return Array.from(this.rerenders.values())
        .sort((a, b) => b.count - a.count)
        .map(d => new RerenderNode(d));
    }

    const items: vscode.TreeItem[] = [];
    if (element.data.file) {
      const fileItem = new vscode.TreeItem('Open file');
      fileItem.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(element.data.file)]
      };
      fileItem.iconPath = new vscode.ThemeIcon('go-to-file');
      items.push(fileItem);
    }
    if (element.data.props?.length) {
      const propsItem = new vscode.TreeItem(`Changed props: ${element.data.props.join(', ')}`);
      propsItem.iconPath = new vscode.ThemeIcon('symbol-property');
      items.push(propsItem);
    }
    return items;
  }
}
