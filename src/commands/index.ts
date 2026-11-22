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
import { BRANDING } from '../constants/branding';
import { TestGeneratorEngine } from '../core/testGeneratorEngine';
import { GitHubPrReviewer } from '../git/githubPrReviewer';
import { DependencyAuditor } from '../security/dependencyAuditor';
import { WorkspaceHealthService } from '../core/workspaceHealth';

/**
 * Register all Revion commands and bind them to the extension lifecycle.
 * Maintains backwards compatibility for all existing 'fixora.*' command IDs.
 */
export function registerAllCommands(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): void {
  const logger = Logger.getInstance();

  const register = (disposable: vscode.Disposable) => {
    context.subscriptions.push(disposable);
  };

  // 1. Open Dashboard / Assistant
  register(
    vscode.commands.registerCommand('fixora.openDashboard', () => {
      vscode.commands.executeCommand(`workbench.view.extension.${BRANDING.VIEW_CONTAINER_ID}`);
      sidebarProvider.broadcastState();
    })
  );

  // 2-6. Review commands
  register(registerReviewSelectionCommand(context, sidebarProvider));
  register(registerReviewFileCommand(context, sidebarProvider));
  register(registerReviewWorkspaceCommand(context, sidebarProvider));
  registerReviewGitCommand(context, sidebarProvider).forEach(register);

  // 7-8. Error explanation
  register(registerExplainErrorCommand(context, sidebarProvider));
  register(registerExplainTerminalCommand(context, sidebarProvider));

  // 9. Fix issue
  register(registerFixIssueCommand(context, sidebarProvider));

  // 10-11. Dedicated audits
  register(registerSecurityScanCommand(context, sidebarProvider));
  register(registerPerformanceReviewCommand(context, sidebarProvider));

  // 12. Code health & quality audit (Repaired from broken stub)
  register(
    vscode.commands.registerCommand('fixora.qualityReview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: Open a file to analyze code health and quality.`);
        return;
      }
      logger.info(`Starting code quality review for ${editor.document.fileName}`);
      sidebarProvider.broadcastState(true, 'Auditing code quality and maintainability...');

      try {
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
          providerName: `${BRANDING.PRODUCT_NAME} Offline Analyzer`,
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
          `${BRANDING.PRODUCT_NAME} Health: Grade ${metrics.grade} (Maintainability: ${metrics.maintainabilityIndex}%, CC: ${metrics.cyclomaticComplexity})`
        );
      } catch (err: any) {
        logger.error('Failed to run quality review', err);
        sidebarProvider.broadcastState(false);
        vscode.window.showErrorMessage(`${BRANDING.PRODUCT_NAME}: Failed to audit code quality: ${err?.message || err}`);
      }
    })
  );

  // 13. Learning mode toggle
  register(
    vscode.commands.registerCommand('fixora.learningMode', async () => {
      const config = vscode.workspace.getConfiguration(BRANDING.CONFIG_SECTION);
      const current = config.get<boolean>('enableLearningMode', false);
      await config.update('enableLearningMode', !current, vscode.ConfigurationTarget.Global);
      sidebarProvider.broadcastState();
      vscode.window.showInformationMessage(
        `${BRANDING.PRODUCT_NAME}: Learning Mode ${!current ? 'Enabled (Educational Explanations)' : 'Disabled'}.`
      );
    })
  );

  // 14. Clear diagnostics
  register(
    vscode.commands.registerCommand('fixora.clearDiagnostics', () => {
      logger.info('Clearing diagnostics and active review findings.');
      DiagnosticManager.getInstance().clearDiagnostics();
      sidebarProvider.broadcastState();
      vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME}: Diagnostics cleared from Problems panel.`);
    })
  );

  // 15. View review history
  register(
    vscode.commands.registerCommand('fixora.viewHistory', () => {
      vscode.commands.executeCommand(`workbench.view.extension.${BRANDING.VIEW_CONTAINER_ID}`);
      sidebarProvider.broadcastState();
      vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME}: Displaying review history.`);
    })
  );

  // 16. Configure Gemini API Key
  register(
    vscode.commands.registerCommand('fixora.configureApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        title: `Configure ${BRANDING.PRODUCT_NAME} Gemini API Key`,
        prompt: 'Enter your Google Gemini API Key from Google AI Studio (keys start with AIzaSy)',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'AIzaSy...',
      });

      if (apiKey && apiKey.trim().length > 0) {
        const cleanKey = apiKey.trim();
        await context.secrets.store(BRANDING.SECRET_KEY_GEMINI, cleanKey);
        sidebarProvider.setApiKeyConfigured(true);
        logger.info('Gemini API Key saved to SecretStorage.');
        vscode.window.showInformationMessage(
          `${BRANDING.PRODUCT_NAME}: Gemini API Key securely stored in SecretStorage.`
        );
      }
    })
  );

  // 17. Select AI Model (Using valid official models)
  register(
    vscode.commands.registerCommand('fixora.selectModel', async () => {
      const models = BRANDING.SUPPORTED_GEMINI_MODELS.map((m) => ({
        label: m.id,
        description: m.description,
      }));

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: `Select active ${BRANDING.PRODUCT_NAME} AI model`,
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration(BRANDING.CONFIG_SECTION);
        await config.update('model', selected.label, vscode.ConfigurationTarget.Global);
        sidebarProvider.broadcastState();
        vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME}: Model switched to ${selected.label}.`);
        logger.info(`Model switched to ${selected.label}.`);
      }
    })
  );

  // 18. Configure Excluded Files
  register(
    vscode.commands.registerCommand('fixora.configureExcludedFiles', async () => {
      vscode.commands.executeCommand('workbench.action.openSettings', `${BRANDING.CONFIG_SECTION}.excludePatterns`);
    })
  );

  // 19. Export Standalone Offline HTML Audit Report
  register(
    vscode.commands.registerCommand('fixora.exportReport', async () => {
      const current = sidebarProvider.getCurrentReview();
      if (!current || current.findings.length === 0) {
        vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: Run a code review first before exporting an audit report.`);
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
        vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: Open a file to analyze complexity and maintainability.`);
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
        providerName: `${BRANDING.PRODUCT_NAME} Offline Analyzer`,
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
        `${BRANDING.PRODUCT_NAME} Health: Grade ${metrics.grade} (Maintainability: ${metrics.maintainabilityIndex}%, CC: ${metrics.cyclomaticComplexity})`
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

  // 30. Generate Unit Tests
  register(
    vscode.commands.registerCommand('fixora.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: Open a file to generate unit tests.`);
        return;
      }

      const doc = editor.document;
      const selection = editor.selection;
      const code = !selection.isEmpty ? doc.getText(selection) : doc.getText();
      const filePath = doc.fileName;

      if (!code.trim()) {
        vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: Cannot generate tests for empty code.`);
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${BRANDING.PRODUCT_NAME}: Generating unit tests...`,
          cancellable: true,
        },
        async (_progress, token) => {
          try {
            sidebarProvider.broadcastState(true, 'Synthesizing comprehensive unit tests...');
            const engine = TestGeneratorEngine.getInstance();
            const result = await engine.generateTests(code, filePath, doc.languageId, token);

            await engine.previewInEditor(result, doc.languageId);
            sidebarProvider.broadcastState(false);
          } catch (err: any) {
            sidebarProvider.broadcastState(false);
            if (!token.isCancellationRequested) {
              vscode.window.showErrorMessage(`${BRANDING.PRODUCT_NAME}: ${err?.message || 'Failed to generate tests.'}`);
            }
          }
        }
      );
    })
  );

  // 31. Review GitHub Pull Request
  register(
    vscode.commands.registerCommand('fixora.reviewPullRequest', async () => {
      const reviewer = GitHubPrReviewer.getInstance();
      const repoInfo = await reviewer.detectRepository();
      let owner = repoInfo?.owner || '';
      let repo = repoInfo?.repo || '';

      if (!owner || !repo) {
        const repoInput = await vscode.window.showInputBox({
          prompt: 'Enter GitHub owner/repo (e.g. facebook/react)',
          placeHolder: 'owner/repository',
        });
        if (!repoInput) return;
        const parsed = reviewer.parseGitHubUrl(`https://github.com/${repoInput}`);
        if (!parsed) {
          vscode.window.showErrorMessage(`${BRANDING.PRODUCT_NAME}: Invalid GitHub repository format.`);
          return;
        }
        owner = parsed.owner;
        repo = parsed.repo;
      }

      const prInput = await vscode.window.showInputBox({
        prompt: `Enter Pull Request number for ${owner}/${repo}`,
        placeHolder: '1',
      });
      if (!prInput || !/^\d+$/.test(prInput)) {
        return;
      }
      const prNumber = parseInt(prInput, 10);
      const token = (await reviewer.getAuthToken()) || undefined;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${BRANDING.PRODUCT_NAME}: Reviewing PR #${prNumber} on ${owner}/${repo}...`,
          cancellable: true,
        },
        async (_progress, cancelToken) => {
          try {
            sidebarProvider.broadcastState(true, `Reviewing Pull Request #${prNumber}...`);
            const reviewResult = await reviewer.reviewPullRequest(owner, repo, prNumber, token, cancelToken);

            sidebarProvider.displayReviewResult(reviewResult);
            vscode.window.showInformationMessage(
              `${BRANDING.PRODUCT_NAME}: PR #${prNumber} review completed. Found ${reviewResult.totalIssues} issue(s).`
            );
          } catch (err: any) {
            sidebarProvider.broadcastState(false);
            if (!cancelToken.isCancellationRequested) {
              vscode.window.showErrorMessage(`${BRANDING.PRODUCT_NAME}: ${err?.message || 'Failed to review PR.'}`);
            }
          }
        }
      );
    })
  );

  // 32. Audit Dependencies for Vulnerabilities
  register(
    vscode.commands.registerCommand('fixora.auditDependencies', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${BRANDING.PRODUCT_NAME}: Auditing dependencies for vulnerabilities...`,
          cancellable: false,
        },
        async () => {
          const auditor = DependencyAuditor.getInstance();
          const result = await auditor.auditWorkspace();

          if (result.vulnerabilities.length === 0) {
            vscode.window.showInformationMessage(
              `${BRANDING.PRODUCT_NAME}: Dependency audit passed! ${result.totalDependencies} dependencies scanned across ${result.manifestsScanned.length} manifest(s). No known advisories detected.`
            );
          } else {
            vscode.window.showWarningMessage(
              `${BRANDING.PRODUCT_NAME}: Dependency audit found ${result.vulnerabilities.length} vulnerable package(s) across ${result.manifestsScanned.length} manifest(s).`
            );
          }
        }
      );
    })
  );

  // 33. Workspace Health & Quality Audit
  register(
    vscode.commands.registerCommand('fixora.workspaceHealth', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${BRANDING.PRODUCT_NAME}: Computing Workspace Health Score...`,
          cancellable: true,
        },
        async (_progress, token) => {
          const service = WorkspaceHealthService.getInstance();
          const report = await service.computeHealthReport(token);

          vscode.window.showInformationMessage(
            `${BRANDING.PRODUCT_NAME} Health: ${report.score}/100 (${report.rating}) — ${report.diagnostics.errors} errors, ${report.diagnostics.warnings} warnings, avg CC: ${report.complexity.averageCC}.`
          );
        }
      );
    })
  );

  logger.info(`All 33 ${BRANDING.PRODUCT_NAME} commands successfully registered and bound to lifecycle.`);
}
