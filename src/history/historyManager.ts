import * as vscode from 'vscode';
import { ReviewResult } from '../types';
import { Logger } from '../utils/logger';

export interface HistoryRecord {
  id: string;
  timestamp: string;
  fileName: string;
  filePath: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  result: ReviewResult;
}

/**
 * Persists and manages past code review records in VS Code storage.
 */
export class HistoryManager {
  private static instance: HistoryManager;
  private static readonly STORAGE_KEY = 'fixora.reviewHistory';
  private static readonly MAX_HISTORY = 25;

  private logger = Logger.getInstance();

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public static initialize(context: vscode.ExtensionContext): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager(context);
    }
    return HistoryManager.instance;
  }

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      throw new Error('HistoryManager must be initialized before use.');
    }
    return HistoryManager.instance;
  }

  /**
   * Save a completed review run to persistent history.
   */
  public async addRecord(result: ReviewResult): Promise<void> {
    const history = this.getHistory();
    const primaryFile = result.filesAnalyzed[0] || 'Unknown';
    const fileName = primaryFile.split(/[\\/]/).pop() || 'Unknown';

    const newRecord: HistoryRecord = {
      id: `history-${Date.now()}`,
      timestamp: result.timestamp,
      fileName,
      filePath: primaryFile,
      totalIssues: result.totalIssues,
      criticalCount: result.criticalCount,
      warningCount: result.warningCount,
      result,
    };

    history.unshift(newRecord);
    const trimmed = history.slice(0, HistoryManager.MAX_HISTORY);

    await this.context.globalState.update(HistoryManager.STORAGE_KEY, trimmed);
    this.logger.info(`Saved review history record for ${fileName}. Total records: ${trimmed.length}`);
  }

  /**
   * Retrieve all persisted history records.
   */
  public getHistory(): HistoryRecord[] {
    return this.context.globalState.get<HistoryRecord[]>(HistoryManager.STORAGE_KEY, []);
  }

  /**
   * Search history records by file name, path, or finding content with optional severity filter.
   */
  public search(query: string, severity?: 'critical' | 'warning' | 'info'): HistoryRecord[] {
    const history = this.getHistory();
    const q = (query || '').toLowerCase().trim();

    return history.filter((rec) => {
      if (severity && rec.result.findings.every((f) => f.severity !== severity)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        rec.fileName.toLowerCase().includes(q) ||
        rec.filePath.toLowerCase().includes(q) ||
        rec.result.findings.some(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            f.explanation.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q)
        )
      );
    });
  }

  /**
   * Retrieve a specific history record by ID.
   */
  public getRecordById(id: string): HistoryRecord | undefined {
    return this.getHistory().find((rec) => rec.id === id);
  }

  /**
   * Export history records or a single record to formatted JSON.
   */
  public exportToJson(recordId?: string): string {
    if (recordId) {
      const rec = this.getRecordById(recordId);
      return JSON.stringify(rec || {}, null, 2);
    }
    return JSON.stringify(this.getHistory(), null, 2);
  }

  /**
   * Clear all stored history records.
   */
  public async clearHistory(): Promise<void> {
    await this.context.globalState.update(HistoryManager.STORAGE_KEY, []);
    this.logger.info('Cleared Fixora review history.');
  }
}
