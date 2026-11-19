import { describe, it, expect } from 'vitest';
import { ResponseParser } from '../../src/ai/responseParser';

describe('ResponseParser', () => {
  it('should extract JSON from markdown code fences', () => {
    const raw = '```json\n{\n  "summary": "Looks good",\n  "findings": []\n}\n```';
    const extracted = ResponseParser.extractJson(raw);
    expect(extracted).toBe('{\n  "summary": "Looks good",\n  "findings": []\n}');
  });

  it('should extract JSON embedded in explanatory text', () => {
    const raw = 'Here is the analysis:\n{"summary": "Test", "findings": []}\nHope this helps!';
    const extracted = ResponseParser.extractJson(raw);
    expect(extracted).toBe('{"summary": "Test", "findings": []}');
  });

  it('should parse and normalize a valid code review response', () => {
    const json = JSON.stringify({
      summary: 'Found 2 potential problems',
      findings: [
        {
          title: 'Uncaught Promise Rejection',
          severity: 'error',
          category: 'defect',
          line: '14',
          column: '5',
          explanation: 'Async function missing try-catch block',
          whyItMatters: 'Can crash Node process in unhandledRejection',
          suggestedSolution: 'Add try-catch or return await',
          confidence: 0.95,
        },
        {
          title: 'Unused Variable',
          severity: 'style',
          category: 'quality',
          line: 22,
          explanation: 'Variable is never read',
          whyItMatters: 'Clutters scope',
          suggestedSolution: 'Remove variable',
          confidence: 0.8,
        },
      ],
    });

    const result = ResponseParser.parseReviewResponse(
      json,
      'src/server.ts',
      'Google Gemini',
      'gemini-2.5-flash',
      150
    );

    expect(result.summary).toBe('Found 2 potential problems');
    expect(result.totalIssues).toBe(2);
    expect(result.criticalCount).toBe(1); // 'error' normalized to 'critical'
    expect(result.infoCount).toBe(1); // 'style' normalized to 'hint' (informational/style category)
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].line).toBe(14); // String '14' coerced to number 14
    expect(result.findings[0].category).toBe('bug'); // 'defect' normalized to 'bug'
    expect(result.findings[1].severity).toBe('hint'); // 'style' normalized to 'hint'
  });

  it('should parse error explanation response', () => {
    const json = JSON.stringify({
      whatHappened: 'Cannot read properties of undefined',
      whyItHappened: 'Object is null at access time',
      rootCause: 'Data was not yet fetched from API',
      howToFix: 'Add optional chaining user?.name',
      correctedCodeSnippet: 'console.log(user?.name);',
      explanationOfCorrection: 'Prevents runtime TypeError',
      conceptName: 'Optional Chaining in TypeScript',
    });

    const explanation = ResponseParser.parseErrorExplanation(json);
    expect(explanation.whatHappened).toContain('Cannot read properties');
    expect(explanation.correctedCodeSnippet).toBe('console.log(user?.name);');
    expect(explanation.conceptName).toBe('Optional Chaining in TypeScript');
  });

  it('should parse fix proposal response', () => {
    const json = JSON.stringify({
      replacementCode: 'const user = await fetchUser();',
      explanation: 'Added await keyword to resolve Promise before usage',
    });

    const fix = ResponseParser.parseFixResponse(json);
    expect(fix.replacementCode).toBe('const user = await fetchUser();');
    expect(fix.explanation).toContain('Added await');
  });

  it('should handle invalid JSON gracefully in error explanation', () => {
    const broken = 'This is not valid JSON at all';
    const fallback = ResponseParser.parseErrorExplanation(broken);
    expect(fallback.whatHappened).toBe('This is not valid JSON at all');
    expect(fallback.rootCause).toBe('Unstructured model response.');
  });
});
