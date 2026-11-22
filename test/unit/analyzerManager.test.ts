import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzerManager } from '../../src/analyzers/analyzerManager';
import { ESLintAnalyzer } from '../../src/analyzers/languageAdapters/eslint';
import { RuffAnalyzer } from '../../src/analyzers/languageAdapters/ruff';
import { ClangTidyAnalyzer } from '../../src/analyzers/languageAdapters/clangTidy';
import { ProcessManager } from '../../src/utils/processManager';

describe('AnalyzerManager & Language Adapters', () => {
  let manager: AnalyzerManager;

  beforeEach(() => {
    (AnalyzerManager as any).instance = undefined;
    manager = AnalyzerManager.getInstance();
  });

  describe('Analyzer Resolution', () => {
    it('should map JavaScript, TypeScript, and React to ESLint', () => {
      expect(manager.getAnalyzerForLanguage('javascript')?.id).toBe('eslint');
      expect(manager.getAnalyzerForLanguage('typescript')?.id).toBe('eslint');
      expect(manager.getAnalyzerForLanguage('javascriptreact')?.id).toBe('eslint');
      expect(manager.getAnalyzerForLanguage('typescriptreact')?.id).toBe('eslint');
    });

    it('should map Python to Ruff', () => {
      expect(manager.getAnalyzerForLanguage('python')?.id).toBe('ruff');
    });

    it('should map C and C++ to Clang-Tidy', () => {
      expect(manager.getAnalyzerForLanguage('c')?.id).toBe('clang-tidy');
      expect(manager.getAnalyzerForLanguage('cpp')?.id).toBe('clang-tidy');
    });

    it('should map PHP, HTML, CSS, SQL, and Java to their respective analyzers', () => {
      expect(manager.getAnalyzerForLanguage('php')?.id).toBe('phpstan');
      expect(manager.getAnalyzerForLanguage('html')?.id).toBe('htmlhint');
      expect(manager.getAnalyzerForLanguage('css')?.id).toBe('stylelint');
      expect(manager.getAnalyzerForLanguage('sql')?.id).toBe('sqlfluff');
      expect(manager.getAnalyzerForLanguage('java')?.id).toBe('checkstyle');
    });
  });

  describe('Missing Analyzer Graceful Handling', () => {
    it('should return empty findings and not crash if analyzer binary is unavailable', async () => {
      vi.spyOn(ProcessManager, 'isCommandAvailable').mockResolvedValue(false);

      const findings = await manager.runStaticAnalysis('main.py', 'print("hello")', 'python');
      expect(findings).toEqual([]);
    });

    it('should provide clear CLI install instructions for all analyzers', async () => {
      const statuses = await manager.getAnalyzerStatuses();
      expect(statuses.length).toBeGreaterThanOrEqual(7);

      const ruffStatus = statuses.find((s) => s.id === 'ruff');
      expect(ruffStatus?.installInstructions).toContain('pip install ruff');

      const eslintStatus = statuses.find((s) => s.id === 'eslint');
      expect(eslintStatus?.installInstructions).toContain('npm install -D eslint');
    });
  });

  describe('Output Parsing', () => {
    it('should parse ESLint JSON output into normalized ReviewFindings', () => {
      const analyzer = new ESLintAnalyzer();
      const mockOutput = JSON.stringify([
        {
          filePath: 'src/app.js',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 2,
              message: "'x' is defined but never used.",
              line: 10,
              column: 5,
            },
          ],
        },
      ]);

      const findings = (analyzer as any).parseESLintOutput(mockOutput, 'src/app.js');
      expect(findings.length).toBe(1);
      expect(findings[0].title).toBe('ESLint [no-unused-vars]');
      expect(findings[0].severity).toBe('critical'); // severity 2 is error -> critical
      expect(findings[0].line).toBe(10);
      expect(findings[0].source).toBe('static');
      expect(findings[0].analyzerName).toBe('ESLint');
    });

    it('should parse Ruff JSON output into normalized ReviewFindings', () => {
      const analyzer = new RuffAnalyzer();
      const mockOutput = JSON.stringify([
        {
          code: 'F401',
          message: "'os' imported but unused",
          filename: 'test.py',
          location: { row: 3, column: 1 },
          fix: { message: 'Remove unused import', applicability: 'safe', edits: [{ content: '' }] },
        },
      ]);

      const findings = (analyzer as any).parseRuffOutput(mockOutput, 'test.py');
      expect(findings.length).toBe(1);
      expect(findings[0].title).toBe("Ruff [F401]: 'os' imported but unused");
      expect(findings[0].line).toBe(3);
      expect(findings[0].source).toBe('static');
      expect(findings[0].analyzerName).toBe('Ruff');
    });

    it('should parse Clang-Tidy lines into normalized ReviewFindings', () => {
      const analyzer = new ClangTidyAnalyzer();
      const mockOutput = 'src/main.cpp:24:5: warning: variable "ptr" is uninitialized [clang-analyzer-core.uninitialized.UndefVal]';

      const findings = (analyzer as any).parseClangOutput(mockOutput, 'src/main.cpp');
      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Clang-Tidy');
      expect(findings[0].line).toBe(24);
      expect(findings[0].column).toBe(5);
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].analyzerName).toBe('Clang-Tidy');
    });
  });
});
