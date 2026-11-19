import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebuggerEngine } from '../../src/core/debuggerEngine';
import * as vscode from 'vscode';

describe('DebuggerEngine', () => {
  let mockAiManager: any;
  let mockSidebarProvider: any;
  let engine: DebuggerEngine;

  beforeEach(() => {
    mockAiManager = {
      isConfigured: vi.fn().mockResolvedValue(true),
      explainError: vi.fn().mockResolvedValue({
        whatHappened: 'TypeError: Cannot read properties of undefined',
        whyItHappened: 'Object reference was null',
        rootCause: 'Variable was accessed prior to initialization',
        howToFix: 'Add optional chaining user?.id',
        correctedCodeSnippet: 'console.log(user?.id);',
        explanationOfCorrection: 'Guards against undefined at runtime',
        conceptName: 'Null Safety',
      }),
    };

    mockSidebarProvider = {
      broadcastState: vi.fn(),
      displayErrorExplanation: vi.fn(),
      displayError: vi.fn(),
    };

    (DebuggerEngine as any).instance = undefined;
    engine = DebuggerEngine.initialize(mockAiManager, mockSidebarProvider);
  });

  describe('parseStackTrace', () => {
    it('should parse Node.js / V8 stack traces with parentheses', () => {
      const trace = 'TypeError: Cannot read properties of null\n    at Object.<anonymous> (C:/projects/app/index.js:42:15)\n    at Module._compile';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBe('C:/projects/app/index.js');
      expect(loc.line).toBe(42);
      expect(loc.column).toBe(15);
    });

    it('should parse Node.js stack traces without parentheses', () => {
      const trace = '    at C:/projects/server/main.js:105:9';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBe('C:/projects/server/main.js');
      expect(loc.line).toBe(105);
      expect(loc.column).toBe(9);
    });

    it('should parse Python tracebacks', () => {
      const trace = 'Traceback (most recent call last):\n  File "C:/projects/ai/model.py", line 77, in forward\n    y = x + bias';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBe('C:/projects/ai/model.py');
      expect(loc.line).toBe(77);
    });

    it('should parse GCC/Clang compiler errors', () => {
      const trace = 'src/graphics/renderer.cpp:34:10: error: use of undeclared identifier "glDrawArrays"';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBe('src/graphics/renderer.cpp');
      expect(loc.line).toBe(34);
      expect(loc.column).toBe(10);
    });

    it('should parse Java stack traces', () => {
      const trace = 'java.lang.NullPointerException\n    at com.example.auth.AuthFilter.doFilter(AuthFilter.java:58)';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBe('AuthFilter.java');
      expect(loc.line).toBe(58);
    });

    it('should parse PHP error messages', () => {
      const trace = 'Fatal error: Uncaught TypeError: in /var/www/html/index.php on line 29';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBe('/var/www/html/index.php');
      expect(loc.line).toBe(29);
    });

    it('should return empty object on text with no stack trace coordinates', () => {
      const trace = 'A generic error message without any file coordinates.';
      const loc = engine.parseStackTrace(trace);

      expect(loc.filePath).toBeUndefined();
      expect(loc.line).toBeUndefined();
    });
  });

  describe('explainDiagnostic', () => {
    it('should explain VS Code diagnostic problem with surrounding code context', async () => {
      const mockDoc: any = {
        fileName: 'C:/project/src/index.ts',
        languageId: 'typescript',
        lineCount: 10,
        lineAt: () => ({ text: 'const x = null;' }),
        getText: () => 'const x = null;\nconsole.log(x.name);',
      };

      const mockDiag: any = {
        message: "Object is possibly 'null'.",
        code: 2531,
        source: 'ts',
        range: new vscode.Range(new vscode.Position(1, 12), new vscode.Position(1, 13)),
      };

      const result = await engine.explainDiagnostic(mockDoc, mockDiag);
      expect(result).toBeDefined();
      expect(mockAiManager.explainError).toHaveBeenCalled();
      expect(mockSidebarProvider.displayErrorExplanation).toHaveBeenCalled();
      expect(result?.whatHappened).toContain('TypeError');
    });
  });

  describe('explainTerminalError', () => {
    it('should explain raw terminal error string and notify sidebar', async () => {
      const rawError = 'TypeError: Cannot read properties of undefined at Object.<anonymous> (app.js:10:5)';
      const result = await engine.explainTerminalError(rawError);

      expect(result).toBeDefined();
      expect(mockAiManager.explainError).toHaveBeenCalled();
      expect(mockSidebarProvider.displayErrorExplanation).toHaveBeenCalledWith(
        rawError,
        result,
        'app.js',
        10
      );
    });
  });
});
