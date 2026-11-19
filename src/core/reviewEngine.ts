import * as vscode from 'vscode';
import { AIManager } from '../ai/aiManager';
import { SidebarProvider } from '../providers/sidebarProvider';
import { HistoryManager } from '../history/historyManager';
import { LanguageDetector } from '../utils/languageDetector';
import { FileUtils } from '../utils/fileUtils';
import { Logger } from '../utils/logger';
import { ReviewResult } from '../types';
import { BugDetector } from './bugDetector';
import { DiagnosticManager } from '../diagnostics/diagnosticManager';
import { AnalyzerManager } from '../analyzers/analyzerManager';

/**
 * Core engine responsible for orchestrating AI Code Reviews across selections and files.
 */
export class ReviewEngine {
  private static instance: ReviewEngine;
  private logger = Logger.getInstance();

  private constructor(
    private readonly aiManager: AIManager,
    private readonly sidebarProvider: SidebarProvider,
    private readonly historyManager: HistoryManager
  ) {}

  public static initialize(
    aiManager: AIManager,
    sidebarProvider: SidebarProvider,
    historyManager: HistoryManager
  ): ReviewEngine {
    if (!ReviewEngine.instance) {
      ReviewEngine.instance = new ReviewEngine(aiManager, sidebarProvider, historyManager);
    }
    return ReviewEngine.instance;
  }

  public static getInstance(): ReviewEngine {
    if (!ReviewEngine.instance) {
      throw new Error('ReviewEngine must be initialized before use.');
    }
    return ReviewEngine.instance;
  }

  /**
   * Reviews either a specific selected range or the entire text document.
   */
  public async reviewDocument(
    document: vscode.TextDocument,
    selectionRange?: vscode.Range
  ): Promise<ReviewResult | null> {
    const filePath = document.fileName;
    const isSelection = Boolean(selectionRange && !selectionRange.isEmpty);

    // 1. Check file exclusion rules
    if (FileUtils.isFileExcluded(filePath)) {
      const msg = `Fixora AI: File "${document.fileName.split(/[\\/]/).pop()}" is excluded from reviews by configuration.`;
      this.logger.info(msg);
      vscode.window.showInformationMessage(msg);
      return null;
    }

    // 2. Extract code
    const code = isSelection
      ? document.getText(selectionRange)
      : document.getText();

    if (!code || code.trim().length === 0) {
      vscode.window.showWarningMessage('Fixora AI: Selected code block is empty.');
      return null;
    }

    // 3. Detect language & framework
    const langInfo = LanguageDetector.detect(filePath, document.languageId, code);
    this.logger.info(`Detected language: ${langInfo.name} (${langInfo.id}), Framework: ${langInfo.framework || 'none'}`);

    // 4. Ensure API Key is configured
    const isConfigured = await this.aiManager.isConfigured();
    if (!isConfigured) {
      const action = await vscode.window.showWarningMessage(
        'Fixora AI requires a Gemini API Key to perform AI Code Reviews.',
        'Configure API Key'
      );
      if (action === 'Configure API Key') {
        await vscode.commands.executeCommand('fixora.configureApiKey');
      }
      return null;
    }

    // 5. Read user settings
    const config = vscode.workspace.getConfiguration('fixora');
    const learningMode = config.get<boolean>('enableLearningMode', false);
    const scopeLabel = isSelection
      ? `selected code (lines ${selectionRange!.start.line + 1}–${selectionRange!.end.line + 1})`
      : `file (${document.lineCount} lines)`;

    // 6. Execute with cancellation and progress
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fixora AI: Reviewing ${document.fileName.split(/[\\/]/).pop()}`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ message: `Analyzing ${scopeLabel}...` });
        this.sidebarProvider.broadcastState(true, `Analyzing ${langInfo.name}...`);

        try {
          const bugDetector = BugDetector.getInstance();
          const deterministicFindings = bugDetector.runDeterministicBugChecks(code, filePath, langInfo.id);

          // Run external static analyzer if available on the system
          const analyzerManager = AnalyzerManager.getInstance();
          const externalStaticFindings = await analyzerManager.runStaticAnalysis(filePath, code, langInfo.id);

          // Combine deterministic and external static findings
          const allStaticFindings = bugDetector.mergeAndDeduplicate(deterministicFindings, externalStaticFindings);

          let result: ReviewResult;
          try {
            const aiResult = await this.aiManager.reviewCode(
              {
                code,
                filePath,
                languageId: langInfo.id,
                learningMode,
                staticFindings: allStaticFindings,
              },
              token
            );
            result = aiResult;
            result.findings = bugDetector.mergeAndDeduplicate(allStaticFindings, result.findings);
          } catch (aiErr: any) {
            if (token.isCancellationRequested) {
              throw aiErr;
            }
            this.logger.warn(`AI review call failed (${aiErr?.message || aiErr}). Using deterministic findings fallback.`);
            if (allStaticFindings.length > 0) {
              result = {
                summary: `Analyzed with local static & heuristic engine (${allStaticFindings.length} issue(s) detected). Note: AI connection issue: ${aiErr?.message || 'Check network'}.`,
                findings: allStaticFindings,
                durationMs: 0,
                filesAnalyzed: [filePath],
                providerName: 'Fixora Local Heuristics',
                modelName: 'Deterministic Engine',
                timestamp: new Date().toISOString(),
                totalIssues: allStaticFindings.length,
                criticalCount: allStaticFindings.filter((f) => f.severity === 'critical').length,
                warningCount: allStaticFindings.filter((f) => f.severity === 'warning').length,
                infoCount: allStaticFindings.filter((f) => f.severity === 'info' || f.severity === 'hint').length,
              };
            } else {
              throw aiErr;
            }
          }

          result.totalIssues = result.findings.length;
          result.criticalCount = result.findings.filter((f) => f.severity === 'critical').length;
          result.warningCount = result.findings.filter((f) => f.severity === 'warning').length;
          result.infoCount = result.findings.filter((f) => f.severity === 'info' || f.severity === 'hint').length;

          // 7. Adjust line numbers if review was on a selection snippet
          if (isSelection && selectionRange) {
            const lineOffset = selectionRange.start.line;
            for (const finding of result.findings) {
              finding.line = lineOffset + finding.line;
              if (finding.endLine !== undefined) {
                finding.endLine = lineOffset + finding.endLine;
              }
            }
          }

          // 8. Publish results to sidebar, problems panel, and history
          this.sidebarProvider.displayReviewResult(result);
          const docUri = document.uri || vscode.Uri.file(filePath);
          DiagnosticManager.getInstance().publishFindings(docUri, result.findings);
          await this.historyManager.addRecord(result);

          // 9. Inform the user
          const issueSummary =
            result.totalIssues === 0
              ? 'No issues detected! Clean code.'
              : `Found ${result.totalIssues} issue${result.totalIssues > 1 ? 's' : ''} (${result.criticalCount} critical, ${result.warningCount} warnings).`;

          vscode.window.showInformationMessage(`Fixora AI: Review completed. ${issueSummary}`);
          this.logger.info(`Review completed for ${filePath}: ${issueSummary}`);

          return result;
        } catch (err: any) {
          if (token.isCancellationRequested) {
            this.sidebarProvider.broadcastState(false);
            this.logger.info('Review was cancelled by the user.');
            vscode.window.showInformationMessage('Fixora AI: Review cancelled.');
            return null;
          }

          const errMsg = err?.message || 'An error occurred during review.';
          this.sidebarProvider.displayError(errMsg);
          vscode.window.showErrorMessage(`Fixora AI: ${errMsg}`);
          return null;
        }
      }
    );
  }
}
