import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class StylelintAnalyzer implements StaticAnalyzer {
  public readonly id = 'stylelint';
  public readonly name = 'Stylelint';
  public readonly binaryName = process.platform === 'win32' ? 'stylelint.cmd' : 'stylelint';
  public readonly supportedLanguages = ['css', 'scss', 'less'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Run "npm install -D stylelint stylelint-config-standard" in your project.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        ['--formatter', 'json', filePath],
        { timeoutMs: 15000 }
      );

      return this.parseStylelintOutput(result.stdout, filePath);
    } catch (err: any) {
      this.logger.warn(`Stylelint execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parseStylelintOutput(stdout: string, defaultFilePath: string): ReviewFinding[] {
    try {
      const data = JSON.parse(stdout);
      const findings: ReviewFinding[] = [];

      for (const item of data) {
        for (const warning of item.warnings || []) {
          findings.push({
            id: `stylelint-${Date.now()}-${findings.length + 1}`,
            title: `Stylelint [${warning.rule}]: ${warning.text}`,
            severity: warning.severity === 'error' ? 'critical' : 'warning',
            category: 'style',
            filePath: item.source || defaultFilePath,
            line: warning.line || 1,
            column: warning.column || 1,
            endLine: warning.endLine,
            endColumn: warning.endColumn,
            explanation: warning.text,
            whyItMatters: 'CSS syntax error or styling rule violation.',
            suggestedSolution: `Fix rule: ${warning.rule}`,
            confidence: 1.0,
            source: 'static',
            analyzerName: 'Stylelint',
          });
        }
      }

      return findings;
    } catch {
      return [];
    }
  }
}
