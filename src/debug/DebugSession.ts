import * as vscode from 'vscode';
import { ReduxAction, RerenderData } from '../providers/ActionHistoryProvider';

export interface SliceSummary {
  name: string;
  type: string;
  size: number;
  keys: number;
  lastChangedBy?: string;
  lastChangedAt?: number;
  value: unknown;
}

export interface DebugSnapshot {
  state: Record<string, unknown>;
  slices: SliceSummary[];
  actions: ReduxAction[];
  rerenders: RerenderData[];
  lastUpdatedAt?: number;
}

export class DebugSession {
  private readonly _onDidChange = new vscode.EventEmitter<DebugSnapshot>();
  readonly onDidChange = this._onDidChange.event;

  private state: Record<string, unknown> = {};
  private actions: ReduxAction[] = [];
  private rerenders: RerenderData[] = [];
  private sliceChanges = new Map<string, { action: string; timestamp: number }>();
  private lastUpdatedAt: number | undefined;

  constructor(private readonly maxActions = 100) {}

  updateState(state: Record<string, unknown>) {
    this.state = state;
    this.lastUpdatedAt = Date.now();
    this.emit();
  }

  addAction(action: ReduxAction) {
    this.actions.unshift(action);
    this.actions = this.actions.slice(0, this.maxActions);
    const changedSlices = action.changedSlices ?? Object.keys(action.stateDiff ?? {});
    changedSlices.forEach(slice => {
      this.sliceChanges.set(slice, {
        action: action.type,
        timestamp: action.timestamp,
      });
    });
    this.lastUpdatedAt = Date.now();
    this.emit();
  }

  addRerender(data: RerenderData) {
    const existing = this.rerenders.find(item => item.component === data.component);
    if (existing) {
      existing.count += data.count;
      existing.lastSeen = data.lastSeen;
      existing.props = data.props ?? existing.props;
      existing.file = data.file ?? existing.file;
    } else {
      this.rerenders.push({ ...data });
    }
    this.rerenders.sort((a, b) => b.count - a.count);
    this.lastUpdatedAt = Date.now();
    this.emit();
  }

  clear() {
    this.state = {};
    this.actions = [];
    this.rerenders = [];
    this.sliceChanges.clear();
    this.lastUpdatedAt = undefined;
    this.emit();
  }

  getSnapshot(): DebugSnapshot {
    return {
      state: this.state,
      slices: this.getSlices(),
      actions: this.actions,
      rerenders: this.rerenders,
      lastUpdatedAt: this.lastUpdatedAt,
    };
  }

  private getSlices(): SliceSummary[] {
    return Object.entries(this.state).map(([name, value]) => {
      const change = this.sliceChanges.get(name);
      return {
        name,
        type: getValueType(value),
        size: getJsonSize(value),
        keys: getKeyCount(value),
        lastChangedBy: change?.action,
        lastChangedAt: change?.timestamp,
        value,
      };
    });
  }

  private emit() {
    this._onDidChange.fire(this.getSnapshot());
  }
}

function getValueType(value: unknown) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function getKeyCount(value: unknown) {
  if (value === null || typeof value !== 'object') return 0;
  return Object.keys(value as object).length;
}

function getJsonSize(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}
