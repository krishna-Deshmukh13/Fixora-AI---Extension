import { describe, it, expect } from 'vitest';
import { ReviewFinding, ReviewSeverity, ReviewCategory } from '../../src/types/review';
import { FixoraDiagnostic } from '../../src/types/diagnostics';

describe('Fixora AI Stage 1 Baseline Setup', () => {
  it('should define review finding data structures correctly', () => {
    const finding: ReviewFinding = {
      id: 'finding-001',
      title: 'Potential SQL Injection',
      severity: 'critical',
      category: 'security',
      filePath: 'src/db/query.ts',
      line: 42,
      column: 15,
      explanation: 'User input concatenated directly into SQL statement.',
      whyItMatters: 'Allows attackers to execute arbitrary SQL commands.',
      suggestedSolution: 'Use parameterized queries instead.',
      confidence: 0.95,
      source: 'ai',
      conceptName: 'SQL Injection Prevention'
    };

    expect(finding.id).toBe('finding-001');
    expect(finding.severity).toBe('critical');
    expect(finding.category).toBe('security');
    expect(finding.confidence).toBeGreaterThan(0.9);
  });

  it('should map diagnostics with valid line ranges', () => {
    const diagnostic: FixoraDiagnostic = {
      finding: {
        id: 'finding-002',
        title: 'Undefined variable access',
        severity: 'warning',
        category: 'bug',
        filePath: 'src/app.ts',
        line: 10,
        explanation: 'Variable x might be used before declaration.',
        whyItMatters: 'Can cause ReferenceError at runtime.',
        suggestedSolution: 'Declare x before use.',
        confidence: 0.88,
        source: 'static'
      },
      range: {
        startLine: 9, // 0-indexed for VS Code range mapping
        startColumn: 4,
        endLine: 9,
        endColumn: 12
      },
      code: 'FIXORA-BUG-002',
      source: 'Fixora AI'
    };

    expect(diagnostic.code).toContain('FIXORA-BUG');
    expect(diagnostic.range.startLine).toBe(9);
  });
});
