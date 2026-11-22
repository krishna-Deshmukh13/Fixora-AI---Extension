import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

/**
 * Adapter for Checkstyle / javac (Java static analysis).
 */
export class CheckstyleAnalyzer implements StaticAnalyzer {
  public readonly id = 'checkstyle';
  public readonly name = 'Checkstyle / Java Analyzer';
  public readonly binaryName = 'javac';
  public readonly supportedLanguages = ['java'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await ProcessManager.execute('javac', ['-version']);
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }

  public getInstallationInstructions(): string {
    return 'Install OpenJDK or Oracle JDK (javac) and add to system PATH.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    this.logger.info(`Running Java static compilation check on ${filePath}`);
    try {
      // Use javac syntax-only check (-Xlint) without generating class files
      const result = await ProcessManager.execute('javac', [
        '-Xlint:all',
        '-proc:none',
        '-d',
        process.env.TEMP || '/tmp',
        filePath,
      ]);

      const output = `${result.stdout}\n${result.stderr}`;
      return this.parseCompilerOutput(output, filePath);
    } catch (err: any) {
      this.logger.warn(`Java analyzer execution failed: ${err?.message || err}`);
      return [];
    }
  }

  private parseCompilerOutput(output: string, targetFile: string): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = output.split('\n');

    // Example pattern: File.java:42: error: cannot find symbol
    const regex = /([^:\n]+):(\d+):\s*(error|warning):\s*(.+)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(regex);
      if (match) {
        const lineNum = parseInt(match[2], 10);
        const severityType = match[3].toLowerCase();
        const message = match[4].trim();

        // Check if error column pointer follows (e.g. "symbol:   variable x" then "    ^")
        let col = 1;
        if (i + 2 < lines.length && lines[i + 2].includes('^')) {
          col = lines[i + 2].indexOf('^') + 1;
        }

        findings.push({
          id: `java-${findings.length + 1}-${lineNum}`,
          title: `Java ${severityType === 'error' ? 'Compiler Error' : 'Compiler Warning'}: ${message.slice(0, 60)}`,
          severity: severityType === 'error' ? 'critical' : 'warning',
          category: severityType === 'error' ? 'bug' : 'quality',
          filePath: targetFile,
          line: lineNum,
          column: col,
          explanation: message,
          whyItMatters:
            severityType === 'error'
              ? 'Java compilation errors prevent bytecode compilation and execution.'
              : 'Compiler warnings often indicate unhandled type safety issues or deprecated API usage.',
          suggestedSolution: 'Review Java type signatures, imports, and variable scopes.',
          confidence: 1.0,
          source: 'static',
          analyzerName: this.name,
        });
      }
    }

    return findings;
  }
}
