import * as vscode from 'vscode';
import { AIManager } from '../ai/aiManager';
import { SidebarProvider } from '../providers/sidebarProvider';
import { LanguageDetector } from '../utils/languageDetector';
import { Logger } from '../utils/logger';
import { ErrorExplanationResult } from '../types';
import { BRANDING } from '../constants/branding';

export interface StackTraceLocation {
  filePath?: string;
  line?: number;
  column?: number;
}

/**
 * Core engine responsible for diagnosing, explaining, and troubleshooting errors and stack traces.
 */
export class DebuggerEngine {
  private static instance: DebuggerEngine;
  private logger = Logger.getInstance();

  private constructor(
    private readonly aiManager: AIManager,
    private readonly sidebarProvider: SidebarProvider
  ) {}

  public static initialize(aiManager: AIManager, sidebarProvider: SidebarProvider): DebuggerEngine {
    if (!DebuggerEngine.instance) {
      DebuggerEngine.instance = new DebuggerEngine(aiManager, sidebarProvider);
    }
    return DebuggerEngine.instance;
  }

  public static getInstance(): DebuggerEngine {
    if (!DebuggerEngine.instance) {
      throw new Error('DebuggerEngine must be initialized before use.');
    }
    return DebuggerEngine.instance;
  }

  /**
   * Explains a specific VS Code diagnostic problem with surrounding code context.
   */
  public async explainDiagnostic(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): Promise<ErrorExplanationResult | null> {
    const filePath = document.fileName;
    const line = diagnostic.range.start.line + 1;
    const languageInfo = LanguageDetector.detect(filePath, document.languageId);

    // Extract surrounding code context (3 lines above and below)
    const startLine = Math.max(0, diagnostic.range.start.line - 3);
    const endLine = Math.min(document.lineCount - 1, diagnostic.range.end.line + 3);
    const surroundingRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    const codeSnippet = document.getText(surroundingRange);

    const errorMessage = `${diagnostic.message} ${diagnostic.code ? `[Code: ${diagnostic.code}]` : ''} ${diagnostic.source ? `(${diagnostic.source})` : ''}`.trim();

    return this.runExplanationWithProgress(
      errorMessage,
      codeSnippet,
      filePath,
      line,
      undefined,
      languageInfo.id
    );
  }

  /**
   * Explains a user-provided terminal error, compiler log, or stack trace.
   */
  public async explainTerminalError(rawErrorText: string): Promise<ErrorExplanationResult | null> {
    const location = this.parseStackTrace(rawErrorText);
    let codeSnippet: string | undefined;
    let languageId = 'plaintext';

    // If location points to a local file, attempt to load surrounding code
    if (location.filePath) {
      try {
        const uri = vscode.Uri.file(location.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        languageId = doc.languageId;

        const targetLine = Math.max(0, (location.line || 1) - 1);
        const start = Math.max(0, targetLine - 3);
        const end = Math.min(doc.lineCount - 1, targetLine + 3);
        const range = new vscode.Range(start, 0, end, doc.lineAt(end).text.length);
        codeSnippet = doc.getText(range);
      } catch {
        this.logger.info(`Could not open file from stack trace: ${location.filePath}`);
      }
    }

    return this.runExplanationWithProgress(
      rawErrorText,
      codeSnippet,
      location.filePath,
      location.line,
      rawErrorText,
      languageId
    );
  }

  /**
   * Explains arbitrary error text with optional code snippet.
   */
  public async explainCustomError(
    errorMessage: string,
    codeSnippet?: string,
    filePath?: string,
    line?: number,
    languageId?: string
  ): Promise<ErrorExplanationResult | null> {
    return this.runExplanationWithProgress(
      errorMessage,
      codeSnippet,
      filePath,
      line,
      undefined,
      languageId || 'plaintext'
    );
  }

  /**
   * Parses stack trace text across multiple language formats (Node/V8, Python, Java, C/C++, PHP).
   */
  public parseStackTrace(text: string): StackTraceLocation {
    if (!text || typeof text !== 'string') {
      return {};
    }

    // 1. Node.js / V8 format with parentheses: at function (path/to/file.ext:line:col)
    const nodeParenMatch = text.match(/\((.+?):(\d+):(\d+)\)/);
    if (nodeParenMatch) {
      return {
        filePath: nodeParenMatch[1].trim(),
        line: parseInt(nodeParenMatch[2], 10),
        column: parseInt(nodeParenMatch[3], 10),
      };
    }

    // 2. Node.js / V8 format without parentheses: at path/to/file.ext:line:col
    const nodeNoParenMatch = text.match(/at\s+(.+?):(\d+):(\d+)/);
    if (nodeNoParenMatch) {
      return {
        filePath: nodeNoParenMatch[1].trim(),
        line: parseInt(nodeNoParenMatch[2], 10),
        column: parseInt(nodeNoParenMatch[3], 10),
      };
    }

    // 2. Python format: File "path/to/file.py", line 42, in function_name
    const pythonMatch = text.match(/File\s+["']([^"']+)["'],\s+line\s+(\d+)/i);
    if (pythonMatch) {
      return {
        filePath: pythonMatch[1].trim(),
        line: parseInt(pythonMatch[2], 10),
      };
    }

    // 3. GCC / Clang / Rust / TypeScript compiler format: path/to/file.ext:line:col: error: ...
    const compilerMatch = text.match(/([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+):(\d+)(?::(\d+))?:\s*(?:error|warning|fatal)/i);
    if (compilerMatch) {
      return {
        filePath: compilerMatch[1].trim(),
        line: parseInt(compilerMatch[2], 10),
        column: compilerMatch[3] ? parseInt(compilerMatch[3], 10) : undefined,
      };
    }

    // 4. Java format: at com.example.MyClass.method(MyClass.java:42)
    const javaMatch = text.match(/\(([^:\n]+\.java):(\d+)\)/i);
    if (javaMatch) {
      return {
        filePath: javaMatch[1].trim(),
        line: parseInt(javaMatch[2], 10),
      };
    }

    // 5. PHP format: in /path/to/file.php on line 42
    const phpMatch = text.match(/in\s+([^\n]+\.php)\s+on\s+line\s+(\d+)/i);
    if (phpMatch) {
      return {
        filePath: phpMatch[1].trim(),
        line: parseInt(phpMatch[2], 10),
      };
    }

    return {};
  }

  private async runExplanationWithProgress(
    errorMessage: string,
    codeSnippet?: string,
    filePath?: string,
    line?: number,
    stackTrace?: string,
    languageId?: string
  ): Promise<ErrorExplanationResult | null> {
    const isConfigured = await this.aiManager.isConfigured();
    if (!isConfigured) {
      const action = await vscode.window.showWarningMessage(
        `${BRANDING.PRODUCT_NAME} requires an AI provider configured to explain errors.`,
        'Configure API Key'
      );
      if (action === 'Configure API Key') {
        await vscode.commands.executeCommand('fixora.configureApiKey');
      }
      return null;
    }

    const config = vscode.workspace.getConfiguration('fixora');
    const learningMode = config.get<boolean>('enableLearningMode', false);

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${BRANDING.PRODUCT_NAME}: Explaining Error`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ message: 'Analyzing error and root cause...' });
        this.sidebarProvider.broadcastState(true, 'Analyzing error...');

        try {
          const explanation = await this.aiManager.explainError(
            {
              errorMessage,
              codeSnippet,
              filePath,
              line,
              stackTrace,
              languageId,
              learningMode,
            },
            token
          );

          // Broadcast explanation to sidebar webview
          this.sidebarProvider.displayErrorExplanation(errorMessage, explanation, filePath, line);

          vscode.window.showInformationMessage(
            `${BRANDING.PRODUCT_NAME}: Error explained — "${explanation.whatHappened.slice(0, 60)}..."`
          );

          return explanation;
        } catch (err: any) {
          if (token.isCancellationRequested) {
            this.sidebarProvider.broadcastState(false);
            return null;
          }

          const msg = err?.message || 'Failed to explain error.';
          this.sidebarProvider.displayError(msg);
          vscode.window.showErrorMessage(`${BRANDING.PRODUCT_NAME}: ${msg}`);
          return null;
        }
      }
    );
  }
}
