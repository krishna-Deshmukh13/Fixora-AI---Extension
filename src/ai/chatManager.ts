import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIManager } from './aiManager';
import { PrivacyManager } from '../security/privacyManager';
import { BRANDING } from '../constants/branding';
import { Logger } from '../utils/logger';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  contextAttached?: {
    activeFile?: string;
    selectionRange?: string;
    diagnosticsCount?: number;
    referencedFiles?: string[];
  };
}

export class ChatManager {
  private static instance: ChatManager;
  private logger = Logger.getInstance();
  private messages: ChatMessage[] = [];
  private static readonly MAX_HISTORY_TURNS = 10;

  private constructor(private readonly aiManager: AIManager) {}

  public static initialize(aiManager: AIManager): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager(aiManager);
    }
    return ChatManager.instance;
  }

  public static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      throw new Error('ChatManager must be initialized before use.');
    }
    return ChatManager.instance;
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public clearMessages(): void {
    this.messages = [];
  }

  /**
   * Resolves editor context: active file snippet, selected code, active diagnostics, and @file mentions.
   */
  public async resolveContext(userPrompt: string): Promise<{
    contextHeader: string;
    referencedFiles: string[];
    activeFile?: string;
    diagnosticsCount: number;
    selectionRange?: string;
  }> {
    const referencedFiles: string[] = [];
    const contextSections: string[] = [];
    let activeFile: string | undefined;
    let selectionRange: string | undefined;
    let diagnosticsCount = 0;

    // 1. Check active editor context
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document) {
      activeFile = editor.document.fileName;
      const selection = editor.selection;

      if (!selection.isEmpty) {
        const selectedCode = editor.document.getText(selection);
        selectionRange = `Lines ${selection.start.line + 1}-${selection.end.line + 1}`;
        contextSections.push(
          `[Active Selection in ${path.basename(activeFile)} (${selectionRange})]:\n\`\`\`${editor.document.languageId}\n${selectedCode}\n\`\`\``
        );
      } else {
        // Grab bounded snippet around cursor (up to 60 lines)
        const line = selection.active.line;
        const startLine = Math.max(0, line - 25);
        const endLine = Math.min(editor.document.lineCount - 1, line + 25);
        const snippetRange = new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length);
        const snippet = editor.document.getText(snippetRange);
        contextSections.push(
          `[Active File Context: ${path.basename(activeFile)} (Lines ${startLine + 1}-${endLine + 1} of ${editor.document.lineCount})]:\n\`\`\`${editor.document.languageId}\n${snippet}\n\`\`\``
        );
      }

      // Check active diagnostics on current file
      const docDiags = vscode.languages.getDiagnostics(editor.document.uri) || [];
      if (docDiags.length > 0) {
        diagnosticsCount = docDiags.length;
        const diagsSummary = docDiags
          .slice(0, 5)
          .map((d) => `• Line ${d.range.start.line + 1}: [${d.severity}] ${d.message}`)
          .join('\n');
        contextSections.push(`[Active File Diagnostics (${docDiags.length} issues)]:\n${diagsSummary}`);
      }
    }

    // 2. Parse @file mentions (e.g., @src/index.ts or @package.json)
    const mentionRegex = /@([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/g;
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(userPrompt)) !== null) {
      const relPath = match[1];
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const root = workspaceFolders[0].uri.fsPath;
        const absPath = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
        if (fs.existsSync(absPath)) {
          try {
            const content = fs.readFileSync(absPath, 'utf8');
            // Bounded snippet up to 100 lines / 10KB
            const lines = content.split(/\r?\n/).slice(0, 100).join('\n');
            referencedFiles.push(relPath);
            contextSections.push(`[Referenced File @${relPath}]:\n\`\`\`\n${lines}\n\`\`\``);
          } catch {
            // Skip unreadable files
          }
        }
      }
    }

    return {
      contextHeader: contextSections.join('\n\n'),
      referencedFiles,
      activeFile,
      diagnosticsCount,
      selectionRange,
    };
  }

  /**
   * Sends user message, attaches active context, strips secrets, and streams response chunks.
   */
  public async sendMessage(
    userPrompt: string,
    onChunk: (chunk: string) => void,
    cancellationToken?: vscode.CancellationToken
  ): Promise<string> {
    if (!userPrompt.trim()) {
      return '';
    }

    // Client-side privacy and secret redaction
    const privacy = PrivacyManager.getInstance();
    const redactedPrompt = privacy.redactSecrets(userPrompt);

    // Resolve context
    const context = await this.resolveContext(userPrompt);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: redactedPrompt,
      timestamp: new Date().toISOString(),
      contextAttached: {
        activeFile: context.activeFile,
        selectionRange: context.selectionRange,
        diagnosticsCount: context.diagnosticsCount,
        referencedFiles: context.referencedFiles,
      },
    };

    this.messages.push(userMessage);

    // Build prompt with conversation history and context
    let promptToSend = '';
    if (context.contextHeader) {
      promptToSend += `--- RELEVANT CONTEXT ---\n${context.contextHeader}\n\n`;
    }

    // Attach recent conversation turns
    const recentTurns = this.messages.slice(-ChatManager.MAX_HISTORY_TURNS);
    if (recentTurns.length > 1) {
      promptToSend += '--- CONVERSATION HISTORY ---\n';
      for (const msg of recentTurns.slice(0, -1)) {
        promptToSend += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      }
      promptToSend += '\n';
    }

    promptToSend += `User: ${redactedPrompt}\nAssistant:`;

    const systemInstruction = `You are ${BRANDING.PRODUCT_NAME}, an expert software engineering assistant integrated directly into VS Code.
Help the developer understand code, solve bugs, refactor architecture, and design tests.
Be concise, clear, and code-centric. Suggest idiomatic fixes and adhere to clean code standards.`;

    try {
      const response = await this.aiManager.streamChat(
        promptToSend,
        onChunk,
        systemInstruction,
        cancellationToken
      );

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      this.messages.push(assistantMessage);

      // Bound history
      if (this.messages.length > ChatManager.MAX_HISTORY_TURNS * 2) {
        this.messages = this.messages.slice(-ChatManager.MAX_HISTORY_TURNS * 2);
      }

      return response;
    } catch (err: any) {
      this.logger.error('Chat failed in ChatManager', err);
      throw err;
    }
  }
}
