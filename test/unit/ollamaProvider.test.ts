import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../src/ai/providers/ollamaProvider';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    provider = new OllamaProvider('http://localhost:11434', 'codellama');
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should initialize with correct id and displayName', () => {
    expect(provider.id).toBe('ollama');
    expect(provider.displayName).toContain('Ollama Local LLM');
    expect(provider.modelName).toBe('codellama');
  });

  it('should verify configuration via /api/tags', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ models: [{ name: 'codellama:latest' }] }),
    } as any);

    const configured = await provider.isConfigured();
    expect(configured).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', { method: 'GET' });
  });

  it('should return false if Ollama is unreachable in isConfigured', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));

    const configured = await provider.isConfigured();
    expect(configured).toBe(false);
  });

  it('should update model name via updateCredentials', () => {
    provider.updateCredentials('', 'deepseek-coder');
    expect(provider.modelName).toBe('deepseek-coder');
  });

  it('should execute reviewCode and parse structured JSON findings', async () => {
    const mockJson = JSON.stringify({
      summary: 'Found 1 issue in offline review',
      findings: [
        {
          title: 'Unchecked return value',
          severity: 'warning',
          category: 'bug',
          line: 12,
          explanation: 'Function return value is ignored',
          whyItMatters: 'Silent failure',
          suggestedSolution: 'Check return value',
          confidence: 0.9,
        },
      ],
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ response: mockJson }),
    } as any);

    const result = await provider.reviewCode({
      code: 'function test() { doWork(); }',
      filePath: 'test.js',
      learningMode: false,
    });

    expect(result.summary).toContain('Found 1 issue');
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].title).toBe('Unchecked return value');
    expect(result.findings[0].source).toBe('ai');
    expect(result.modelName).toBe('codellama');
  });

  it('should throw friendly error when Ollama connection is refused', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

    await expect(
      provider.reviewCode({
        code: 'console.log(1);',
        filePath: 'test.js',
        learningMode: false,
      })
    ).rejects.toThrow(/Could not connect to local Ollama at http:\/\/localhost:11434/);
  });

  it('should handle cancellation signal cleanly', async () => {
    const controller = new AbortController();
    controller.abort();

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(
      provider.reviewCode({
        code: 'console.log(1);',
        filePath: 'test.js',
        learningMode: false,
        abortSignal: controller.signal,
      })
    ).rejects.toThrow(/Fixora AI: Local Ollama request was cancelled/);
  });
});
