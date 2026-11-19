import {
  AIAnalysisOptions,
  ErrorExplanationOptions,
  ErrorExplanationResult,
  ReviewFinding,
  ReviewResult,
} from '../../types';

/**
 * Common configuration options for AI Providers.
 */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  timeoutSeconds: number;
  temperature?: number;
}

/**
 * Standard interface that all Fixora AI model providers must implement.
 * Allows seamless extension to OpenAI, Anthropic, or local LLMs in the future.
 */
export interface AIProvider {
  readonly id: string;
  readonly displayName: string;

  /**
   * Check whether the provider has valid configuration / API keys.
   */
  isConfigured(): Promise<boolean>;

  /**
   * Update active credentials or model name.
   */
  updateCredentials(apiKey: string, modelName?: string): void;

  /**
   * Run multi-faceted code review (bugs, logic, security, style).
   */
  reviewCode(options: AIAnalysisOptions): Promise<ReviewResult>;

  /**
   * Explain an error message, compiler output, or stack trace.
   */
  explainError(options: ErrorExplanationOptions): Promise<ErrorExplanationResult>;

  /**
   * Generate an automated code fix for a specific finding.
   */
  generateFix(
    finding: ReviewFinding,
    surroundingCode: string,
    abortSignal?: AbortSignal
  ): Promise<{ replacementCode: string; explanation: string }>;

  /**
   * Perform a focused security audit.
   */
  reviewSecurity(options: AIAnalysisOptions): Promise<ReviewResult>;

  /**
   * Perform an algorithmic and performance analysis.
   */
  reviewPerformance(options: AIAnalysisOptions): Promise<ReviewResult>;
}
