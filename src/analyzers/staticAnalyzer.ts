import { ReviewFinding } from '../types';

/**
 * Standard interface for language-specific static linters and compilers.
 */
export interface StaticAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly binaryName: string;
  readonly supportedLanguages: string[];

  /**
   * Check if analyzer binary is installed on the host.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Provide simple CLI installation instructions for the user.
   */
  getInstallationInstructions(): string;

  /**
   * Run the analyzer on a target file and return normalized ReviewFindings.
   */
  runAnalysis(filePath: string, code: string): Promise<ReviewFinding[]>;
}
