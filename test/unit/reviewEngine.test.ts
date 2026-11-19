import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewEngine } from '../../src/core/reviewEngine';
import { BugDetector } from '../../src/core/bugDetector';
import { ReviewResult } from '../../src/types';
import * as vscode from 'vscode';

describe('ReviewEngine', () => {
  let mockAiManager: any;
  let mockSidebarProvider: any;
  let mockHistoryManager: any;
  let engine: ReviewEngine;

  beforeEach(() => {
    mockAiManager = {
      isConfigured: vi.fn().mockResolvedValue(true),
      reviewCode: vi.fn().mockResolvedValue({
        summary: '1 issue found',
        findings: [
          {
            id: 'finding-1',
            title: 'Null check needed',
            severity: 'warning',
            category: 'bug',
            filePath: 'src/app.ts',
            line: 4,
            explanation: 'Value might be undefined',
            whyItMatters: 'Can crash',
            suggestedSolution: 'Add check',
            confidence: 0.9,
            source: 'ai',
          },
        ],
        durationMs: 200,
        filesAnalyzed: ['src/app.ts'],
        providerName: 'Google Gemini',
        modelName: 'gemini-2.5-flash',
        timestamp: new Date().toISOString(),
        totalIssues: 1,
        criticalCount: 0,
        warningCount: 1,
        infoCount: 0,
      } as ReviewResult),
    };

    mockSidebarProvider = {
      broadcastState: vi.fn(),
      displayReviewResult: vi.fn(),
      displayError: vi.fn(),
    };

    mockHistoryManager = {
      addRecord: vi.fn().mockResolvedValue(undefined),
    };

    // Re-initialize instances for testing
    (BugDetector as any).instance = undefined;
    BugDetector.initialize(mockAiManager);

    (ReviewEngine as any).instance = undefined;
    engine = ReviewEngine.initialize(mockAiManager, mockSidebarProvider, mockHistoryManager);
  });

  it('should skip review if file matches exclusion patterns', async () => {
    const mockDoc: any = {
      fileName: 'C:/project/node_modules/express/index.js',
      languageId: 'javascript',
      getText: () => 'const x = 1;',
      lineCount: 1,
    };

    const result = await engine.reviewDocument(mockDoc);
    expect(result).toBeNull();
    expect(mockAiManager.reviewCode).not.toHaveBeenCalled();
  });

  it('should skip review if document text is empty', async () => {
    const mockDoc: any = {
      fileName: 'C:/project/src/empty.ts',
      languageId: 'typescript',
      getText: () => '   \n  ',
      lineCount: 1,
    };

    const result = await engine.reviewDocument(mockDoc);
    expect(result).toBeNull();
    expect(mockAiManager.reviewCode).not.toHaveBeenCalled();
  });

  it('should prompt user if API key is not configured', async () => {
    mockAiManager.isConfigured.mockResolvedValueOnce(false);
    const mockDoc: any = {
      fileName: 'C:/project/src/main.ts',
      languageId: 'typescript',
      getText: () => 'console.log("hello");',
      lineCount: 1,
    };

    const result = await engine.reviewDocument(mockDoc);
    expect(result).toBeNull();
    expect(mockAiManager.reviewCode).not.toHaveBeenCalled();
  });

  it('should review full document and record result', async () => {
    const mockDoc: any = {
      fileName: 'C:/project/src/app.ts',
      uri: vscode.Uri.file('C:/project/src/app.ts'),
      languageId: 'typescript',
      getText: () => 'function run() {\n  let a = null;\n  return a.val;\n}',
      lineCount: 4,
    };

    const result = await engine.reviewDocument(mockDoc);
    expect(result).toBeDefined();
    expect(result?.totalIssues).toBe(1);
    expect(mockAiManager.reviewCode).toHaveBeenCalled();
    expect(mockSidebarProvider.displayReviewResult).toHaveBeenCalled();
    expect(mockHistoryManager.addRecord).toHaveBeenCalled();
  });

  it('should adjust snippet line numbers to document coordinates for selection reviews', async () => {
    const mockDoc: any = {
      fileName: 'C:/project/src/app.ts',
      uri: vscode.Uri.file('C:/project/src/app.ts'),
      languageId: 'typescript',
      getText: (_range?: any) => 'let a = null;\nreturn a.val;',
      lineCount: 100,
    };

    // Selection starts at line 40 (0-indexed line 40 is line 41 in editor)
    const selectionRange = new vscode.Range(
      new vscode.Position(40, 0),
      new vscode.Position(45, 0)
    );

    const result = await engine.reviewDocument(mockDoc, selectionRange);
    expect(result).toBeDefined();
    // Raw finding was line 4. Offset is 40. 40 + 4 = 44!
    expect(result?.findings[0].line).toBe(44);
  });
});
