import { ReviewFinding, ReviewResult } from './review';
import { ErrorExplanationResult } from './providers';

/**
 * Messages sent from the Webview UI to the Extension Host.
 */
export type WebviewToExtensionMessage =
  | { type: 'openDashboard' }
  | { type: 'runReviewSelection' }
  | { type: 'runReviewFile' }
  | { type: 'runReviewWorkspace' }
  | { type: 'runReviewGit' }
  | { type: 'runComplexityAudit' }
  | { type: 'exportReport' }
  | { type: 'installGitHook' }
  | { type: 'formatDocument' }
  | { type: 'toggleErrorLens' }
  | { type: 'toggleComplexityLens' }
  | { type: 'toggleFormatter' }
  | { type: 'toggleLinter' }
  | { type: 'toggleFeature'; feature: 'errorLens' | 'complexityLens' | 'formatter' | 'linter'; enabled?: boolean }
  | { type: 'runSecurityScan' }
  | { type: 'runPerformanceReview' }
  | { type: 'explainTerminalError' }
  | { type: 'clearDiagnostics' }
  | { type: 'configureApiKey' }
  | { type: 'selectModel'; model: string }
  | { type: 'toggleLearningMode'; enabled: boolean }
  | { type: 'explainFinding'; findingId: string }
  | { type: 'previewFix'; findingId: string }
  | { type: 'applyFix'; findingId: string }
  | { type: 'jumpToCode'; filePath: string; line: number; column?: number }
  | { type: 'requestInitialState' };

/**
 * Messages sent from the Extension Host to the Webview UI.
 */
export type ExtensionToWebviewMessage =
  | {
      type: 'stateUpdate';
      data: {
        isConfigured: boolean;
        activeModel: string;
        learningMode: boolean;
        errorLensEnabled?: boolean;
        complexityLensEnabled?: boolean;
        formatterEnabled?: boolean;
        linterEnabled?: boolean;
        stats: {
          totalReviews: number;
          totalIssuesDetected: number;
          criticalCount: number;
          warningCount: number;
          fixesAccepted: number;
        };
        recentFiles: string[];
        currentReview?: ReviewResult | null;
        activeExplanation?: {
          error: string;
          explanation: ErrorExplanationResult;
          filePath?: string;
          line?: number;
        } | null;
        isLoading: boolean;
        loadingMessage?: string;
      };
    }
  | {
      type: 'reviewCompleted';
      data: ReviewResult;
    }
  | {
      type: 'reviewError';
      error: string;
    }
  | {
      type: 'errorExplained';
      data: {
        error: string;
        explanation: ErrorExplanationResult;
        filePath?: string;
        line?: number;
      };
    }
  | {
      type: 'fixProposed';
      data: {
        finding: ReviewFinding;
        originalCode: string;
        suggestedFix: string;
      };
    };
