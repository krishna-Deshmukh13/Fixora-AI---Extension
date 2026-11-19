import { describe, it, expect } from 'vitest';
import { DuplicateDetector } from '../../src/metrics/duplicateDetector';

describe('DuplicateDetector', () => {
  it('should return empty findings when code has no duplicates', () => {
    const code = `
function foo() {
  const a = 1;
  const b = 2;
  return a + b;
}

function bar() {
  const x = "hello";
  const y = "world";
  return x + y;
}
    `;
    const findings = DuplicateDetector.detect(code, 'clean.js', 4);
    expect(findings.length).toBe(0);
  });

  it('should detect copy-pasted blocks of 4+ lines', () => {
    const code = `
function firstHandler() {
  const token = localStorage.getItem("token");
  const headers = { Authorization: "Bearer " + token };
  const url = "https://api.example.com/data";
  console.log("Dispatching to:", url);
  return headers;
}

function secondHandler() {
  const token = localStorage.getItem("token");
  const headers = { Authorization: "Bearer " + token };
  const url = "https://api.example.com/data";
  console.log("Dispatching to:", url);
  return headers;
}
    `;
    const findings = DuplicateDetector.detect(code, 'app.js', 4);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('Duplicate Code Block');
    expect(findings[0].category).toBe('quality');
    expect(findings[0].severity).toBe('info');
    expect(findings[0].explanation).toContain('lines was duplicated from line');
  });

  it('should ignore files that are too short to contain duplicates', () => {
    const code = `
const a = 1;
const b = 2;
    `;
    const findings = DuplicateDetector.detect(code, 'short.js', 4);
    expect(findings.length).toBe(0);
  });
});
