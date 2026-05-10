import * as vscode from 'vscode';

export class ReduxStateNode extends vscode.TreeItem {
  children: ReduxStateNode[] = [];

  constructor(
    public readonly label: string,
    public readonly value: unknown,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    this.description = this.formatValue(value);
    this.iconPath = this.getIcon(value);
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `Array(${value.length})`;
      return `Object(${Object.keys(value as object).length})`;
    }
    const str = String(value);
    return str.length > 40 ? str.substring(0, 40) + '...' : str;
  }

  private getIcon(value: unknown): vscode.ThemeIcon {
    if (value === null || value === undefined) return new vscode.ThemeIcon('circle-slash');
    if (typeof value === 'boolean') return new vscode.ThemeIcon('symbol-boolean');
    if (typeof value === 'number') return new vscode.ThemeIcon('symbol-number');
    if (typeof value === 'string') return new vscode.ThemeIcon('symbol-string');
    if (Array.isArray(value)) return new vscode.ThemeIcon('symbol-array');
    return new vscode.ThemeIcon('symbol-object');
  }
}

export class ReduxStateTreeProvider implements vscode.TreeDataProvider<ReduxStateNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ReduxStateNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private state: Record<string, unknown> = {};
  private lastUpdateTime: Date | undefined;

  update(newState: Record<string, unknown>) {
    this.state = newState;
    this.lastUpdateTime = new Date();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ReduxStateNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ReduxStateNode): ReduxStateNode[] {
    if (!element) {
      if (Object.keys(this.state).length === 0) {
        return [new ReduxStateNode(
          'No state yet — start your app and connect Redux Debugger',
          undefined,
          vscode.TreeItemCollapsibleState.None
        )];
      }
      return this.buildNodes(this.state);
    }
    return element.children;
  }

  private buildNodes(obj: Record<string, unknown>, depth = 0): ReduxStateNode[] {
    if (depth > 5) return []; // prevent infinite recursion on deeply nested state

    return Object.entries(obj).map(([key, value]) => {
      const isExpandable = typeof value === 'object' && value !== null;
      const node = new ReduxStateNode(
        key,
        value,
        isExpandable
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );

      if (isExpandable) {
        node.children = this.buildNodes(
          Array.isArray(value)
            ? Object.fromEntries(value.map((v, i) => [i, v]))
            : value as Record<string, unknown>,
          depth + 1
        );
      }

      return node;
    });
  }
}
