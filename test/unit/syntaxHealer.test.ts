import { describe, it, expect } from 'vitest';
import { SyntaxHealer } from '../../src/formatter/syntaxHealer';

describe('SyntaxHealer (Auto-Syntax Repair)', () => {
  it('should clean stray trailing tokens at EOF (e.g. lone |)', () => {
    const broken = `
function test() {
  return 42;
}
|
`;
    const result = SyntaxHealer.repair(broken, 'javascript');
    expect(result.repaired).toBe(true);
    expect(result.code).not.toContain('|');
    expect(result.code).toContain('return 42;');
  });

  it('should auto-close missing brackets and braces', () => {
    const unclosed = `
function processUser(user) {
  if (user) {
    console.log(user.name);
`;
    const result = SyntaxHealer.repair(unclosed, 'javascript');
    expect(result.repaired).toBe(true);
    // Should have appended two closing braces
    expect(result.code.trim().endsWith('}')).toBe(true);
  });

  it('should auto-close unclosed HTML/JSX tags', () => {
    const unclosedHtml = `
<div class="container">
  <section class="main">
    <p>Hello world</p>
`;
    const result = SyntaxHealer.repair(unclosedHtml, 'html');
    expect(result.repaired).toBe(true);
    expect(result.code).toContain('</section>');
    expect(result.code).toContain('</div>');
  });

  it('should auto-close unclosed string literals', () => {
    const unclosedStr = 'const greeting = "Hello world;';
    const result = SyntaxHealer.repair(unclosedStr, 'javascript');
    expect(result.repaired).toBe(true);
    expect(result.code.endsWith('"')).toBe(true);
  });

  it('should return unchanged when code is valid and well-formed', () => {
    const valid = 'const x = [1, 2, 3];';
    const result = SyntaxHealer.repair(valid, 'javascript');
    expect(result.repaired).toBe(false);
    expect(result.code).toBe(valid);
  });
});
