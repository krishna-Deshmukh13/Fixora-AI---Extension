import * as vscode from 'vscode';
import { Logger } from './utils/logger';
import { SidebarProvider } from './providers/sidebarProvider';
import { registerAllCommands } from './commands';
import { AIManager } from './ai/aiManager';
import { HistoryManager } from './history/historyManager';
import { ReviewEngine } from './core/reviewEngine';
import { DebuggerEngine } from './core/debuggerEngine';
import { BugDetector } from './core/bugDetector';
import { SecurityEngine } from './core/securityEngine';
import { PerformanceEngine } from './core/performanceEngine';
import { WorkspaceReviewEngine } from './core/workspaceReviewEngine';
import { FixEngine } from './fixes/fixEngine';
import { FixoraDiffContentProvider } from './fixes/diffProvider';
import { PrivacyManager } from './security/privacyManager';
import { FixoraCodeActionProvider } from './diagnostics/codeActionProvider';
import { ErrorLensManager } from './diagnostics/errorLensManager';
import { PrettierFormatter } from './formatter/prettierFormatter';
import { ComplexityLensManager } from './metrics/complexityLensManager';
import { RealtimeLinter } from './linter/realtimeLinter';
import { BRANDING } from './constants/branding';

/**
 * Revion Extension Activation Entry Point.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = Logger.getInstance();
  logger.info(`${BRANDING.PRODUCT_NAME} extension activating...`);

  // Initialize Privacy & Security Guard
  const privacyManager = PrivacyManager.initialize(context);

  // Initialize Core Services
  const aiManager = AIManager.initialize(context);
  const historyManager = HistoryManager.initialize(context);
  const sidebarProvider = new SidebarProvider(context.extensionUri, context);
  const bugDetector = BugDetector.initialize(aiManager);
  const reviewEngine = ReviewEngine.initialize(aiManager, sidebarProvider, historyManager);
  DebuggerEngine.initialize(aiManager, sidebarProvider);
  SecurityEngine.initialize(aiManager, sidebarProvider);
  PerformanceEngine.initialize(aiManager, sidebarProvider);
  FixEngine.initialize(aiManager, sidebarProvider);
  WorkspaceReviewEngine.initialize(reviewEngine, sidebarProvider, historyManager);

  // Initialize Native Error Lens (Inline Diagnostics & Line Highlights)
  const errorLens = ErrorLensManager.initialize();
  context.subscriptions.push(errorLens);

  // Initialize Native Complexity Lens (Live function CC on right side & offline refactors)
  const complexityLens = ComplexityLensManager.initialize();
  context.subscriptions.push(complexityLens);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, complexityLens)
  );

  // Initialize Built-in Prettier Formatter
  const formatterDisposables = PrettierFormatter.getInstance().registerProviders();
  context.subscriptions.push(...formatterDisposables);

  // Initialize Real-time Multi-Language Linter (ESLint & Style as you type)
  const realtimeLinter = RealtimeLinter.initialize(context);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'html' },
        { scheme: 'file', language: 'css' },
        { scheme: 'file', language: 'scss' },
        { scheme: 'file', language: 'less' },
        { scheme: 'file', language: 'python' },
      ],
      realtimeLinter,
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      }
    )
  );

  // Register virtual document diff provider for Fix Preview
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      FixoraDiffContentProvider.scheme,
      FixoraDiffContentProvider.getInstance()
    )
  );

  // Check initial API Key presence asynchronously
  try {
    const isConfigured = await aiManager.isConfigured();
    sidebarProvider.setApiKeyConfigured(isConfigured);
    if (isConfigured) {
      logger.info('Detected existing Gemini API Key in SecretStorage.');
    } else {
      logger.info('No Gemini API Key found in SecretStorage on startup.');
    }
  } catch (err) {
    logger.error('Failed to read SecretStorage on activation', err);
  }

  // Register Webview View in Activity Bar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // Register Code Actions Provider for Quick Fix lightbulb actions
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file' },
      new FixoraCodeActionProvider(),
      {
        providedCodeActionKinds: FixoraCodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  // Register all 18 commands
  registerAllCommands(context, sidebarProvider);

  logger.info(`${BRANDING.PRODUCT_NAME} extension activated successfully. All core engines and security hardening active.`);
}

/**
 * Revion Extension Deactivation.
 */
export function deactivate(): void {
  const logger = Logger.getInstance();
  logger.info(`${BRANDING.PRODUCT_NAME} extension deactivated.`);
}
