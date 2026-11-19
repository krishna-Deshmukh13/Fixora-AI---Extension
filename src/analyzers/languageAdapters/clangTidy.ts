import { StaticAnalyzer } from '../staticAnalyzer';
import { ReviewFinding } from '../../types';
import { ProcessManager } from '../../utils/processManager';
import { Logger } from '../../utils/logger';

export class ClangTidyAnalyzer implements StaticAnalyzer {
  public readonly id = 'clang-tidy';
  public readonly name = 'Clang-Tidy';
  public readonly binaryName = 'clang-tidy';
  public readonly supportedLanguages = ['c', 'cpp'];

  private logger = Logger.getInstance();

  public async isAvailable(): Promise<boolean> {
    return ProcessManager.isCommandAvailable(this.binaryName);
  }

  public getInstallationInstructions(): string {
    return 'Install LLVM from https://releases.llvm.org/ or run "winget install LLVM.LLVM" on Windows.';
  }

  public async runAnalysis(filePath: string, _code: string): Promise<ReviewFinding[]> {
    try {
      const result = await ProcessManager.execute(
        this.binaryName,
        [filePath, '--'],
        { timeoutMs: 20000 }
      );

      return this.parseClangOutput(result.stdout || result.stderr, filePath);
    } catch (err: any) {
      this.logger.warn(`Clang-Tidy execution failed for ${filePath}: ${err?.message || err}`);
      return [];
    }
  }

  private parseClangOutput(rawOutput: string, defaultFilePath: string): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = rawOutput.split(/\r?\n/);

    // Matches: path/file.cpp:12:5: warning: message [check-name]
    const regex = /([^:\n]+):(\d+):(\d+):\s*(error|warning|note):\s*(.+?)(?:\s*\[([^\]]+)\])?$/;

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const severityType = match[4].toLowerCase();
        if (severityType === 'note') continue; // Skip informational notes

        findings.push({
          id: `clang-${Date.now()}-${findings.length + 1}`,
          title: match[6] ? `Clang-Tidy [${match[6]}]` : 'Clang Compiler Warning',
          severity: severityType === 'error' ? 'critical' : 'warning',
          category: 'bug',
          filePath: match[1] || defaultFilePath,
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          explanation: match[5],
          whyItMatters: 'Memory safety, undefined behavior, or C/C++ compilation flaw.',
          suggestedSolution: 'Correct the syntax or pointer usage according to modern C++ guidelines.',
          confidence: 1.0,
          source: 'static',
          analyzerName: 'Clang-Tidy',
        });
      }
    }

    return findings;
  }
}
