import { ReviewFinding, ReviewResult } from './review';

/**
 * Options passed to the AI provider for analysis.
 */
export interface AIAnalysisOptions {
  code: string;
  filePath: string;
  languageId: string;
  context?: string;
  learningMode?: boolean;
  staticFindings?: ReviewFinding[];
  abortSignal?: AbortSignal;
}

/**
 * Options for error explanation.
 */
export interface ErrorExplanationOptions {
  errorMessage: string;
  codeSnippet?: string;
  filePath?: string;
  line?: number;
  stackTrace?: string;
  languageId?: string;
  learningMode?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Structured explanation result.
 */
export interface ErrorExplanationResult {
  whatHappened: string;
  whyItHappened: string;
  rootCause: string;
  howToFix: string;
  correctedCodeSnippet?: string;
  explanationOfCorrection: string;
  conceptName?: string;
  learningTakeaway?: string;
  inferredCauses?: string[];
  confirmedCauses?: string[];
  relatedReferences?: string[];
  suggestedActions?: string[];
}

/**
 * Abstract AI Provider Interface that all AI backends implement.
 */
export interface AIProvider {
  readonly id: string;
  readonly displayName: string;

  /**
   * Validate if provider is configured (e.g. has API key).
   */
  isConfigured(): Promise<boolean>;

  /**
   * Run full code review.
   */
  reviewCode(options: AIAnalysisOptions): Promise<ReviewResult>;

  /**
   * Explain an error message or stack trace.
   */
  explainError(options: ErrorExplanationOptions): Promise<ErrorExplanationResult>;

  /**
   * Generate an automated fix for a specific finding.
   */
  generateFix(
    finding: ReviewFinding,
    surroundingCode: string,
    abortSignal?: AbortSignal
  ): Promise<{ replacementCode: string; explanation: string }>;

  /**
   * Dedicated security review.
   */
  reviewSecurity(options: AIAnalysisOptions): Promise<ReviewResult>;

  /**
   * Dedicated performance review.
   */
  reviewPerformance(options: AIAnalysisOptions): Promise<ReviewResult>;
}
