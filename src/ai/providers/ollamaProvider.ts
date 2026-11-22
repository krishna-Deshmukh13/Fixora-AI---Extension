import { AIProvider } from './provider';
import {
  AIAnalysisOptions,
  ErrorExplanationOptions,
  ErrorExplanationResult,
  ReviewFinding,
  ReviewResult,
} from '../../types';
import { PromptManager } from '../promptManager';
import { ResponseParser } from '../responseParser';
import { Logger } from '../../utils/logger';

/**
 * Local AI Provider supporting offline LLM execution via Ollama (http://localhost:11434).
 * Requires zero internet connection and zero API keys.
 */
export class OllamaProvider implements AIProvider {
  public readonly id = 'ollama';
  public readonly displayName = 'Ollama Local LLM (Offline)';

  private logger = Logger.getInstance();

  constructor(
    public endpoint = 'http://localhost:11434',
    public modelName = 'codellama'
  ) {}

  public async isConfigured(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  public updateCredentials(_apiKey: string, modelName?: string): void {
    if (modelName) {
      this.modelName = modelName;
    }
  }

  public async reviewCode(options: AIAnalysisOptions): Promise<ReviewResult> {
    const startTime = Date.now();
    const prompt = PromptManager.buildReviewPrompt(options);
    const systemInstruction = PromptManager.getSystemInstruction(options.learningMode);

    this.logger.info(`Sending review to local Ollama (${this.modelName}) at ${this.endpoint}`);

    const fullPrompt = `${systemInstruction}\n\n${prompt}`;
    const rawResponse = await this.queryOllama(fullPrompt, options.abortSignal);
    const durationMs = Date.now() - startTime;

    return ResponseParser.parseReviewResponse(
      rawResponse,
      options.filePath,
      this.displayName,
      this.modelName,
      durationMs
    );
  }

  public async explainError(options: ErrorExplanationOptions): Promise<ErrorExplanationResult> {
    const prompt = PromptManager.buildErrorExplanationPrompt(options);
    const systemInstruction = PromptManager.getSystemInstruction(options.learningMode);

    const fullPrompt = `${systemInstruction}\n\n${prompt}`;
    const rawResponse = await this.queryOllama(fullPrompt, options.abortSignal);

    return ResponseParser.parseErrorExplanation(rawResponse);
  }

  public async generateFix(
    finding: ReviewFinding,
    surroundingCode: string,
    abortSignal?: AbortSignal
  ): Promise<{ replacementCode: string; explanation: string }> {
    const prompt = PromptManager.buildFixPrompt(finding, surroundingCode);
    const rawResponse = await this.queryOllama(prompt, abortSignal);
    return ResponseParser.parseFixResponse(rawResponse);
  }

  public async reviewSecurity(options: AIAnalysisOptions): Promise<ReviewResult> {
    const startTime = Date.now();
    const prompt = PromptManager.buildSecurityPrompt(options);
    const systemInstruction = PromptManager.getSystemInstruction(options.learningMode);

    const fullPrompt = `${systemInstruction}\n\n${prompt}`;
    const rawResponse = await this.queryOllama(fullPrompt, options.abortSignal);
    const durationMs = Date.now() - startTime;

    return ResponseParser.parseReviewResponse(
      rawResponse,
      options.filePath,
      this.displayName,
      this.modelName,
      durationMs
    );
  }

  public async reviewPerformance(options: AIAnalysisOptions): Promise<ReviewResult> {
    const startTime = Date.now();
    const prompt = PromptManager.buildPerformancePrompt(options);
    const systemInstruction = PromptManager.getSystemInstruction(options.learningMode);

    const fullPrompt = `${systemInstruction}\n\n${prompt}`;
    const rawResponse = await this.queryOllama(fullPrompt, options.abortSignal);
    const durationMs = Date.now() - startTime;

    return ResponseParser.parseReviewResponse(
      rawResponse,
      options.filePath,
      this.displayName,
      this.modelName,
      durationMs
    );
  }

  public async streamChat(
    prompt: string,
    onChunk: (chunk: string) => void,
    systemInstruction?: string,
    abortSignal?: AbortSignal
  ): Promise<string> {
    try {
      const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt: fullPrompt,
          stream: false,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const text = data.response || '';
      onChunk(text);
      return text;
    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) {
        throw new Error('Fixora AI: Local Ollama request was cancelled.');
      }
      throw err;
    }
  }

  public estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  private async queryOllama(prompt: string, abortSignal?: AbortSignal): Promise<string> {
    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Ollama returned HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.response || '';
    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) {
        throw new Error('Fixora AI: Local Ollama request was cancelled.');
      }
      if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
        throw new Error(
          `Fixora AI: Could not connect to local Ollama at ${this.endpoint}. Make sure Ollama is installed and running (ollama serve).`
        );
      }
      throw err;
    }
  }
}
