import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerformanceEngine } from '../../src/core/performanceEngine';
import * as vscode from 'vscode';

describe('PerformanceEngine', () => {
  let mockAiManager: any;
  let mockSidebarProvider: any;
  let engine: PerformanceEngine;

  beforeEach(() => {
    mockAiManager = {
      isConfigured: vi.fn().mockResolvedValue(true),
      reviewPerformance: vi.fn().mockResolvedValue({
        summary: 'AI Performance Review complete.',
        findings: [
          {
            id: 'ai-perf-1',
            title: 'Algorithmic Complexity O(n^2)',
            severity: 'warning',
            category: 'performance',
            filePath: 'src/sort.ts',
            line: 15,
            explanation: 'Nested loops iterate over full array',
            whyItMatters: 'Execution time scales quadratically',
            suggestedSolution: 'Use Map for O(n) lookup',
            confidence: 0.9,
            source: 'ai',
          },
        ],
        durationMs: 150,
        providerName: 'Google Gemini',
        modelName: 'gemini-2.5-flash',
      }),
    };

    mockSidebarProvider = {
      broadcastState: vi.fn(),
      displayReviewResult: vi.fn(),
      displayError: vi.fn(),
    };

    (PerformanceEngine as any).instance = undefined;
    engine = PerformanceEngine.initialize(mockAiManager, mockSidebarProvider);
  });

  describe('runDeterministicPerformanceChecks', () => {
    it('should detect blocking synchronous file I/O in Node.js', () => {
      const code = 'const data = fs.readFileSync("/data/large-file.json");';
      const findings = engine.runDeterministicPerformanceChecks(code, 'server.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Blocking Synchronous File I/O');
      expect(findings[0].severity).toBe('warning');
    });

    it('should detect quadratic array spread inside reduce', () => {
      const code = 'const all = items.reduce((acc, item) => [...acc, item.val], []);';
      const findings = engine.runDeterministicPerformanceChecks(code, 'utils.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Quadratic Spread in Array Reduce');
      expect(findings[0].severity).toBe('warning');
    });

    it('should detect unconstrained SELECT * in SQL queries', () => {
      const code = 'SELECT * FROM transactions;';
      const findings = engine.runDeterministicPerformanceChecks(code, 'query.sql', 'sql');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Unbounded SELECT * Query');
      expect(findings[0].severity).toBe('warning');
    });

    it('should detect React inline styles triggering unnecessary re-renders', () => {
      const code = '<div style={{ marginTop: 20 }}>Header</div>';
      const findings = engine.runDeterministicPerformanceChecks(code, 'App.tsx', 'typescriptreact');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('React Inline Object in Style Prop');
      expect(findings[0].severity).toBe('hint');
    });
  });

  describe('auditDocument', () => {
    it('should run performance audit, merge findings, and notify sidebar', async () => {
      const mockDoc: any = {
        fileName: 'C:/project/src/loader.ts',
        uri: vscode.Uri.file('C:/project/src/loader.ts'),
        languageId: 'typescript',
        getText: () => 'const content = fs.readFileSync("data.txt");',
        lineCount: 1,
      };

      const result = await engine.auditDocument(mockDoc);
      expect(result).toBeDefined();
      expect(result?.findings.length).toBeGreaterThanOrEqual(2); // Sync IO + AI finding
      expect(mockSidebarProvider.displayReviewResult).toHaveBeenCalled();
    });
  });
});
