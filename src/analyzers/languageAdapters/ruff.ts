import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class RuffAnalyzer implements StaticAnalyzer {
  public readonly id = 'ruff';
  public readonly name = 'Ruff';
  public readonly binaryName = 'ruff';
  public readonly supportedLanguages = ['python'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Run "pip install ruff" in your Python environment.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        ['check', '--output-format', 'json', filePath],
        { timeoutMs: 15000 }
      );

      return this.parseRuffOutput(result.stdout, filePath);
    } catch (err: any) {
      this.logger.warn(`Ruff execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parseRuffOutput(stdout: string, defaultFilePath: string): ReviewFinding[] {
    try {
      const diagnostics = JSON.parse(stdout);
      const findings: ReviewFinding[] = [];

      for (const diag of diagnostics) {
        findings.push({
          id: `ruff-${Date.now()}-${findings.length + 1}`,
          title: `Ruff [${diag.code}]: ${diag.message}`,
          severity: 'warning',
          category: 'bug',
          filePath: diag.filename || defaultFilePath,
          line: diag.location ? diag.location.row : 1,
          column: diag.location ? diag.location.column : 1,
          endLine: diag.end_location ? diag.end_location.row : undefined,
          endColumn: diag.end_location ? diag.end_location.column : undefined,
          explanation: diag.message,
          whyItMatters: 'Python style and potential runtime defect.',
          suggestedSolution: diag.fix ? diag.fix.message : `Resolve Ruff rule ${diag.code}`,
          suggestedFix: diag.fix?.applicability === 'safe' ? diag.fix.edits?.[0]?.content : undefined,
          confidence: 1.0,
          source: 'static',
          analyzerName: 'Ruff',
        });
      }

      return findings;
    } catch {
      return [];
    }
  }
}
