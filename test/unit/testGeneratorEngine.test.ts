import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestGeneratorEngine } from '../../src/core/testGeneratorEngine';

describe('TestGeneratorEngine', () => {
  let mockAiManager: any;
  let engine: TestGeneratorEngine;

  beforeEach(() => {
    (TestGeneratorEngine as any).instance = undefined;
    mockAiManager = {
      isConfigured: vi.fn().mockResolvedValue(true),
      streamChat: vi.fn().mockImplementation(async (prompt, onChunk) => {
        const json = JSON.stringify({
          framework: 'vitest',
          testCode: 'import { describe, it, expect } from "vitest";\ndescribe("add", () => { it("works", () => { expect(1+1).toBe(2); }); });',
          testFilePath: 'test/unit/math.test.ts',
          dependenciesNeeded: ['vitest'],
          testCasesSummary: ['Validates basic addition'],
        });
        onChunk(json);
        return json;
      }),
    };
    engine = TestGeneratorEngine.initialize(mockAiManager);
  });

  it('should detect vitest framework for typescript file by default', () => {
    const framework = engine.detectTestFramework('/app/src/index.ts', 'typescript');
    expect(framework).toBe('vitest');
  });

  it('should detect pytest framework for python file', () => {
    const framework = engine.detectTestFramework('/app/src/main.py', 'python');
    expect(framework).toBe('pytest');
  });

  it('should suggest conventional test file paths', () => {
    expect(engine.suggestTestFilePath('/app/src/user.ts')).toBe('/app/src/user.test.ts');
    expect(engine.suggestTestFilePath('/app/src/service.py')).toBe('/app/src/test_service.py');
    expect(engine.suggestTestFilePath('/app/src/Order.java')).toBe('/app/src/OrderTest.java');
  });

  it('should generate structured unit test results via AI', async () => {
    const result = await engine.generateTests(
      'export function add(a: number, b: number) { return a + b; }',
      '/app/src/math.ts',
      'typescript'
    );

    expect(result.framework).toBe('vitest');
    expect(result.testCode).toContain('describe("add"');
    expect(result.testFilePath).toBe('test/unit/math.test.ts');
    expect(result.testCasesSummary.length).toBe(1);
  });
});
