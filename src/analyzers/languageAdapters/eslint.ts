import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class ESLintAnalyzer implements StaticAnalyzer {
  public readonly id = 'eslint';
  public readonly name = 'ESLint';
  public readonly binaryName = process.platform === 'win32' ? 'eslint.cmd' : 'eslint';
  public readonly supportedLanguages = [
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
  ];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Run "npm install -D eslint" in your project directory.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        ['--format', 'json', filePath],
        { timeoutMs: 15000 }
      );

      return this.parseESLintOutput(result.stdout, filePath);
    } catch (err: any) {
      this.logger.warn(`ESLint execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parseESLintOutput(stdout: string, defaultFilePath: string): ReviewFinding[] {
    try {
      const reports = JSON.parse(stdout);
      const findings: ReviewFinding[] = [];

      for (const report of reports) {
        for (const msg of report.messages || []) {
          findings.push({
            id: `eslint-${Date.now()}-${findings.length + 1}`,
            title: msg.ruleId ? `ESLint [${msg.ruleId}]` : 'ESLint Lint Warning',
            severity: msg.severity === 2 ? 'critical' : 'warning',
            category: 'bug',
            filePath: report.filePath || defaultFilePath,
            line: msg.line || 1,
            column: msg.column || 1,
            endLine: msg.endLine,
            endColumn: msg.endColumn,
            explanation: msg.message,
            whyItMatters: 'Violates established project coding standard and potential runtime bug.',
            suggestedSolution: msg.ruleId ? `Follow rule recommendations for ${msg.ruleId}` : 'Fix lint warning.',
            confidence: 1.0,
            source: 'static',
            analyzerName: 'ESLint',
          });
        }
      }

      return findings;
    } catch {
      return [];
    }
  }
}
