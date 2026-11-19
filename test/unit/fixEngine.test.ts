import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FixEngine } from '../../src/fixes/fixEngine';
import { FixoraDiffContentProvider } from '../../src/fixes/diffProvider';
import { ReviewFinding } from '../../src/types';
import * as vscode from 'vscode';

describe('FixEngine & DiffProvider', () => {
  let mockAiManager: any;
  let mockSidebarProvider: any;
  let mockDocument: any;

  beforeEach(() => {
    mockAiManager = {
      generateFix: vi.fn().mockResolvedValue({
        replacementCode: 'const x: number = 42;',
        explanation: 'Specified type explicitly',
      }),
    };

    mockSidebarProvider = {
      broadcastState: vi.fn(),
      displayReviewResult: vi.fn(),
      displayError: vi.fn(),
    };

    mockDocument = {
      uri: vscode.Uri.file('/workspace/src/app.ts'),
      getText: vi.fn().mockReturnValue('line 1\nlet x = 42;\nline 3\nline 4\n'),
      lineCount: 4,
      lineAt: vi.fn().mockImplementation((lineNum: number) => ({
        lineNumber: lineNum,
        text: ['line 1', 'let x = 42;', 'line 3', 'line 4'][lineNum] || '',
        range: new vscode.Range(lineNum, 0, lineNum, 10),
      })),
    };

    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(mockDocument as any);
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);

    // Reset singleton
    (FixEngine as any).instance = undefined;
  });

  describe('FixoraDiffContentProvider', () => {
    it('should store and provide virtual document content', () => {
      const provider = FixoraDiffContentProvider.getInstance();
      const testUri = vscode.Uri.parse('fixora-diff:/workspace/src/app.ts?fix=123');

      expect(provider.provideTextDocumentContent(testUri)).toBe('');

      provider.setContent(testUri, 'const fixed = true;');
      expect(provider.provideTextDocumentContent(testUri)).toBe('const fixed = true;');

      provider.clearContent(testUri);
      expect(provider.provideTextDocumentContent(testUri)).toBe('');
    });
  });

  describe('FixEngine', () => {
    it('should initialize and return singleton', () => {
      const engine = FixEngine.initialize(mockAiManager, mockSidebarProvider);
      expect(engine).toBeDefined();
      expect(FixEngine.getInstance()).toBe(engine);
    });

    it('should successfully apply fix using WorkspaceEdit', async () => {
      const engine = FixEngine.initialize(mockAiManager, mockSidebarProvider);

      const finding: ReviewFinding = {
        id: 'finding-101',
        title: 'Use const instead of let',
        severity: 'info',
        category: 'style',
        filePath: '/workspace/src/app.ts',
        line: 2,
        explanation: 'Variable is never reassigned',
        whyItMatters: 'Improves immutability',
        suggestedSolution: 'Change let to const',
        suggestedFix: 'const x = 42;',
        confidence: 0.95,
        source: 'ai',
      };

      const applied = await engine.applyFix(finding);
      expect(applied).toBe(true);
      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('should preview fix via diff provider and execute diff command', async () => {
      const engine = FixEngine.initialize(mockAiManager, mockSidebarProvider);
      const executeDiffSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined as any);
      vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Fix' as any);

      const finding: ReviewFinding = {
        id: 'finding-102',
        title: 'Specify type',
        severity: 'warning',
        category: 'type-safety',
        filePath: '/workspace/src/app.ts',
        line: 2,
        explanation: 'Implicit any',
        whyItMatters: 'Type safety',
        suggestedSolution: 'Add type annotation',
        suggestedFix: 'const x: number = 42;',
        confidence: 0.9,
        source: 'ai',
      };

      await engine.previewFix(finding);

      expect(executeDiffSpy).toHaveBeenCalledWith(
        'vscode.diff',
        expect.anything(),
        expect.anything(),
        expect.stringContaining('Fixora AI Fix Preview'),
        expect.anything()
      );
    });
  });
});
