import { GoogleGenAI } from '@google/genai';
import {
  AIAnalysisOptions,
  ErrorExplanationOptions,
  ErrorExplanationResult,
  ReviewFinding,
  ReviewResult,
} from '../../types';
import { AIProvider } from './provider';
import { PromptManager } from '../promptManager';
import { ResponseParser } from '../responseParser';
import { Logger } from '../../utils/logger';

export class GeminiProvider implements AIProvider {
  public readonly id = 'gemini';
  public readonly displayName = 'Google Gemini';

  private client: GoogleGenAI;
  private logger = Logger.getInstance();

  constructor(
    private apiKey: string,
    public modelName: string = 'gemini-1.5-flash'
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  public async isConfigured(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public updateCredentials(apiKey: string, modelName?: string): void {
    this.apiKey = apiKey;
    if (modelName) {
      this.modelName = modelName;
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Helper that executes generateContent with automatic model fallback if a model is deprecated or 404s.
   */
  private async generateContentWithFallback(
    params: { contents: string; systemInstruction?: string; temperature?: number },
    abortSignal?: AbortSignal
  ): Promise<any> {
    const candidateModels = [
      this.modelName,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];
    const uniqueModels = [...new Set(candidateModels)];
    let lastError: any;

    for (const model of uniqueModels) {
      try {
        const response = await this.executeWithTimeout(
          () =>
            this.client.models.generateContent({
              model,
              contents: params.contents,
              config: {
                systemInstruction: params.systemInstruction,
                responseMimeType: 'application/json',
                temperature: params.temperature ?? 0.2,
              },
            }),
          abortSignal
        );
        if (this.modelName !== model) {
          this.logger.info(`Switched active Gemini model from ${this.modelName} to ${model}`);
          this.modelName = model;
        }
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        if (
          msg.includes('404') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('no longer available') ||
          msg.includes('is not found')
        ) {
          this.logger.warn(`Model ${model} unavailable: ${msg}. Attempting next model candidate...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Run comprehensive code review.
   */
  public async reviewCode(options: AIAnalysisOptions): Promise<ReviewResult> {
    const startTime = Date.now();
    const prompt = PromptManager.buildReviewPrompt(options);
    const systemInstruction = PromptManager.getSystemInstruction(options.learningMode);

    this.logger.info(`Sending review request to Gemini (${this.modelName}), file: ${options.filePath}`);

    try {
      const response = await this.generateContentWithFallback(
        {
          contents: prompt,
          systemInstruction,
          temperature: 0.2,
        },
        options.abortSignal
      );

      const rawText = response.text || '';
      const durationMs = Date.now() - startTime;

      return ResponseParser.parseReviewResponse(
        rawText,
        options.filePath,
        this.displayName,
        this.modelName,
        durationMs
      );
    } catch (err: any) {
      this.handleApiError(err);
      throw err;
    }
  }

  /**
   * Explain an error message or stack trace.
   */
  public async explainError(options: ErrorExplanationOptions): Promise<ErrorExplanationResult> {
    const prompt = PromptManager.buildErrorExplanationPrompt(options);
    const systemInstruction = PromptManager.getSystemInstruction(options.learningMode);

    this.logger.info(`Sending error explanation request to Gemini (${this.modelName})`);

    try {
      const response = await this.generateContentWithFallback(
        {
          contents: prompt,
          systemInstruction,
          temperature: 0.3,
        },
        options.abortSignal
      );

      const rawText = response.text || '';
      return ResponseParser.parseErrorExplanation(rawText);
    } catch (err: any) {
      this.handleApiError(err);
      throw err;
    }
  }

  /**
   * Generate an automated fix for a specific finding.
   */
  public async generateFix(
    finding: ReviewFinding,
    surroundingCode: string,
    abortSignal?: AbortSignal
  ): Promise<{ replacementCode: string; explanation: string }> {
    const prompt = PromptManager.buildFixPrompt(finding, surroundingCode);

    this.logger.info(`Sending fix generation request to Gemini for ${finding.id}`);

    try {
      const response = await this.generateContentWithFallback(
        {
          contents: prompt,
          systemInstruction: PromptManager.getSystemInstruction(false),
          temperature: 0.1,
        },
        abortSignal
      );

      const rawText = response.text || '';
      return ResponseParser.parseFixResponse(rawText);
    } catch (err: any) {
      this.handleApiError(err);
      throw err;
    }
  }

  /**
   * Run focused security audit.
   */
  public async reviewSecurity(options: AIAnalysisOptions): Promise<ReviewResult> {
    const startTime = Date.now();
    const prompt = PromptManager.buildSecurityPrompt(options);

    this.logger.info(`Sending security audit request to Gemini (${this.modelName})`);

    try {
      const response = await this.generateContentWithFallback(
        {
          contents: prompt,
          systemInstruction: PromptManager.getSystemInstruction(options.learningMode),
          temperature: 0.1,
        },
        options.abortSignal
      );

      const rawText = response.text || '';
      const durationMs = Date.now() - startTime;

      return ResponseParser.parseReviewResponse(
        rawText,
        options.filePath,
        this.displayName,
        this.modelName,
        durationMs
      );
    } catch (err: any) {
      this.handleApiError(err);
      throw err;
    }
  }

  /**
   * Run focused performance review.
   */
  public async reviewPerformance(options: AIAnalysisOptions): Promise<ReviewResult> {
    const startTime = Date.now();
    const prompt = PromptManager.buildPerformancePrompt(options);

    this.logger.info(`Sending performance analysis request to Gemini (${this.modelName})`);

    try {
      const response = await this.generateContentWithFallback(
        {
          contents: prompt,
          systemInstruction: PromptManager.getSystemInstruction(options.learningMode),
          temperature: 0.2,
        },
        options.abortSignal
      );

      const rawText = response.text || '';
      const durationMs = Date.now() - startTime;

      return ResponseParser.parseReviewResponse(
        rawText,
        options.filePath,
        this.displayName,
        this.modelName,
        durationMs
      );
    } catch (err: any) {
      this.handleApiError(err);
      throw err;
    }
  }

  /**
   * Wraps SDK request with cancellation support.
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    abortSignal?: AbortSignal
  ): Promise<T> {
    if (abortSignal?.aborted) {
      throw new Error('Request was cancelled by the user.');
    }

    let abortHandler: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      if (abortSignal) {
        abortHandler = () => {
          const reasonMsg = abortSignal.reason && ((abortSignal.reason as any).message || String(abortSignal.reason));
          if (reasonMsg && !reasonMsg.includes('This operation was aborted')) {
            reject(new Error(reasonMsg));
          } else {
            reject(new Error('Request was cancelled by the user.'));
          }
        };
        abortSignal.addEventListener('abort', abortHandler);
      }
    });

    try {
      return await Promise.race([operation(), abortPromise]);
    } finally {
      if (abortSignal && abortHandler) {
        abortSignal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Translates common Gemini/HTTP errors into human-readable developer explanations.
   */
  private handleApiError(err: any): void {
    const message = String(err?.message || err);
    this.logger.error('Gemini API Error:', message);

    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      throw new Error(
        'Fixora AI: Google Gemini rate limit or quota exceeded. Please wait a minute before sending another request.'
      );
    }

    if (message.includes('API_KEY_INVALID') || message.includes('403') || message.includes('401')) {
      throw new Error(
        'Fixora AI: Invalid Google Gemini API Key. Use "Fixora AI: Configure Gemini API Key" to update your key.'
      );
    }

    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
      throw new Error(
        'Fixora AI: Network connection error. Please verify your internet connection.'
      );
    }
  }
}
