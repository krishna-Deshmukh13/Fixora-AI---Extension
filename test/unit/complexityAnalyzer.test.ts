import { describe, it, expect } from 'vitest';
import { ComplexityAnalyzer } from '../../src/metrics/complexityAnalyzer';

describe('ComplexityAnalyzer', () => {
  it('should analyze simple code and return Grade A and low cyclomatic complexity', () => {
    const code = `
function add(a, b) {
  return a + b;
}
    `;
    const metrics = ComplexityAnalyzer.analyze(code, 'math.js', 'javascript');

    expect(metrics.cyclomaticComplexity).toBe(1);
    expect(metrics.grade).toBe('A');
    expect(metrics.maintainabilityIndex).toBeGreaterThanOrEqual(85);
    expect(metrics.findings.length).toBe(0);
  });

  it('should calculate higher cyclomatic complexity for multiple branches', () => {
    const code = `
function process(x, y, z) {
  if (x > 0) {
    if (y > 0) {
      while (z > 0) {
        z--;
      }
    } else if (y < -5) {
      return -1;
    }
  } else {
    for (let i = 0; i < 10; i++) {
      console.log(i);
    }
  }
  return x && y || z;
}
    `;
    const metrics = ComplexityAnalyzer.analyze(code, 'branches.js', 'javascript');

    expect(metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(7);
    expect(metrics.totalLines).toBeGreaterThan(10);
    expect(metrics.codeLines).toBeGreaterThan(10);
  });

  it('should detect complex functions exceeding threshold and generate findings', () => {
    // Generate a function with cyclomatic complexity >= 10
    const code = `
function complexHandler(val) {
  if (val === 1) return 'a';
  if (val === 2) return 'b';
  if (val === 3) return 'c';
  if (val === 4) return 'd';
  if (val === 5) return 'e';
  if (val === 6) return 'f';
  if (val === 7) return 'g';
  if (val === 8) return 'h';
  if (val === 9) return 'i';
  if (val === 10) return 'j';
  if (val === 11) return 'k';
  return 'z';
}
    `;
    const metrics = ComplexityAnalyzer.analyze(code, 'heavy.js', 'javascript');

    expect(metrics.complexFunctions.length).toBe(1);
    expect(metrics.complexFunctions[0].name).toBe('complexHandler');
    expect(metrics.complexFunctions[0].complexity).toBeGreaterThanOrEqual(10);
    expect(metrics.findings.length).toBeGreaterThanOrEqual(1);
    expect(metrics.findings[0].title).toContain('High Cyclomatic Complexity');
    expect(metrics.findings[0].category).toBe('performance');
  });

  it('should detect Python functions and calculate complexity', () => {
    const pyCode = `
def evaluate_score(score):
    if score > 90:
        return 'A'
    elif score > 80:
        return 'B'
    elif score > 70:
        return 'C'
    else:
        return 'F'
    `;
    const metrics = ComplexityAnalyzer.analyze(pyCode, 'scores.py', 'python');

    expect(metrics.complexFunctions.length).toBe(1);
    expect(metrics.complexFunctions[0].name).toBe('evaluate_score');
    expect(metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(4);
  });
});
