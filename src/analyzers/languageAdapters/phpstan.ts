import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class PHPStanAnalyzer implements StaticAnalyzer {
  public readonly id = 'phpstan';
  public readonly name = 'PHPStan';
  public readonly binaryName = process.platform === 'win32' ? 'phpstan.bat' : 'phpstan';
  public readonly supportedLanguages = ['php'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Run "composer require --dev phpstan/phpstan" in your project.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        ['analyze', '--error-format=json', '--no-progress', filePath],
        { timeoutMs: 20000 }
      );

      return this.parsePHPStanOutput(result.stdout, filePath);
    } catch (err: any) {
      this.logger.warn(`PHPStan execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parsePHPStanOutput(stdout: string, defaultFilePath: string): ReviewFinding[] {
    try {
      const data = JSON.parse(stdout);
      const findings: ReviewFinding[] = [];
      const files = data.files || {};

      for (const [file, info] of Object.entries<any>(files)) {
        for (const msg of info.messages || []) {
          findings.push({
            id: `phpstan-${Date.now()}-${findings.length + 1}`,
            title: `PHPStan: ${msg.message.slice(0, 60)}`,
            severity: 'warning',
            category: 'bug',
            filePath: file || defaultFilePath,
            line: msg.line || 1,
            explanation: msg.message,
            whyItMatters: 'PHP type safety or runtime exception potential.',
            suggestedSolution: 'Verify PHP types and nullability.',
            confidence: 1.0,
            source: 'static',
            analyzerName: 'PHPStan',
          });
        }
      }

      return findings;
    } catch {
      return [];
    }
  }
}
