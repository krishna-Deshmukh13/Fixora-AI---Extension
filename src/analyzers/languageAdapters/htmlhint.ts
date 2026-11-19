import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class HTMLHintAnalyzer implements StaticAnalyzer {
  public readonly id = 'htmlhint';
  public readonly name = 'HTMLHint';
  public readonly binaryName = process.platform === 'win32' ? 'htmlhint.cmd' : 'htmlhint';
  public readonly supportedLanguages = ['html'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Run "npm install -g htmlhint" or "npm install -D htmlhint".';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        ['--format', 'json', filePath],
        { timeoutMs: 15000 }
      );

      return this.parseHTMLHintOutput(result.stdout, filePath);
    } catch (err: any) {
      this.logger.warn(`HTMLHint execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parseHTMLHintOutput(stdout: string, defaultFilePath: string): ReviewFinding[] {
    try {
      const data = JSON.parse(stdout);
      const findings: ReviewFinding[] = [];

      for (const item of data) {
        for (const msg of item.messages || []) {
          findings.push({
            id: `htmlhint-${Date.now()}-${findings.length + 1}`,
            title: `HTMLHint: ${msg.message}`,
            severity: msg.type === 'error' ? 'critical' : 'warning',
            category: 'syntax',
            filePath: item.file || defaultFilePath,
            line: msg.line || 1,
            column: msg.col || 1,
            explanation: msg.message,
            whyItMatters: 'HTML validity, accessibility, or broken markup structure.',
            suggestedSolution: `Rule: ${msg.rule?.id || 'HTML standards compliance'}`,
            confidence: 1.0,
            source: 'static',
            analyzerName: 'HTMLHint',
          });
        }
      }

      return findings;
    } catch {
      return [];
    }
  }
}
