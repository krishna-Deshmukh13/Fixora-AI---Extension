import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class SQLFluffAnalyzer implements StaticAnalyzer {
  public readonly id = 'sqlfluff';
  public readonly name = 'SQLFluff';
  public readonly binaryName = 'sqlfluff';
  public readonly supportedLanguages = ['sql'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Run "pip install sqlfluff" in your Python environment.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        ['lint', '--format', 'json', filePath],
        { timeoutMs: 20000 }
      );

      return this.parseSQLFluffOutput(result.stdout, filePath);
    } catch (err: any) {
      this.logger.warn(`SQLFluff execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parseSQLFluffOutput(stdout: string, defaultFilePath: string): ReviewFinding[] {
    try {
      const data = JSON.parse(stdout);
      const findings: ReviewFinding[] = [];

      for (const fileReport of data) {
        for (const violation of fileReport.violations || []) {
          findings.push({
            id: `sqlfluff-${Date.now()}-${findings.length + 1}`,
            title: `SQLFluff [${violation.code}]: ${violation.description}`,
            severity: 'warning',
            category: 'bug',
            filePath: fileReport.filepath || defaultFilePath,
            line: violation.line_no || 1,
            column: violation.line_pos || 1,
            explanation: violation.description,
            whyItMatters: 'SQL dialect standards, syntax compliance, or performance flaw.',
            suggestedSolution: `Resolve rule ${violation.code}`,
            confidence: 1.0,
            source: 'static',
            analyzerName: 'SQLFluff',
          });
        }
      }

      return findings;
    } catch {
      return [];
    }
  }
}
