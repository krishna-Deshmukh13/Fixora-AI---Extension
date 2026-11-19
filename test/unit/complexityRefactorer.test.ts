import { describe, it, expect } from 'vitest';
import { ComplexityRefactorer } from '../../src/metrics/complexityRefactorer';

describe('ComplexityRefactorer (Offline Low-Complexity Code Generator)', () => {
  it('should generate a lookup map refactoring for discount/rate functions', () => {
    const rawCode = `function getDiscount(tier) {
  if (tier === 'bronze') return 0.05;
  if (tier === 'silver') return 0.10;
  if (tier === 'gold') return 0.15;
  if (tier === 'platinum') return 0.20;
  return 0;
}`;

    const refactored = ComplexityRefactorer.generateRefactoredCode(rawCode, 'getDiscount', 12);
    expect(refactored).toBeDefined();
    expect(refactored).toContain('function getDiscount(tier)');
    expect(refactored).toContain('TIER_DISCOUNTS');
    expect(refactored).toContain('// Refactored by Fixora AI: Complexity reduced from 12 to 2 (Guard Clauses + Lookup Table)');
  });

  it('should generate decomposed helper refactoring for nested conditionals', () => {
    const rawCode = `function processOrder(order, user) {
  if (order) {
    if (user) {
      if (order.items && order.items.length > 0) {
        return calculateTotal(order);
      }
    }
  }
  return null;
}`;

    const refactored = ComplexityRefactorer.generateRefactoredCode(rawCode, 'processOrder', 15);
    expect(refactored).toBeDefined();
    expect(refactored).toContain('function processOrder(order, user)');
    expect(refactored).toContain('function calculateSubHelper(data)');
    expect(refactored).toContain('// Refactored by Fixora AI: Complexity reduced from 15 to 2 (Decomposed Helper)');
  });

  it('should handle Python functions and generate Pythonic dictionary lookup', () => {
    const pyCode = `def calculate_discount(tier):
    if tier == 'vip':
        return 0.3
    elif tier == 'gold':
        return 0.2
    return 0`;

    const refactored = ComplexityRefactorer.generateAlternative('calculate_discount', pyCode, 'python', 12);
    expect(refactored).toBeDefined();
    expect(refactored).toContain('TIER_RATES = {');
    expect(refactored).toContain('def calculate_discount(tier):');
    expect(refactored).toContain('# Refactored by Fixora AI: Complexity reduced from 12 to 2 (Lookup Map)');
  });
});
