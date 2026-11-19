import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceReviewEngine } from '../../src/core/workspaceReviewEngine';
import { ProcessManager } from '../../src/utils/processManager';
import { ReviewFinding, ReviewResult } from '../../src/types';
import * as vscode from 'vscode';

describe('WorkspaceReviewEngine', () => {
  let mockReviewEngine: any;
  let mockSidebarProvider: any;
  let mockHistoryManager: any;

  beforeEach(() => {
    mockReviewEngine = {
      reviewDocument: vi.fn().mockImplementation(async (doc: any) => {
        return {
          summary: `1 issue in ${doc.uri?.fsPath || 'file'}`,
          findings: [
            {
              id: 'w-1',
              title: 'Unused import',
              severity: 'warning',
              category: 'quality',
              filePath: doc.uri?.fsPath || '/workspace/index.ts',
              line: 1,
              explanation: 'Import is not used',
              whyItMatters: 'Cleanliness',
              suggestedSolution: 'Remove import',
              confidence: 0.9,
              source: 'ai',
            } as ReviewFinding,
          ],
          durationMs: 100,
          filesAnalyzed: [doc.uri?.fsPath || '/workspace/index.ts'],
          providerName: 'Google Gemini',
          modelName: 'gemini-2.5-flash',
          timestamp: new Date().toISOString(),
          totalIssues: 1,
          criticalCount: 0,
          warningCount: 1,
          infoCount: 0,
        } as ReviewResult;
      }),
    };

    mockSidebarProvider = {
      displayReviewResult: vi.fn(),
      displayError: vi.fn(),
    };

    mockHistoryManager = {
      addRecord: vi.fn().mockResolvedValue(undefined),
    };

    (vscode.workspace as any).workspaceFolders = [
      {
        uri: vscode.Uri.file('/workspace'),
        name: 'test-workspace',
        index: 0,
      },
    ];

    (WorkspaceReviewEngine as any).instance = undefined;
  });

  it('should initialize and return singleton', () => {
    const engine = WorkspaceReviewEngine.initialize(
      mockReviewEngine,
      mockSidebarProvider,
      mockHistoryManager
    );
    expect(engine).toBeDefined();
    expect(WorkspaceReviewEngine.getInstance()).toBe(engine);
  });

  it('should return null if no workspace folder is open', async () => {
    (vscode.workspace as any).workspaceFolders = [];
    const engine = WorkspaceReviewEngine.initialize(
      mockReviewEngine,
      mockSidebarProvider,
      mockHistoryManager
    );

    const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');
    const result = await engine.reviewWorkspace();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No workspace folder is currently open'));
  });

  it('should discover candidate files and aggregate findings across workspace', async () => {
    const engine = WorkspaceReviewEngine.initialize(
      mockReviewEngine,
      mockSidebarProvider,
      mockHistoryManager
    );

    vi.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([
      vscode.Uri.file('/workspace/src/index.ts'),
      vscode.Uri.file('/workspace/src/utils.js'),
    ] as any);

    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (uri: any) => ({
      uri,
      getText: () => 'const a = 1;',
      lineCount: 1,
    }) as any);

    const result = await engine.reviewWorkspace(10);

    expect(result).toBeDefined();
    expect(result?.totalIssues).toBe(2);
    expect(result?.filesAnalyzed.length).toBe(2);
    expect(mockSidebarProvider.displayReviewResult).toHaveBeenCalled();
    expect(mockHistoryManager.addRecord).toHaveBeenCalled();
  });

  it('should review modified git changes when git diff outputs files', async () => {
    const engine = WorkspaceReviewEngine.initialize(
      mockReviewEngine,
      mockSidebarProvider,
      mockHistoryManager
    );

    vi.spyOn(ProcessManager, 'execute').mockResolvedValue({
      stdout: 'src/app.ts\nsrc/service.ts\n',
      stderr: '',
      exitCode: 0,
      durationMs: 50,
    });

    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (uri: any) => ({
      uri,
      getText: () => 'export const foo = 1;',
      lineCount: 1,
    }) as any);

    const result = await engine.reviewGitChanges(false);

    expect(result).toBeDefined();
    expect(result?.filesAnalyzed.length).toBe(2);
    expect(result?.totalIssues).toBe(2);
  });

  it('should inform user if git diff finds no modified files', async () => {
    const engine = WorkspaceReviewEngine.initialize(
      mockReviewEngine,
      mockSidebarProvider,
      mockHistoryManager
    );

    vi.spyOn(ProcessManager, 'execute').mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      durationMs: 20,
    });

    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const result = await engine.reviewGitChanges(false);

    expect(result).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('No modified Git files found'));
  });
});
