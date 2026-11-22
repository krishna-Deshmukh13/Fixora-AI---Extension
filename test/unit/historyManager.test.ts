import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager, HistoryRecord } from '../../src/history/historyManager';
import { ReviewResult } from '../../src/types';

describe('HistoryManager', () => {
  let mockStorage: Record<string, any>;
  let mockContext: any;

  beforeEach(() => {
    mockStorage = {};
    mockContext = {
      globalState: {
        get: (key: string, defaultVal: any) => mockStorage[key] ?? defaultVal,
        update: async (key: string, val: any) => {
          mockStorage[key] = val;
        },
      },
    };
    // Re-initialize for test
    (HistoryManager as any).instance = undefined;
  });

  it('should initialize and return empty history initially', () => {
    const manager = HistoryManager.initialize(mockContext);
    expect(manager.getHistory()).toEqual([]);
  });

  it('should save and retrieve a review record', async () => {
    const manager = HistoryManager.initialize(mockContext);
    const mockResult: ReviewResult = {
      summary: 'Clean code',
      findings: [],
      durationMs: 100,
      filesAnalyzed: ['/app/src/index.ts'],
      providerName: 'TestProvider',
      modelName: 'TestModel',
      timestamp: '2026-11-22T10:00:00.000Z',
      totalIssues: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
    };

    await manager.addRecord(mockResult);
    const history = manager.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].fileName).toBe('index.ts');
    expect(history[0].filePath).toBe('/app/src/index.ts');
    expect(history[0].totalIssues).toBe(0);
  });

  it('should cap history at 25 records', async () => {
    const manager = HistoryManager.initialize(mockContext);
    for (let i = 0; i < 30; i++) {
      const mockResult: ReviewResult = {
        summary: `Review ${i}`,
        findings: [],
        durationMs: 50,
        filesAnalyzed: [`/app/src/file${i}.ts`],
        providerName: 'TestProvider',
        modelName: 'TestModel',
        timestamp: new Date().toISOString(),
        totalIssues: i,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
      };
      await manager.addRecord(mockResult);
    }

    const history = manager.getHistory();
    expect(history.length).toBe(25);
    // Most recent should be first
    expect(history[0].totalIssues).toBe(29);
  });

  it('should clear history when requested', async () => {
    const manager = HistoryManager.initialize(mockContext);
    const mockResult: ReviewResult = {
      summary: 'Test',
      findings: [],
      durationMs: 50,
      filesAnalyzed: ['/app/test.ts'],
      providerName: 'Test',
      modelName: 'Test',
      timestamp: new Date().toISOString(),
      totalIssues: 1,
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
    };
    await manager.addRecord(mockResult);
    expect(manager.getHistory().length).toBe(1);

    await manager.clearHistory();
    expect(manager.getHistory()).toEqual([]);
  });
});
