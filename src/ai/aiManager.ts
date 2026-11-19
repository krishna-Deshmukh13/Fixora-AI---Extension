import * as vscode from 'vscode';
import {
  AIAnalysisOptions,
  ErrorExplanationOptions,
  ErrorExplanationResult,
  ReviewFinding,
  ReviewResult,
} from '../types';
import { GeminiProvider } from './providers/geminiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import { AIProvider } from './providers/provider';
import { Logger } from '../utils/logger';

/**
 * Central orchestrator for AI operations in Fixora AI.
 * Handles SecretStorage credentials, timeout budgeting, and provider lifecycle (Gemini or local Ollama).
 */
export class AIManager {
  private static instance: AIManager;
  private currentProvider: AIProvider | null = null;
  private logger = Logger.getInstance();

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public static initialize(context: vscode.ExtensionContext): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager(context);
    }
    return AIManager.instance;
  }

  public static getInstance(): AIManager {
    if (!AIManager.instance) {
      throw new Error('AIManager must be initialized with ExtensionContext first.');
    }
    return AIManager.instance;
  }

  /**
   * Retrieves or creates the active AIProvider (Gemini or local Ollama).
   */
  public async getProvider(): Promise<AIProvider> {
    const config = vscode.workspace.getConfiguration('fixora');
    const providerType = config.get<string>('provider', 'gemini');

    if (providerType === 'ollama') {
      const endpoint = config.get<string>('ollama.endpoint', 'http://localhost:11434');
      const model = config.get<string>('ollama.model', 'codellama');
      if (!this.currentProvider || this.currentProvider.id !== 'ollama') {
        this.currentProvider = new OllamaProvider(endpoint, model);
      } else {
        this.currentProvider.updateCredentials('', model);
      }
      return this.currentProvider;
    }

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Fixora AI requires a Gemini API Key. Run "Fixora AI: Configure Gemini API Key" from the Command Palette or switch to local Ollama in settings.'
      );
    }

    const model = config.get<string>('model', 'gemini-1.5-flash');

    if (!this.currentProvider || this.currentProvider.id !== 'gemini') {
      this.currentProvider = new GeminiProvider(apiKey, model);
    } else {
      this.currentProvider.updateCredentials(apiKey, model);
    }

    return this.currentProvider;
  }

  public async getApiKey(): Promise<string | undefined> {
    const key = await this.context.secrets.get('fixora.geminiApiKey');
    return key ? key.trim() : undefined;
  }

  public async isConfigured(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('fixora');
    const providerType = config.get<string>('provider', 'gemini');
    if (providerType === 'ollama') {
      return true;
    }
    const key = await this.getApiKey();
    return Boolean(key && key.length > 0);
  }

  /**
   * Validates file size against configured limit.
   */
  public validateFileSize(code: string, filePath: string): void {
    const config = vscode.workspace.getConfiguration('fixora');
    const maxKb = config.get<number>('maxFileSizeKB', 500);
    const sizeKb = Buffer.byteLength(code, 'utf8') / 1024;

    if (sizeKb > maxKb) {
      throw new Error(
        `Fixora AI: File "${filePath}" (${sizeKb.toFixed(1)} KB) exceeds the maximum allowed review size of ${maxKb} KB. You can adjust this in Fixora AI settings.`
      );
    }
  }

  /**
   * Creates an AbortSignal with timeout support.
   */
  private createTimeoutSignal(userCancellationToken?: vscode.CancellationToken): {
    signal: AbortSignal;
    cleanup: () => void;
  } {
    const config = vscode.workspace.getConfiguration('fixora');
    const timeoutSec = config.get<number>('requestTimeoutSeconds', 90);
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort(new Error(`Fixora AI: Request timed out after ${timeoutSec} seconds. Check network connection or choose a faster model.`));
    }, timeoutSec * 1000);

    let userCancelRegistration: vscode.Disposable | undefined;
    if (userCancellationToken) {
      userCancelRegistration = userCancellationToken.onCancellationRequested(() => {
        controller.abort(new Error('Fixora AI: Request cancelled by user.'));
      });
    }

    const cleanup = () => {
      clearTimeout(timer);
      userCancelRegistration?.dispose();
    };

    return { signal: controller.signal, cleanup };
  }

  /**
   * Run full code review through active AI provider.
   */
  public async reviewCode(
    options: AIAnalysisOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ReviewResult> {
    this.validateFileSize(options.code, options.filePath);
    const provider = await this.getProvider();
    const { signal, cleanup } = this.createTimeoutSignal(cancellationToken);

    try {
      return await provider.reviewCode({
        ...options,
        abortSignal: signal,
      });
    } finally {
      cleanup();
    }
  }

  /**
   * Run error explanation through active AI provider.
   */
  public async explainError(
    options: ErrorExplanationOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ErrorExplanationResult> {
    if (options.codeSnippet) {
      this.validateFileSize(options.codeSnippet, options.filePath || 'snippet');
    }
    const provider = await this.getProvider();
    const { signal, cleanup } = this.createTimeoutSignal(cancellationToken);

    try {
      return await provider.explainError({
        ...options,
        abortSignal: signal,
      });
    } finally {
      cleanup();
    }
  }

  /**
   * Generate safe code fix for a finding.
   */
  public async generateFix(
    finding: ReviewFinding,
    surroundingCode: string,
    cancellationToken?: vscode.CancellationToken
  ): Promise<{ replacementCode: string; explanation: string }> {
    const provider = await this.getProvider();
    const { signal, cleanup } = this.createTimeoutSignal(cancellationToken);

    try {
      return await provider.generateFix(finding, surroundingCode, signal);
    } finally {
      cleanup();
    }
  }

  /**
   * Run dedicated security scan.
   */
  public async reviewSecurity(
    options: AIAnalysisOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ReviewResult> {
    this.validateFileSize(options.code, options.filePath);
    const provider = await this.getProvider();
    const { signal, cleanup } = this.createTimeoutSignal(cancellationToken);

    try {
      return await provider.reviewSecurity({
        ...options,
        abortSignal: signal,
      });
    } finally {
      cleanup();
    }
  }

  /**
   * Run dedicated performance review.
   */
  public async reviewPerformance(
    options: AIAnalysisOptions,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ReviewResult> {
    this.validateFileSize(options.code, options.filePath);
    const provider = await this.getProvider();
    const { signal, cleanup } = this.createTimeoutSignal(cancellationToken);

    try {
      return await provider.reviewPerformance({
        ...options,
        abortSignal: signal,
      });
    } finally {
      cleanup();
    }
  }
}
