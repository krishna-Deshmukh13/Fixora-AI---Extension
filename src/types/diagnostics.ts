import { ReviewFinding } from './review';

/**
 * Diagnostic record mapped directly to VS Code Problem entries.
 */
export interface FixoraDiagnostic {
  finding: ReviewFinding;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  code: string;
  source: string;
}

/**
 * Proposed fix to be applied via WorkspaceEdit.
 */
export interface ProposedFix {
  findingId: string;
  filePath: string;
  originalText: string;
  replacementText: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  explanation: string;
}
