import * as vscode from 'vscode';
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../types/webview';
import { ReviewResult } from '../types/review';
import { ErrorExplanationResult } from '../types/providers';
import { Logger } from '../utils/logger';
import { getNonce } from '../utils/nonce';
import { HistoryManager } from '../history/historyManager';
import { FixEngine } from '../fixes/fixEngine';
import { ErrorLensManager } from '../diagnostics/errorLensManager';
import { ComplexityLensManager } from '../metrics/complexityLensManager';
import { PrettierFormatter } from '../formatter/prettierFormatter';
import { RealtimeLinter } from '../linter/realtimeLinter';

export { getNonce };

export interface SidebarStats {
  totalReviews: number;
  totalIssuesDetected: number;
  criticalCount: number;
  warningCount: number;
  fixesAccepted: number;
}

/**
 * Manages the Fixora AI Sidebar Webview in the Activity Bar.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'fixora.sidebar';

  private _view?: vscode.WebviewView;
  private _logger = Logger.getInstance();
  private _stats: SidebarStats = {
    totalReviews: 0,
    totalIssuesDetected: 0,
    criticalCount: 0,
    warningCount: 0,
    fixesAccepted: 0,
  };
  private _currentReview: ReviewResult | null = null;
  private _activeExplanation: {
    error: string;
    explanation: ErrorExplanationResult;
    filePath?: string;
    line?: number;
  } | null = null;
  private _recentFiles: string[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    this.loadPersistedStats();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const isConfigured = this.isApiKeyConfigured();
    const config = vscode.workspace.getConfiguration('fixora');
    const activeModel = config.get<string>('model', 'gemini-3.8-flash');
    const learningMode = config.get<boolean>('enableLearningMode', false);

    webviewView.webview.html = this.getHtmlForWebview(
      webviewView.webview,
      isConfigured,
      activeModel,
      learningMode
    );

    // Listen for messages coming from the Webview script
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await this.handleWebviewMessage(message);
      },
      undefined,
      this._context.subscriptions
    );

    // Send initial state once webview is ready
    this.broadcastState();
  }

  /**
   * Handle user action messages received from the webview.
   */
  public async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    this._logger.info(`Sidebar received action: ${message.type}`);

    switch (message.type) {
      case 'requestInitialState':
        this.broadcastState();
        break;

      case 'runReviewSelection':
        await vscode.commands.executeCommand('fixora.reviewSelection');
        break;

      case 'runReviewFile':
        await vscode.commands.executeCommand('fixora.reviewFile');
        break;

      case 'runReviewWorkspace':
        await vscode.commands.executeCommand('fixora.reviewWorkspace');
        break;

      case 'runSecurityScan':
        await vscode.commands.executeCommand('fixora.securityScan');
        break;

      case 'explainTerminalError':
        await vscode.commands.executeCommand('fixora.explainTerminal');
        break;

      case 'runPerformanceReview':
        await vscode.commands.executeCommand('fixora.performanceReview');
        break;

      case 'runComplexityAudit':
        await vscode.commands.executeCommand('fixora.analyzeComplexity');
        break;

      case 'exportReport':
        await vscode.commands.executeCommand('fixora.exportReport');
        break;

      case 'installGitHook':
        await vscode.commands.executeCommand('fixora.installGitHook');
        break;

      case 'formatDocument':
        await vscode.commands.executeCommand('fixora.formatDocument');
        break;

      case 'toggleErrorLens':
        await vscode.commands.executeCommand('fixora.toggleInlineDiagnostics');
        this.broadcastState();
        break;

      case 'toggleComplexityLens':
        await vscode.commands.executeCommand('fixora.toggleComplexityLens');
        this.broadcastState();
        break;

      case 'toggleFormatter':
        await vscode.commands.executeCommand('fixora.toggleFormatter');
        this.broadcastState();
        break;

      case 'toggleLinter':
        await vscode.commands.executeCommand('fixora.toggleLinter');
        this.broadcastState();
        break;

      case 'toggleFeature':
        if (message.feature === 'errorLens') {
          ErrorLensManager.getInstance().toggle(message.enabled);
        } else if (message.feature === 'complexityLens') {
          ComplexityLensManager.getInstance().toggle(message.enabled);
        } else if (message.feature === 'formatter') {
          PrettierFormatter.getInstance().toggle(message.enabled);
        } else if (message.feature === 'linter') {
          RealtimeLinter.getInstance().toggle(message.enabled);
        }
        this.broadcastState();
        break;

      case 'configureApiKey':
        await vscode.commands.executeCommand('fixora.configureApiKey');
        this.broadcastState();
        break;

      case 'clearDiagnostics':
        await vscode.commands.executeCommand('fixora.clearDiagnostics');
        this._currentReview = null;
        this.broadcastState();
        break;

      case 'selectModel':
        if (message.model) {
          const config = vscode.workspace.getConfiguration('fixora');
          await config.update('model', message.model, vscode.ConfigurationTarget.Global);
          this.broadcastState();
        }
        break;

      case 'toggleLearningMode':
        const cfg = vscode.workspace.getConfiguration('fixora');
        await cfg.update('enableLearningMode', message.enabled, vscode.ConfigurationTarget.Global);
        this.broadcastState();
        break;

      case 'jumpToCode':
        await this.jumpToCode(message.filePath, message.line, message.column);
        break;

      case 'explainFinding':
        vscode.window.showInformationMessage(`Fixora AI: Explaining finding ${message.findingId}`);
        break;

      case 'previewFix':
        if (message.findingId && this._currentReview) {
          const finding = this._currentReview.findings.find((f) => f.id === message.findingId);
          if (finding) {
            await FixEngine.getInstance().previewFix(finding);
          }
        }
        break;

      case 'applyFix':
        if (message.findingId && this._currentReview) {
          const finding = this._currentReview.findings.find((f) => f.id === message.findingId);
          if (finding) {
            const applied = await FixEngine.getInstance().applyFix(finding);
            if (applied) {
              this._stats.fixesAccepted += 1;
              this.persistStats();
              this.broadcastState();
            }
          }
        }
        break;
    }
  }

  /**
   * Navigate editor directly to a specific file, line, and column.
   */
  private async jumpToCode(filePath: string, line: number, column?: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      const targetLine = Math.max(0, line - 1);
      const targetColumn = Math.max(0, (column || 1) - 1);
      const position = new vscode.Position(targetLine, targetColumn);
      const range = new vscode.Range(position, position);

      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (err) {
      this._logger.error(`Failed to navigate to ${filePath}:${line}`, err);
      vscode.window.showErrorMessage(`Fixora AI: Could not open file ${filePath}`);
    }
  }

  public getCurrentReview(): ReviewResult | null {
    return this._currentReview;
  }

  /**
   * Broadcast current extension and analysis state to the webview.
   */
  public broadcastState(isLoading = false, loadingMessage?: string): void {
    if (!this._view) {
      return;
    }

    const config = vscode.workspace.getConfiguration('fixora');
    const isConfigured = this.isApiKeyConfigured();
    const activeModel = config.get<string>('model', 'gemini-3.8-flash');
    const learningMode = config.get<boolean>('enableLearningMode', false);
    const errorLensEnabled = ErrorLensManager.getInstance().isEnabled();
    const complexityLensEnabled = ComplexityLensManager.getInstance().isEnabled();
    const formatterEnabled = PrettierFormatter.getInstance().isEnabled();
    const linterEnabled = RealtimeLinter.getInstance().isEnabled();

    const message: ExtensionToWebviewMessage = {
      type: 'stateUpdate',
      data: {
        isConfigured,
        activeModel,
        learningMode,
        errorLensEnabled,
        complexityLensEnabled,
        formatterEnabled,
        linterEnabled,
        stats: this._stats,
        recentFiles: this._recentFiles,
        currentReview: this._currentReview,
        activeExplanation: this._activeExplanation,
        isLoading,
        loadingMessage,
      },
    };

    this._view.webview.postMessage(message);
  }

  /**
   * Publish error explanation to the sidebar.
   */
  public displayErrorExplanation(
    error: string,
    explanation: ErrorExplanationResult,
    filePath?: string,
    line?: number
  ): void {
    this._activeExplanation = { error, explanation, filePath, line };

    if (this._view) {
      this.broadcastState(false);
      this._view.webview.postMessage({
        type: 'errorExplained',
        data: {
          error,
          explanation,
          filePath,
          line,
        },
      });
    }
  }

  /**
   * Publish review results to the sidebar.
   */
  public displayReviewResult(result: ReviewResult): void {
    this._currentReview = result;

    // Update stats
    this._stats.totalReviews += 1;
    this._stats.totalIssuesDetected += result.totalIssues;
    this._stats.criticalCount += result.criticalCount;
    this._stats.warningCount += result.warningCount;

    // Track recent file
    for (const file of result.filesAnalyzed) {
      if (!this._recentFiles.includes(file)) {
        this._recentFiles.unshift(file);
      }
    }
    this._recentFiles = this._recentFiles.slice(0, 5);

    this.persistStats();

    if (this._view) {
      this.broadcastState(false);
      this._view.webview.postMessage({
        type: 'reviewCompleted',
        data: result,
      });
    }
  }

  /**
   * Notify sidebar of review error.
   */
  public displayError(errorMessage: string): void {
    if (this._view) {
      this.broadcastState(false);
      this._view.webview.postMessage({
        type: 'reviewError',
        error: errorMessage,
      });
    }
  }

  /**
   * Check if user has configured the Gemini API Key.
   */
  private isApiKeyConfigured(): boolean {
    // Note: checking SecretStorage synchronously is supported via cached flag
    // We maintain a boolean flag in extensionContext.workspaceState
    return this._context.workspaceState.get<boolean>('fixora.hasApiKey', false);
  }

  public setApiKeyConfigured(configured: boolean): void {
    this._context.workspaceState.update('fixora.hasApiKey', configured);
    this.broadcastState();
  }

  private loadPersistedStats(): void {
    const saved = this._context.globalState.get<SidebarStats>('fixora.sidebarStats');
    if (saved) {
      this._stats = saved;
    }
  }

  private persistStats(): void {
    this._context.globalState.update('fixora.sidebarStats', this._stats);
  }

  /**
   * Generate CSP-compliant HTML for the Webview.
   */
  public getHtmlForWebview(
    webview: vscode.Webview,
    isConfigured: boolean,
    activeModel: string,
    learningMode: boolean,
    nonceOverride?: string
  ): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
    );
    const iconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.png')
    );

    const nonce = nonceOverride || getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Fixora AI</title>
</head>
<body>
  <!-- Brand Header -->
  <div class="header-container">
    <img src="${iconUri}" alt="Fixora AI Logo" class="logo-badge" />
    <div>
      <h1 class="header-title">Fixora AI</h1>
      <p class="tagline">Find Bugs. Understand Errors. Fix Code. Build Better.</p>
    </div>
  </div>

  <!-- API Key Missing Notice -->
  <div id="key-notice" style="display: ${isConfigured ? 'none' : 'block'}; margin-bottom: 14px; padding: 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid var(--severity-warning); border-radius: 6px; font-size: 0.82em;">
    <strong>API Key Required:</strong> Configure your Gemini API key to activate AI analysis and error explanations.
    <div style="margin-top: 8px;">
      <button id="btn-configure-key" class="fixora-btn" style="width: 100%; font-size: 0.82em; padding: 4px 8px;">Configure Gemini API Key</button>
    </div>
  </div>

  <!-- Live Editor Features & Toggles -->
  <div class="action-section feature-controls-section">
    <div class="section-heading">Live Editor Features</div>
    <div class="toggle-cards-list">
      <div class="toggle-card">
        <div class="toggle-info">
          <div class="toggle-title">
            <span class="toggle-icon">⚡</span>
            <span>Error Lens</span>
          </div>
          <div class="toggle-subtitle">Inline error & warning diagnostics</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-error-lens" checked>
          <span class="slider round"></span>
        </label>
      </div>

      <div class="toggle-card">
        <div class="toggle-info">
          <div class="toggle-title">
            <span class="toggle-icon">🧠</span>
            <span>Code Complexity Lens</span>
          </div>
          <div class="toggle-subtitle">Live CC on right side & auto-refactor</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-complexity-lens" checked>
          <span class="slider round"></span>
        </label>
      </div>

      <div class="toggle-card">
        <div class="toggle-info">
          <div class="toggle-title">
            <span class="toggle-icon">🔍</span>
            <span>Real-time Linter (ESLint & Style)</span>
          </div>
          <div class="toggle-subtitle">Catches syntax & style issues in JS, TS, HTML, CSS, Python as you type</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-linter" checked>
          <span class="slider round"></span>
        </label>
      </div>

      <div class="toggle-card">
        <div class="toggle-info">
          <div class="toggle-title">
            <span class="toggle-icon">✨</span>
            <span>Prettier Formatter</span>
          </div>
          <div class="toggle-subtitle">Auto-healing format on save & run</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-formatter" checked>
          <span class="slider round"></span>
        </label>
      </div>
    </div>

    <div class="feature-actions-row">
      <button id="btn-format-document" class="fixora-btn secondary compact-btn">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
          <path d="M3 4.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/>
        </svg>
        Format Document
      </button>
      <button id="btn-complexity-audit" class="fixora-btn secondary compact-btn">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 11H2v3h2v-3zm5-4H7v7h2V7zm5-5h-2v12h2V2z"/>
        </svg>
        Complexity Audit
      </button>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="action-section">
    <div class="section-heading">AI Actions & Security</div>
    <div class="button-stack">
      <button id="btn-review-selection" class="fixora-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v2H2zm0 4h12v2H2zm0 4h8v2H2z"/>
        </svg>
        Review Selected Code
      </button>
      <button id="btn-review-file" class="fixora-btn secondary">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 1h6l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5 1v3h3"/>
        </svg>
        Review Current File
      </button>
      <button id="btn-security-scan" class="fixora-btn secondary">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L2 3.5v5c0 3.7 2.6 6.8 6 7.5 3.4-.7 6-3.8 6-7.5v-5L8 1z"/>
        </svg>
        Security Scan
      </button>
      <button id="btn-review-workspace" class="fixora-btn secondary">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.764a1.5 1.5 0 0 1 1.06.44l1.236 1.236A.5.5 0 0 0 8.914 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
        </svg>
        Review Workspace
      </button>
      <button id="btn-review-git" class="fixora-btn secondary">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Review Git Changes
      </button>
      <button id="btn-export-report" class="fixora-btn secondary">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
        </svg>
        Export HTML Report
      </button>
      <button id="btn-install-hook" class="fixora-btn secondary">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a2 2 0 0 1 2 2v2H6V3a2 2 0 0 1 2-2zm3 4V3a3 3 0 0 0-6 0v2a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>
        </svg>
        Install Git Pre-Commit Guard
      </button>
    </div>
  </div>

  <!-- Active Status / Progress Indicator -->
  <div id="status-container"></div>

  <!-- Findings List -->
  <div class="action-section">
    <div class="section-heading">Active Findings</div>
    <div id="findings-list" class="findings-container">
      <div class="empty-box">No active findings. Run a review on your code to see detailed analysis.</div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
