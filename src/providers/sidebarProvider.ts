import * as vscode from 'vscode';
import {
  ChatMessage,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../types/webview';
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
import { AIManager } from '../ai/aiManager';
import { BRANDING } from '../constants/branding';

export { getNonce };

export interface SidebarStats {
  totalReviews: number;
  totalIssuesDetected: number;
  criticalCount: number;
  warningCount: number;
  fixesAccepted: number;
}

/**
 * Manages the Revion Sidebar Webview in the Activity Bar.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = BRANDING.VIEW_ID_SIDEBAR;

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
  private _chatMessages: ChatMessage[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    this.loadPersistedStats();
    this.registerActiveEditorListener();
  }

  private registerActiveEditorListener(): void {
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.broadcastState();
    }, null, this._context.subscriptions);

    vscode.window.onDidChangeTextEditorSelection(() => {
      this.broadcastState();
    }, null, this._context.subscriptions);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const isConfigured = this.isApiKeyConfigured();
    const config = vscode.workspace.getConfiguration(BRANDING.CONFIG_SECTION);
    const activeModel = config.get<string>('model', BRANDING.DEFAULT_GEMINI_MODEL);
    const learningMode = config.get<boolean>('enableLearningMode', false);

    webviewView.webview.html = this.getHtmlForWebview(
      webviewView.webview,
      isConfigured,
      activeModel,
      learningMode
    );

    // Handle messages coming from Webview UI
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await this.handleWebviewMessage(message);
      },
      undefined,
      this._context.subscriptions
    );

    // Initial state broadcast
    this.broadcastState();
  }

  /**
   * Handle user action messages received from the webview.
   */
  public async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    this._logger.info(`Revion sidebar received action: ${message.type}`);

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

      case 'runPerformanceReview':
        await vscode.commands.executeCommand('fixora.performanceReview');
        break;

      case 'runComplexityAudit':
        await vscode.commands.executeCommand('fixora.qualityReview');
        break;

      case 'explainTerminalError':
        await vscode.commands.executeCommand('fixora.explainTerminal');
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

      case 'submitApiKey':
        if (message.apiKey && message.apiKey.trim().length > 0) {
          const cleanKey = message.apiKey.trim();
          await this._context.secrets.store(BRANDING.SECRET_KEY_GEMINI, cleanKey);
          this.setApiKeyConfigured(true);
          vscode.window.showInformationMessage('Revion: Gemini API Key securely stored.');
          this.broadcastState();
        }
        break;

      case 'switchToOllama':
        const cfg = vscode.workspace.getConfiguration(BRANDING.CONFIG_SECTION);
        await cfg.update('provider', 'ollama', vscode.ConfigurationTarget.Global);
        this.setApiKeyConfigured(true);
        vscode.window.showInformationMessage('Revion: Switched to Local Ollama (100% Offline).');
        this.broadcastState();
        break;

      case 'runSampleReview':
        await this.runSampleReview();
        break;

      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', BRANDING.CONFIG_SECTION);
        break;

      case 'selectModel':
        await vscode.commands.executeCommand('fixora.selectModel');
        this.broadcastState();
        break;

      case 'clearDiagnostics':
        await vscode.commands.executeCommand('fixora.clearDiagnostics');
        this._currentReview = null;
        this._activeExplanation = null;
        this.broadcastState();
        break;

      case 'jumpToCode':
        await this.jumpToCode(message.filePath, message.line, message.column);
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

      case 'sendChatMessage':
        await this.handleUserChatMessage(message.text);
        break;

      case 'clearChat':
        this._chatMessages = [];
        this.broadcastState();
        break;

      case 'loadHistoryRun':
        if (message.recordId) {
          const history = HistoryManager.getInstance().getHistory();
          const record = history.find((h) => h.id === message.recordId);
          if (record) {
            this._currentReview = record.result;
            this.broadcastState();
            if (this._view) {
              this._view.webview.postMessage({
                type: 'reviewCompleted',
                data: record.result,
              });
            }
          }
        }
        break;

      case 'clearHistory':
        await HistoryManager.getInstance().clearHistory();
        this.broadcastState();
        break;
    }
  }

  /**
   * Interactive AI assistant chat handling.
   */
  private async handleUserChatMessage(userText: string): Promise<void> {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };
    this._chatMessages.push(userMsg);

    this.broadcastState(true, 'Thinking...');

    try {
      const editor = vscode.window.activeTextEditor;
      let contextCode = '';
      let filePath = 'active_editor';
      let languageId = 'plaintext';

      if (editor) {
        filePath = editor.document.fileName;
        languageId = editor.document.languageId;
        const selection = editor.selection;
        contextCode = selection && !selection.isEmpty
          ? editor.document.getText(selection)
          : editor.document.getText(new vscode.Range(0, 0, Math.min(150, editor.document.lineCount - 1), 200));
      }

      const aiManager = AIManager.getInstance();
      const isConfigured = await aiManager.isConfigured();

      if (!isConfigured) {
        const replyMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: '⚠️ **API Key Required:** To chat with Revion, please enter your Gemini API key in the connection banner above or switch to Local Ollama.',
          timestamp: new Date().toISOString(),
        };
        this._chatMessages.push(replyMsg);
        this.broadcastState(false);
        this._view?.webview.postMessage({ type: 'chatResponse', message: replyMsg });
        return;
      }

      // Query AI Provider
      const provider = await aiManager.getProvider();
      const prompt = `User question: "${userText}"\n\nCurrent file (${filePath}, language: ${languageId}):\n\`\`\`${languageId}\n${contextCode}\n\`\`\`\n\nProvide a concise, direct, professional response with code snippets if applicable.`;

      const result = await provider.reviewCode({
        code: contextCode || 'console.log("hello");',
        filePath,
        languageId,
        learningMode: false,
      });

      const replyText = result.summary || `Analysis completed for ${filePath.split(/[\\/]/).pop()}. Found ${result.totalIssues} issue(s).`;
      const replyMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toISOString(),
      };

      this._chatMessages.push(replyMsg);
      this.broadcastState(false);
      this._view?.webview.postMessage({ type: 'chatResponse', message: replyMsg });
    } catch (err: any) {
      this._logger.warn(`Chat assistant error: ${err?.message || err}`);
      const errorMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: `Error processing request: ${err?.message || 'Check network connection or API key'}.`,
        timestamp: new Date().toISOString(),
      };
      this._chatMessages.push(errorMsg);
      this.broadcastState(false);
      this._view?.webview.postMessage({ type: 'chatResponse', message: errorMsg });
    }
  }

  /**
   * Run sample analysis on bundled demo file.
   */
  private async runSampleReview(): Promise<void> {
    try {
      const demoUri = vscode.Uri.joinPath(this._extensionUri, 'samples', 'demo.js');
      const doc = await vscode.workspace.openTextDocument(demoUri);
      await vscode.window.showTextDocument(doc);
      await vscode.commands.executeCommand('fixora.qualityReview');
    } catch (err) {
      this._logger.warn('Could not open demo.js', err);
      vscode.window.showWarningMessage('Revion: Open any code file to run an audit.');
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
      vscode.window.showErrorMessage(`Revion: Could not open file ${filePath}`);
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

    const config = vscode.workspace.getConfiguration(BRANDING.CONFIG_SECTION);
    const providerType = config.get<'gemini' | 'ollama'>('provider', 'gemini');
    const isConfigured = this.isApiKeyConfigured();
    const activeModel = config.get<string>('model', BRANDING.DEFAULT_GEMINI_MODEL);
    const learningMode = config.get<boolean>('enableLearningMode', false);
    const errorLensEnabled = ErrorLensManager.getInstance().isEnabled();
    const complexityLensEnabled = ComplexityLensManager.getInstance().isEnabled();
    const formatterEnabled = PrettierFormatter.getInstance().isEnabled();
    const linterEnabled = RealtimeLinter.getInstance().isEnabled();

    // Active editor details
    let activeFile: { name: string; path: string; line: number } | null = null;
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const p = activeEditor.document.fileName;
      activeFile = {
        name: p.split(/[\\/]/).pop() || 'Untitled',
        path: p,
        line: activeEditor.selection.active.line + 1,
      };
    }

    const history = HistoryManager.getInstance().getHistory();

    const message: ExtensionToWebviewMessage = {
      type: 'stateUpdate',
      data: {
        isConfigured,
        providerType,
        activeModel,
        learningMode,
        activeFile,
        errorLensEnabled,
        complexityLensEnabled,
        formatterEnabled,
        linterEnabled,
        stats: this._stats,
        recentFiles: this._recentFiles,
        currentReview: this._currentReview,
        activeExplanation: this._activeExplanation,
        history,
        chatMessages: this._chatMessages,
        isLoading,
        loadingMessage,
      },
    };

    this._view.webview.postMessage(message);
  }

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

  public displayReviewResult(result: ReviewResult): void {
    this._currentReview = result;

    this._stats.totalReviews += 1;
    this._stats.totalIssuesDetected += result.totalIssues;
    this._stats.criticalCount += result.criticalCount;
    this._stats.warningCount += result.warningCount;

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

  public displayError(errorMessage: string): void {
    if (this._view) {
      this.broadcastState(false);
      this._view.webview.postMessage({
        type: 'reviewError',
        error: errorMessage,
      });
    }
  }

  private isApiKeyConfigured(): boolean {
    const config = vscode.workspace.getConfiguration(BRANDING.CONFIG_SECTION);
    const provider = config.get<string>('provider', 'gemini');
    if (provider === 'ollama') {
      return true;
    }
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
   * Generate CSP-compliant HTML for Revion Webview.
   */
  public getHtmlForWebview(
    webview: vscode.Webview,
    isConfigured: boolean,
    activeModel: string,
    _learningMode: boolean,
    nonceOverride?: string
  ): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
    );
    const nonce = nonceOverride || getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>${BRANDING.PRODUCT_NAME}</title>
</head>
<body>
  <div class="app-container">
    <!-- Progress Indicator Bar -->
    <div id="progress-bar" class="progress-bar-container">
      <div class="progress-bar-active" style="display: none;"></div>
    </div>

    <!-- Header Bar -->
    <header class="header-bar">
      <div class="brand-section">
        <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5.5 3.5h7a4.5 4.5 0 0 1 0 9h-7v8" />
          <path d="M12 12.5l6.5 8" />
          <path d="M16 4.5l3.5 3.5-3.5 3.5" stroke-width="1.8" />
        </svg>
        <span class="brand-name">${BRANDING.PRODUCT_NAME}</span>
      </div>

      <div class="header-actions">
        <div id="model-pill" class="model-pill" title="Click to switch AI model">
          <span id="status-dot" class="status-dot ${isConfigured ? '' : 'disconnected'}"></span>
          <span id="model-pill-text">${activeModel || 'Gemini 2.0 Flash'}</span>
        </div>
        <button id="btn-settings" class="icon-btn" title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
        <button id="btn-clear-all" class="icon-btn" title="Clear Diagnostics">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="segmented-nav" aria-label="Revion Navigation">
      <button class="nav-tab active" data-tab="tab-assistant">
        <span>Assistant</span>
      </button>
      <button class="nav-tab" data-tab="tab-review">
        <span>Review</span>
      </button>
      <button class="nav-tab" data-tab="tab-issues">
        <span>Issues</span>
        <span id="issues-badge" class="nav-badge">0</span>
      </button>
      <button class="nav-tab" data-tab="tab-history">
        <span>History</span>
      </button>
    </nav>

    <!-- TAB 1: Assistant -->
    <main id="tab-assistant" class="tab-panel active">
      <!-- First-Run Onboarding Banner -->
      <section id="onboarding-card" class="onboarding-card" style="display: ${isConfigured ? 'none' : 'block'};">
        <h2 class="onboarding-title">⚡ Welcome to Revion</h2>
        <p class="onboarding-text">To enable context-aware AI code reviews, connect your Google Gemini API key or switch to Local Ollama.</p>
        <div class="onboarding-input-group">
          <input type="password" id="input-api-key" class="onboarding-input" placeholder="AIzaSy... (Gemini API Key)" aria-label="Gemini API Key" />
          <button id="btn-connect-key" class="btn btn-sm">Connect</button>
        </div>
        <div class="onboarding-actions">
          <button id="btn-use-ollama" class="btn btn-secondary btn-sm">Use Local Ollama (Offline)</button>
          <button id="btn-try-sample" class="btn btn-secondary btn-sm">Try Sample Code</button>
        </div>
      </section>

      <!-- Active File Context Chip -->
      <div id="context-chip" class="context-chip" style="display: none;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span id="context-file-name" class="context-file-name">No active file</span>
      </div>

      <!-- Chat Stream -->
      <div id="chat-stream" class="chat-stream">
        <div class="chat-welcome empty-box">
          <p><strong>Ask Revion about your code.</strong></p>
          <p style="font-size: 11px; opacity: 0.75;">Select code in your editor to ask questions, audit security, or explore refactoring options.</p>
        </div>
      </div>

      <!-- Quick Prompt Pills -->
      <div class="prompt-chips-row">
        <button class="prompt-chip" data-prompt="Explain this error and how to fix it">Explain Error</button>
        <button class="prompt-chip" data-prompt="Audit this code for security vulnerabilities">Audit Security</button>
        <button class="prompt-chip" data-prompt="Suggest a clean refactor for this function">Refactor Code</button>
        <button class="prompt-chip" data-prompt="Check for performance bottlenecks">Performance</button>
      </div>

      <!-- Prompt Composer -->
      <div class="composer-box">
        <textarea id="composer-textarea" class="composer-textarea" placeholder="Ask a question or request a code audit... (Enter to send, Shift+Enter for newline)" rows="1" aria-label="Revion Prompt"></textarea>
        <div class="composer-footer">
          <span style="font-size: 10px; color: var(--revion-muted);">Markdown supported</span>
          <button id="btn-send-message" class="btn btn-sm">Send</button>
        </div>
      </div>
    </main>

    <!-- TAB 2: Review (Audits & Toggles) -->
    <main id="tab-review" class="tab-panel">
      <!-- Real-time Engines Card -->
      <div class="feature-card">
        <div class="feature-heading">Real-Time Native Engines</div>
        
        <div class="toggle-row">
          <div class="toggle-label">
            <span class="toggle-name">Error Lens</span>
            <span class="toggle-desc">Inline diagnostic text & line highlights</span>
          </div>
          <label class="switch" aria-label="Toggle Error Lens">
            <input type="checkbox" id="toggle-error-lens" checked />
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-label">
            <span class="toggle-name">Complexity Lens</span>
            <span class="toggle-desc">Live ⚡ CC badges & offline refactorings</span>
          </div>
          <label class="switch" aria-label="Toggle Complexity Lens">
            <input type="checkbox" id="toggle-complexity-lens" checked />
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-label">
            <span class="toggle-name">Real-Time Linter</span>
            <span class="toggle-desc">As-you-type checks for JS, TS, Py, HTML, CSS</span>
          </div>
          <label class="switch" aria-label="Toggle Real-time Linter">
            <input type="checkbox" id="toggle-linter" checked />
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-row">
          <div class="toggle-label">
            <span class="toggle-name">Prettier Formatter</span>
            <span class="toggle-desc">Auto-formatting & silent syntax healing</span>
          </div>
          <label class="switch" aria-label="Toggle Prettier Formatter">
            <input type="checkbox" id="toggle-formatter" checked />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <!-- Scope Action Buttons Grid -->
      <div class="feature-heading">Audits & Workflows</div>
      <div class="actions-grid">
        <button id="btn-review-file" class="btn btn-secondary">Review Current File</button>
        <button id="btn-review-selection" class="btn btn-secondary">Review Selection</button>
        <button id="btn-security-scan" class="btn btn-secondary">Security Audit (OWASP)</button>
        <button id="btn-complexity-audit" class="btn btn-secondary">Code Health Audit</button>
        <button id="btn-review-workspace" class="btn btn-secondary">Review Workspace</button>
        <button id="btn-review-git" class="btn btn-secondary">Review Git Changes</button>
        <button id="btn-explain-terminal" class="btn btn-secondary">Explain Terminal Error</button>
        <button id="btn-format-document" class="btn btn-secondary">Format Document</button>
      </div>

      <div style="display: flex; gap: 6px; margin-top: 6px;">
        <button id="btn-install-hook" class="btn btn-secondary btn-full btn-sm">Install Pre-Commit Guard</button>
        <button id="btn-export-report" class="btn btn-secondary btn-full btn-sm">Export HTML Report</button>
      </div>
    </main>

    <!-- TAB 3: Issues (Findings Inspector) -->
    <main id="tab-issues" class="tab-panel">
      <div class="findings-filter-bar">
        <button class="filter-chip active" data-severity="all">All</button>
        <button class="filter-chip" data-severity="critical">Critical</button>
        <button class="filter-chip" data-severity="warning">Warnings</button>
        <button class="filter-chip" data-severity="info">Hints</button>
      </div>

      <div id="findings-list">
        <div class="empty-box">
          <div>✓ No active issues detected</div>
          <div style="font-size: 10.5px; margin-top: 4px; opacity: 0.7;">Run an audit from the Review tab to scan your code.</div>
        </div>
      </div>
    </main>

    <!-- TAB 4: History -->
    <main id="tab-history" class="tab-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="feature-heading" style="margin-bottom: 0;">Past Review Runs</span>
        <button id="btn-clear-history" class="btn btn-secondary btn-sm" style="font-size: 10px; padding: 2px 6px;">Clear</button>
      </div>
      <div id="history-list">
        <div class="empty-box">No past review runs recorded yet.</div>
      </div>
    </main>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
