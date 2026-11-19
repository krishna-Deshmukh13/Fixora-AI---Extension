import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../../src/ai/providers/geminiProvider';

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider('mock-api-key', 'gemini-2.5-flash');
  });

  it('should report configured status based on API key validity', async () => {
    expect(await provider.isConfigured()).toBe(true);

    const emptyProvider = new GeminiProvider('', 'gemini-2.5-flash');
    expect(await emptyProvider.isConfigured()).toBe(false);
  });

  it('should process reviewCode successfully using mocked SDK output', async () => {
    const mockJson = JSON.stringify({
      summary: 'Clean code with minor suggestions',
      findings: [
        {
          title: 'Missing Type Annotation',
          severity: 'hint',
          category: 'quality',
          line: 5,
          column: 1,
          explanation: 'Explicit return type improves readability',
          whyItMatters: 'Better compiler inference',
          suggestedSolution: 'Add : string',
          confidence: 0.9,
        },
      ],
    });

    // Mock client.models.generateContent
    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: mockJson,
        }),
      },
    };

    const result = await provider.reviewCode({
      code: 'function hello() { return "world"; }',
      filePath: 'src/hello.ts',
      languageId: 'typescript',
    });

    expect(result.summary).toBe('Clean code with minor suggestions');
    expect(result.totalIssues).toBe(1);
    expect(result.findings[0].title).toBe('Missing Type Annotation');
    expect(result.providerName).toBe('Google Gemini');
  });

  it('should process explainError successfully using mocked SDK output', async () => {
    const mockExplanation = JSON.stringify({
      whatHappened: 'SyntaxError: Unexpected token',
      whyItHappened: 'A closing parenthesis was missing in the expression',
      rootCause: 'Unclosed function call on line 8',
      howToFix: 'Add the closing parenthesis )',
      correctedCodeSnippet: 'console.log("hello");',
      explanationOfCorrection: 'Closes the statement properly',
      conceptName: 'Syntax Grammar',
    });

    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: mockExplanation,
        }),
      },
    };

    const result = await provider.explainError({
      errorMessage: 'SyntaxError: Unexpected token',
      codeSnippet: 'console.log("hello"',
      line: 8,
    });

    expect(result.whatHappened).toContain('SyntaxError');
    expect(result.howToFix).toContain('closing parenthesis');
    expect(result.conceptName).toBe('Syntax Grammar');
  });

  it('should translate 429 rate limit errors to friendly developer messages', async () => {
    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error('429 Resource has been exhausted (e.g. check quota).')),
      },
    };

    await expect(
      provider.reviewCode({
        code: 'const x = 1;',
        filePath: 'test.js',
        languageId: 'javascript',
      })
    ).rejects.toThrow('Fixora AI: Google Gemini rate limit or quota exceeded');
  });

  it('should translate invalid API key errors to friendly configuration prompts', async () => {
    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error('API_KEY_INVALID: 400 Bad Request')),
      },
    };

    await expect(
      provider.reviewCode({
        code: 'const x = 1;',
        filePath: 'test.js',
        languageId: 'javascript',
      })
    ).rejects.toThrow('Fixora AI: Invalid Google Gemini API Key');
  });

  it('should abort requests when cancellation token is triggered', async () => {
    const abortController = new AbortController();

    (provider as any).client = {
      models: {
        generateContent: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ text: '{}' }), 500);
            })
        ),
      },
    };

    // Trigger abort immediately
    abortController.abort();

    await expect(
      provider.reviewCode({
        code: 'const x = 1;',
        filePath: 'test.js',
        languageId: 'javascript',
        abortSignal: abortController.signal,
      })
    ).rejects.toThrow('Request was cancelled by the user.');
  });
});
