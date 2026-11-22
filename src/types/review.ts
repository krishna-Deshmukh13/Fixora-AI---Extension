/**
 * Severity levels for detected issues.
 */
export type ReviewSeverity = 'critical' | 'warning' | 'info' | 'hint';

/**
 * Categories of review issues.
 */
export type ReviewCategory =
  | 'bug'
  | 'security'
  | 'performance'
  | 'quality'
  | 'style'
  | 'maintainability'
  | 'syntax';

/**
 * Individual issue found by static analysis or AI review.
 */
export interface ReviewFinding {
  id: string;
  title: string;
  severity: ReviewSeverity;
  category: ReviewCategory;
  filePath: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  explanation: string;
  whyItMatters: string;
  suggestedSolution: string;
  originalCodeSnippet?: string;
  suggestedFix?: string;
  confidence: number; // 0.0 to 1.0
  source: 'static' | 'ai' | 'combined';
  evidence?: string;
  analyzerName?: string;
  conceptName?: string;
  learningNote?: string;
}

/**
 * Aggregate results of a code review run.
 */
export interface ReviewResult {
  summary: string;
  findings: ReviewFinding[];
  durationMs: number;
  filesAnalyzed: string[];
  providerName: string;
  modelName: string;
  timestamp: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Scope of code to be reviewed.
 */
export type ReviewScope = 'selection' | 'file' | 'workspace' | 'git-diff' | 'git-staged';
