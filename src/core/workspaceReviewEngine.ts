import * as vscode from 'vscode';
import { ReviewEngine } from './reviewEngine';
import { SidebarProvider } from '../providers/sidebarProvider';
import { DiagnosticManager } from '../diagnostics/diagnosticManager';
import { HistoryManager } from '../history/historyManager';
import { LanguageDetector } from '../utils/languageDetector';
import { FileUtils } from '../utils/fileUtils';
import { ProcessManager } from '../utils/processManager';
import { ReviewFinding, ReviewResult } from '../types';
import { Logger } from '../utils/logger';

/**
 * Orchestrates multi-file workspace reviews and Git working-tree / staged change audits.
 */
export class WorkspaceReviewEngine {
  private static instance: WorkspaceReviewEngine;
  private logger = Logger.getInstance();

  private constructor(
    private readonly reviewEngine: ReviewEngine,
    private readonly sidebarProvider: SidebarProvider,
    private readonly historyManager: HistoryManager
  ) {}

  public static initialize(
    reviewEngine: ReviewEngine,
    sidebarProvider: SidebarProvider,
    historyManager: HistoryManager
  ): WorkspaceReviewEngine {
    if (!WorkspaceReviewEngine.instance) {
      WorkspaceReviewEngine.instance = new WorkspaceReviewEngine(
        reviewEngine,
        sidebarProvider,
        historyManager
      );
    }
    return WorkspaceReviewEngine.instance;
  }

  public static getInstance(): WorkspaceReviewEngine {
    if (!WorkspaceReviewEngine.instance) {
      throw new Error('WorkspaceReviewEngine must be initialized before use.');
    }
    return WorkspaceReviewEngine.instance;
  }

  /**
   * Scans and reviews multiple files across the current workspace.
   */
  public async reviewWorkspace(maxFiles = 30): Promise<ReviewResult | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showWarningMessage('Fixora AI: No workspace folder is currently open.');
      return null;
    }

    this.logger.info(`Starting Workspace Review for ${folders[0].name} (capped at ${maxFiles} files)`);

    // Discover candidate files
    const allFiles = await vscode.workspace.findFiles(
      '**/*',
      '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.env*,**/*.min.js,**/vendor/**,**/venv/**,**/__pycache__/**,**/coverage/**,**/*.lock}',
      maxFiles * 2
    );

    // Filter by supported extensions
    const candidateFiles = allFiles.filter((uri) => {
      const ext = uri.fsPath.split('.').pop() || '';
      return LanguageDetector.isLanguageSupported(ext, `.${ext}`) && !FileUtils.isFileExcluded(uri.fsPath);
    }).slice(0, maxFiles);

    if (candidateFiles.length === 0) {
      vscode.window.showInformationMessage('Fixora AI: No supported source files found in workspace.');
      return null;
    }

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fixora AI: Workspace Review (${candidateFiles.length} files)`,
        cancellable: true,
      },
      async (progress, token) => {
        const aggregatedFindings: ReviewFinding[] = [];
        const filesAnalyzed: string[] = [];
        const startTime = Date.now();

        for (let i = 0; i < candidateFiles.length; i++) {
          if (token.isCancellationRequested) {
            this.logger.info('Workspace review cancelled by user.');
            break;
          }

          const fileUri = candidateFiles[i];
          const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'file';

          progress.report({
            message: `Analyzing file ${i + 1}/${candidateFiles.length}: ${fileName}`,
            increment: (1 / candidateFiles.length) * 100,
          });

          try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const singleResult = await this.reviewEngine.reviewDocument(document);

            if (singleResult) {
              aggregatedFindings.push(...singleResult.findings);
              filesAnalyzed.push(fileUri.fsPath);
            }
          } catch (err: any) {
            this.logger.warn(`Failed reviewing ${fileUri.fsPath}: ${err?.message || err}`);
          }
        }

        const criticalCount = aggregatedFindings.filter((f) => f.severity === 'critical').length;
        const warningCount = aggregatedFindings.filter((f) => f.severity === 'warning').length;
        const infoCount = aggregatedFindings.filter((f) => f.severity === 'info' || f.severity === 'hint').length;

        const result: ReviewResult = {
          summary: `Workspace review analyzed ${filesAnalyzed.length} files. Found ${aggregatedFindings.length} total issues.`,
          findings: aggregatedFindings,
          durationMs: Date.now() - startTime,
          filesAnalyzed,
          providerName: 'Fixora AI Workspace Review',
          modelName: 'Multi-file Aggregate',
          timestamp: new Date().toISOString(),
          totalIssues: aggregatedFindings.length,
          criticalCount,
          warningCount,
          infoCount,
        };

        this.sidebarProvider.displayReviewResult(result);
        await this.historyManager.addRecord(result);

        const summaryText = `Workspace audit completed: ${filesAnalyzed.length} files, ${aggregatedFindings.length} issues found.`;
        vscode.window.showInformationMessage(`Fixora AI: ${summaryText}`);
        return result;
      }
    );
  }

  /**
   * Reviews files modified in Git (working directory or staged changes).
   */
  public async reviewGitChanges(stagedOnly = false): Promise<ReviewResult | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showWarningMessage('Fixora AI: No workspace open.');
      return null;
    }

    const cwd = folders[0].uri.fsPath;
    const gitArgs = stagedOnly ? ['diff', '--name-only', '--cached'] : ['diff', '--name-only'];

    this.logger.info(`Checking Git changes with args: ${gitArgs.join(' ')}`);

    try {
      const gitResult = await ProcessManager.execute('git', gitArgs, { cwd, timeoutMs: 8000 });
      if (gitResult.exitCode !== 0) {
        vscode.window.showErrorMessage(`Fixora AI: Git command failed. Ensure Git is installed and initialized.`);
        return null;
      }

      const files = gitResult.stdout
        .split(/\r?\n/)
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      if (files.length === 0) {
        vscode.window.showInformationMessage(
          `Fixora AI: No modified ${stagedOnly ? 'staged ' : ''}Git files found.`
        );
        return null;
      }

      this.logger.info(`Found ${files.length} modified Git files to review.`);
      const aggregatedFindings: ReviewFinding[] = [];
      const analyzed: string[] = [];

      for (const relativePath of files) {
        try {
          const fileUri = vscode.Uri.file(`${cwd}/${relativePath}`);
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const single = await this.reviewEngine.reviewDocument(doc);
          if (single) {
            aggregatedFindings.push(...single.findings);
            analyzed.push(fileUri.fsPath);
          }
        } catch {
          // File may have been deleted in working tree
        }
      }

      const criticalCount = aggregatedFindings.filter((f) => f.severity === 'critical').length;
      const warningCount = aggregatedFindings.filter((f) => f.severity === 'warning').length;
      const infoCount = aggregatedFindings.filter((f) => f.severity === 'info' || f.severity === 'hint').length;

      const result: ReviewResult = {
        summary: `Git review of ${analyzed.length} ${stagedOnly ? 'staged' : 'modified'} files complete. Found ${aggregatedFindings.length} issues.`,
        findings: aggregatedFindings,
        durationMs: 0,
        filesAnalyzed: analyzed,
        providerName: 'Fixora AI Git Review',
        modelName: 'Git Changes',
        timestamp: new Date().toISOString(),
        totalIssues: aggregatedFindings.length,
        criticalCount,
        warningCount,
        infoCount,
      };

      this.sidebarProvider.displayReviewResult(result);
      await this.historyManager.addRecord(result);

      vscode.window.showInformationMessage(
        `Fixora AI: Reviewed ${analyzed.length} Git files. Found ${aggregatedFindings.length} issues.`
      );

      return result;
    } catch (err: any) {
      this.logger.error('Git review failed', err);
      vscode.window.showErrorMessage(`Fixora AI: Could not inspect Git changes: ${err?.message || err}`);
      return null;
    }
  }
}
