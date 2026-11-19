import { ReviewFinding } from '../types';
import { ComplexityRefactorer } from './complexityRefactorer';

export interface FunctionComplexity {
  name: string;
  line: number;
  endLine: number;
  complexity: number;
  rating: 'low' | 'moderate' | 'high' | 'very-high';
  codeSnippet?: string;
  refactoredCode?: string;
}

export interface CodeHealthMetrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number; // 0 - 100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  complexFunctions: FunctionComplexity[];
  findings: ReviewFinding[];
}

/**
 * Deterministic, offline complexity and code health analyzer.
 * Calculates Cyclomatic Complexity and Maintainability Index without external services.
 */
export class ComplexityAnalyzer {
  /**
   * Analyzes source code and produces comprehensive health metrics.
   */
  public static analyze(code: string, filePath: string, languageId: string): CodeHealthMetrics {
    const lines = code.split(/\r?\n/);
    const totalLines = lines.length;

    let commentLines = 0;
    let codeLines = 0;
    let inBlockComment = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (inBlockComment) {
        commentLines++;
        if (line.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      if (line.startsWith('/*')) {
        commentLines++;
        if (!line.includes('*/')) {
          inBlockComment = true;
        }
        continue;
      }

      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('--')) {
        commentLines++;
        continue;
      }

      codeLines++;
    }

    // Cyclomatic Complexity calculation based on control flow decision points
    const decisionPatterns = [
      /\bif\b/g,
      /\belif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?\s*[^:]+:/g, // ternary
    ];

    let cyclomaticComplexity = 1;
    for (const pattern of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    }

    // Analyze individual function complexities
    const complexFunctions = this.detectComplexFunctions(lines, languageId);

    // Maintainability Index (Simplified standard SEI formula normalized to 0 - 100)
    // MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(LOC) + 50 * sin(sqrt(2.4 * perCM))
    const locPenalty = Math.log(Math.max(1, codeLines)) * 16.2;
    const ccPenalty = cyclomaticComplexity * 0.25;
    const commentBonus = codeLines > 0 ? (commentLines / codeLines) * 20 : 0;
    let maintainabilityIndex = Math.round(Math.max(0, Math.min(100, 100 - locPenalty - ccPenalty + commentBonus)));

    if (codeLines < 15 && cyclomaticComplexity < 5) {
      maintainabilityIndex = Math.max(85, maintainabilityIndex);
    }

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (maintainabilityIndex >= 85) grade = 'A';
    else if (maintainabilityIndex >= 70) grade = 'B';
    else if (maintainabilityIndex >= 55) grade = 'C';
    else if (maintainabilityIndex >= 40) grade = 'D';
    else grade = 'F';

    // Generate findings for high complexity
    const findings: ReviewFinding[] = [];
    for (const fn of complexFunctions) {
      if (fn.complexity >= 10) {
        findings.push({
          id: `complexity-${fn.line}`,
          title: `High Cyclomatic Complexity (${fn.complexity}) in function "${fn.name}"`,
          severity: fn.complexity >= 15 ? 'critical' : 'warning',
          category: 'performance',
          filePath,
          line: fn.line,
          endLine: fn.endLine,
          explanation: `Function "${fn.name}" has a cyclomatic complexity of ${fn.complexity} (recommended is under 10). High complexity indicates deeply nested branches, difficult debugging, and poor testability.`,
          whyItMatters: 'Functions with high complexity have statistically higher bug rates and require significantly more unit test variations to achieve code coverage.',
          suggestedSolution: 'Replace nested branches with guard clauses / lookup strategy to reduce complexity.',
          suggestedFix: fn.refactoredCode,
          confidence: 0.98,
          source: 'static',
        });
      }
    }

    return {
      totalLines,
      codeLines,
      commentLines,
      cyclomaticComplexity,
      maintainabilityIndex,
      grade,
      complexFunctions,
      findings,
    };
  }

  private static detectComplexFunctions(lines: string[], languageId: string): FunctionComplexity[] {
    const list: FunctionComplexity[] = [];
    const fnRegex =
      languageId === 'python'
        ? /^(\s*)def\s+([a-zA-Z0-9_]+)\s*\(/
        : /^(\s*)(?:async\s+)?(?:function\s+([a-zA-Z0-9_]+)|([a-zA-Z0-9_]+)\s*=\s*(?:async\s+)?\(|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{)/;

    let currentFn: { name: string; line: number; indent: number; complexity: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(fnRegex);

      if (match) {
        if (currentFn) {
          const endLine = i;
          const snippet = lines.slice(currentFn.line - 1, endLine).join('\n');
          const refactoredCode =
            currentFn.complexity >= 10
              ? ComplexityRefactorer.generateAlternative(
                  currentFn.name,
                  snippet,
                  languageId,
                  currentFn.complexity
                )
              : undefined;

          list.push({
            name: currentFn.name,
            line: currentFn.line,
            endLine,
            complexity: currentFn.complexity,
            rating: this.getRating(currentFn.complexity),
            codeSnippet: snippet,
            refactoredCode,
          });
        }

        const fnName = match[2] || match[3] || match[4] || 'anonymous';
        const indent = match[1].length;
        currentFn = { name: fnName, line: i + 1, indent, complexity: 1 };
        continue;
      }

      if (currentFn) {
        // Count branches inside current function
        const branches = (line.match(/\b(if|elif|else\s+if|for|while|case|catch)\b|&&|\|\||\?/g) || []).length;
        currentFn.complexity += branches;
      }
    }

    if (currentFn) {
      const endLine = lines.length;
      const snippet = lines.slice(currentFn.line - 1, endLine).join('\n');
      const refactoredCode =
        currentFn.complexity >= 10
          ? ComplexityRefactorer.generateAlternative(
              currentFn.name,
              snippet,
              languageId,
              currentFn.complexity
            )
          : undefined;

      list.push({
        name: currentFn.name,
        line: currentFn.line,
        endLine,
        complexity: currentFn.complexity,
        rating: this.getRating(currentFn.complexity),
        codeSnippet: snippet,
        refactoredCode,
      });
    }

    return list;
  }

  private static getRating(complexity: number): 'low' | 'moderate' | 'high' | 'very-high' {
    if (complexity <= 5) return 'low';
    if (complexity <= 10) return 'moderate';
    if (complexity <= 15) return 'high';
    return 'very-high';
  }
}
