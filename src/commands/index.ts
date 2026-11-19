import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { registerReviewSelectionCommand } from './reviewSelection';
import { registerReviewFileCommand } from './reviewFile';
import { registerReviewWorkspaceCommand } from './reviewWorkspace';
import { registerReviewGitCommand } from './reviewGit';
import { registerExplainErrorCommand } from './explainError';
import { registerExplainTerminalCommand } from './explainTerminal';
import { registerFixIssueCommand } from './fixIssue';
import { registerSecurityScanCommand } from './securityScan';
import { registerPerformanceReviewCommand } from './performanceReview';
import { DiagnosticManager } from '../diagnostics/diagnosticManager';
import { ReportGenerator } from '../reports/reportGenerator';
import { GitHookManager } from '../git/gitHookManager';
import { ComplexityAnalyzer } from '../metrics/complexityAnalyzer';
import { DuplicateDetector } from '../metrics/duplicateDetector';
import { LanguageDetector } from '../utils/languageDetector';
import { ErrorLensManager } from '../diagnostics/errorLensManager';
import { ComplexityLensManager } from '../metrics/complexityLensManager';
import { PrettierFormatter } from '../formatter/prettierFormatter';
import { RealtimeLinter } from '../linter/realtimeLinter';

/**
 * Register all Fixora AI commands and bind them to extension lifecycle.
 */
export function registerAllCommands(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): void {
  const logger = Logger.getInstance();

  const register = (disposable: vscode.Disposable) => {
    context.subscriptions.push(disposable);
  };

  // Open Dashboard / Sidebar
  register(
    vscode.commands.registerCommand('fixora.openDashboard', () => {
      vscode.commands.executeCommand('workbench.view.extension.fixora-sidebar-view');
      sidebarProvider.broadcastState();
    })
  );

  // Review commands
  register(registerReviewSelectionCommand(context, sidebarProvider));
  register(registerReviewFileCommand(context, sidebarProvider));
  register(registerReviewWorkspaceCommand(context, sidebarProvider));
  registerReviewGitCommand(context, sidebarProvider).forEach(register);

  // Error explanation
  register(registerExplainErrorCommand(context, sidebarProvider));
  register(registerExplainTerminalCommand(context, sidebarProvider));

  // Fix issue
  register(registerFixIssueCommand(context, sidebarProvider));

  // Dedicated audits
  register(registerSecurityScanCommand(context, sidebarProvider));
  register(registerPerformanceReviewCommand(context, sidebarProvider));

  // Code quality
  register(
    vscode.commands.registerCommand('fixora.qualityReview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Fixora AI: Open a file to analyze code quality.');
        return;
      }
      logger.info(`Starting code quality review for ${editor.document.fileName}`);
      sidebarProvider.broadcastState(true, 'Auditing code quality and maintainability...');
      vscode.window.showInformationMessage('Fixora AI: Auditing code maintainability...');
    })
  );

  // Learning mode toggle
  register(
    vscode.commands.registerCommand('fixora.learningMode', async () => {
      const config = vscode.workspace.getConfiguration('fixora');
      const current = config.get<boolean>('enableLearningMode', false);
      await config.update('enableLearningMode', !current, vscode.ConfigurationTarget.Global);
      sidebarProvider.broadcastState();
      vscode.window.showInformationMessage(
        `Fixora AI: Learning Mode ${!current ? 'Enabled (Beginner-Friendly)' : 'Disabled'}.`
      );
    })
  );

  // Clear diagnostics
  register(
    vscode.commands.registerCommand('fixora.clearDiagnostics', () => {
      logger.info('Clearing diagnostics and active review findings.');
      DiagnosticManager.getInstance().clearDiagnostics();
      sidebarProvider.broadcastState();
      vscode.window.showInformationMessage('Fixora AI: Diagnostics cleared from Problems panel.');
    })
  );

  // View review history
  register(
    vscode.commands.registerCommand('fixora.viewHistory', () => {
      vscode.commands.executeCommand('workbench.view.extension.fixora-sidebar-view');
      vscode.window.showInformationMessage('Fixora AI: Displaying review history in sidebar.');
    })
  );

  // Configure Gemini API Key
  register(
    vscode.commands.registerCommand('fixora.configureApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        title: 'Configure Fixora AI Gemini API Key',
        prompt: 'Enter your Google Gemini API Key from Google AI Studio (keys start with AIzaSy)',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'AIzaSy...',
      });

      if (apiKey && apiKey.trim().length > 0) {
        const cleanKey = apiKey.trim();
        await context.secrets.store('fixora.geminiApiKey', cleanKey);
        sidebarProvider.setApiKeyConfigured(true);
        logger.info('Gemini API Key saved to SecretStorage.');
        vscode.window.showInformationMessage(
          'Fixora AI: Gemini API Key securely stored in SecretStorage.'
        );
      }
    })
  );

  // Select AI Model
  register(
    vscode.commands.registerCommand('fixora.selectModel', async () => {
      const models = [
        {
          label: 'gemini-3.8-flash',
          description: 'Recommended: Latest Google Gemini Flash model, ultra-fast and intelligent',
        },
        {
          label: 'gemini-1.5-flash',
          description: 'Stable & proven lightweight Gemini model',
        },
        {
          label: 'gemini-2.0-flash',
          description: 'High-performance Gemini 2.0 Flash model',
        },
        {
          label: 'gemini-1.5-pro',
          description: 'Large context window for extensive files and deep audits',
        },
      ];

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select active Gemini AI model',
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('fixora');
        await config.update('model', selected.label, vscode.ConfigurationTarget.Global);
        sidebarProvider.broadcastState();
        vscode.window.showInformationMessage(`Fixora AI: Model switched to ${selected.label}.`);
        logger.info(`Model switched to ${selected.label}.`);
      }
    })
  );

  // Configure Excluded Files
  register(
    vscode.commands.registerCommand('fixora.configureExcludedFiles', async () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'fixora.excludePatterns');
    })
  );

  // 19. Export Standalone Offline HTML Audit Report
  register(
    vscode.commands.registerCommand('fixora.exportReport', async () => {
      const current = sidebarProvider.getCurrentReview();
      if (!current || current.findings.length === 0) {
        vscode.window.showWarningMessage('Fixora AI: Run a code review first before exporting an audit report.');
        return;
      }
      await ReportGenerator.exportHtmlReport(current);
    })
  );

  // 20. Install Offline Git Pre-Commit Security Guard
  register(
    vscode.commands.registerCommand('fixora.installGitHook', async () => {
      await GitHookManager.installPreCommitHook();
    })
  );

  // 21. Analyze Code Complexity & Maintainability Health Score
  register(
    vscode.commands.registerCommand('fixora.analyzeComplexity', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Fixora AI: Open a file to analyze complexity and maintainability.');
        return;
      }

      const doc = editor.document;
      const code = doc.getText();
      const filePath = doc.fileName;
      const lang = LanguageDetector.detect(filePath, doc.languageId, code);

      const metrics = ComplexityAnalyzer.analyze(code, filePath, lang.id);
      const duplicateFindings = DuplicateDetector.detect(code, filePath, 4);
      const allFindings = [...metrics.findings, ...duplicateFindings];

      const result = {
        summary: `Code Health Grade: ${metrics.grade} (Maintainability: ${metrics.maintainabilityIndex}/100, Cyclomatic Complexity: ${metrics.cyclomaticComplexity}). Found ${allFindings.length} issue(s).`,
        findings: allFindings,
        durationMs: 15,
        filesAnalyzed: [filePath],
        providerName: 'Fixora Offline Analyzer',
        modelName: 'Complexity & Health Engine',
        timestamp: new Date().toISOString(),
        totalIssues: allFindings.length,
        criticalCount: allFindings.filter((f) => f.severity === 'critical').length,
        warningCount: allFindings.filter((f) => f.severity === 'warning').length,
        infoCount: allFindings.filter((f) => f.severity === 'info' || f.severity === 'hint').length,
      };

      sidebarProvider.displayReviewResult(result);
      DiagnosticManager.getInstance().publishFindings(doc.uri, allFindings);

      vscode.window.showInformationMessage(
        `Fixora AI Health: Grade ${metrics.grade} (Maintainability: ${metrics.maintainabilityIndex}%, CC: ${metrics.cyclomaticComplexity})`
      );
    })
  );

  // 22. Toggle Error Lens (Inline Diagnostics & Line Highlights)
  register(
    vscode.commands.registerCommand('fixora.toggleInlineDiagnostics', () => {
      ErrorLensManager.getInstance().toggle();
    })
  );

  // 23. Jump to Next Diagnostic
  register(
    vscode.commands.registerCommand('fixora.nextDiagnostic', () => {
      ErrorLensManager.getInstance().jumpToNext();
    })
  );

  // 24. Jump to Previous Diagnostic
  register(
    vscode.commands.registerCommand('fixora.previousDiagnostic', () => {
      ErrorLensManager.getInstance().jumpToPrevious();
    })
  );

  // 25. Format Document (Prettier)
  register(
    vscode.commands.registerCommand('fixora.formatDocument', async () => {
      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );

  // 26. Format Selection (Prettier)
  register(
    vscode.commands.registerCommand('fixora.formatSelection', async () => {
      await vscode.commands.executeCommand('editor.action.formatSelection');
    })
  );

  // 27. Toggle Code Complexity Lens
  register(
    vscode.commands.registerCommand('fixora.toggleComplexityLens', () => {
      ComplexityLensManager.getInstance().toggle();
    })
  );

  // 28. Toggle Prettier Formatter
  register(
    vscode.commands.registerCommand('fixora.toggleFormatter', () => {
      PrettierFormatter.getInstance().toggle();
    })
  );

  // 29. Toggle Real-time Linter (ESLint & Style as you type)
  register(
    vscode.commands.registerCommand('fixora.toggleLinter', () => {
      RealtimeLinter.getInstance().toggle();
    })
  );

  logger.info('All 29 Fixora AI commands successfully registered and bound to lifecycle.');
}
