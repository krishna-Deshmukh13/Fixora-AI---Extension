import { describe, it, expect } from 'vitest';
import { PromptManager } from '../../src/ai/promptManager';

describe('PromptManager', () => {
  it('should generate system instruction with learning mode off', () => {
    const instruction = PromptManager.getSystemInstruction(false);
    expect(instruction).toContain('You are Fixora AI');
    expect(instruction).toContain('STRICT OPERATIONAL RULES');
    expect(instruction).toContain('production-grade recommendations');
    expect(instruction).not.toContain('LEARNING MODE IS ENABLED');
  });

  it('should generate system instruction with learning mode enabled', () => {
    const instruction = PromptManager.getSystemInstruction(true);
    expect(instruction).toContain('LEARNING MODE IS ENABLED');
    expect(instruction).toContain('beginner-friendly, educational terms');
  });

  it('should build review prompt with code and language details', () => {
    const prompt = PromptManager.buildReviewPrompt({
      code: 'const x = 10;',
      filePath: 'src/index.ts',
      languageId: 'typescript',
      learningMode: true,
    });

    expect(prompt).toContain('Analyze the following typescript code from file "src/index.ts"');
    expect(prompt).toContain('const x = 10;');
    expect(prompt).toContain('"conceptName"');
    expect(prompt).toContain('"learningNote"');
  });

  it('should include deterministic static findings in review prompt if provided', () => {
    const prompt = PromptManager.buildReviewPrompt({
      code: 'function test() {}',
      filePath: 'src/test.js',
      languageId: 'javascript',
      staticFindings: [
        {
          id: 'static-1',
          title: 'Missing return type',
          severity: 'warning',
          category: 'quality',
          filePath: 'src/test.js',
          line: 1,
          explanation: '',
          whyItMatters: '',
          suggestedSolution: '',
          confidence: 1.0,
          source: 'static',
        },
      ],
    });

    expect(prompt).toContain('Deterministic Static Linter Findings');
    expect(prompt).toContain('Missing return type');
  });

  it('should build error explanation prompt with stack trace', () => {
    const prompt = PromptManager.buildErrorExplanationPrompt({
      errorMessage: 'ReferenceError: foo is not defined',
      stackTrace: 'at Object.<anonymous> (/app/index.js:5:1)',
      filePath: '/app/index.js',
      line: 5,
      languageId: 'javascript',
    });

    expect(prompt).toContain('ReferenceError: foo is not defined');
    expect(prompt).toContain('STACK TRACE:');
    expect(prompt).toContain('/app/index.js:5:1');
    expect(prompt).toContain('"whatHappened"');
    expect(prompt).toContain('"rootCause"');
  });

  it('should build fix prompt with surrounding code context', () => {
    const prompt = PromptManager.buildFixPrompt(
      {
        id: 'f-1',
        title: 'Potential SQL Injection',
        severity: 'critical',
        category: 'security',
        filePath: 'src/db.ts',
        line: 10,
        explanation: 'Direct variable interpolation into SQL query',
        whyItMatters: 'Arbitrary database execution',
        suggestedSolution: 'Use parameterized query',
        confidence: 0.99,
        source: 'ai',
      },
      'const query = `SELECT * FROM users WHERE id = ${id}`;'
    );

    expect(prompt).toContain('Potential SQL Injection');
    expect(prompt).toContain('Direct variable interpolation');
    expect(prompt).toContain('SELECT * FROM users WHERE id = ${id}');
  });
});
