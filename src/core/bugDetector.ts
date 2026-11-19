import * as vscode from 'vscode';
import { AIManager } from '../ai/aiManager';
import { ReviewFinding } from '../types';
import { Logger } from '../utils/logger';

/**
 * Smart Bug Detector combining high-speed deterministic heuristic rules with semantic AI analysis.
 */
export class BugDetector {
  private static instance: BugDetector;
  private logger = Logger.getInstance();

  private constructor(private readonly aiManager: AIManager) {}

  public static initialize(aiManager: AIManager): BugDetector {
    if (!BugDetector.instance) {
      BugDetector.instance = new BugDetector(aiManager);
    }
    return BugDetector.instance;
  }

  public static getInstance(): BugDetector {
    if (!BugDetector.instance) {
      throw new Error('BugDetector must be initialized before use.');
    }
    return BugDetector.instance;
  }

  /**
   * Run full bug detection on code, combining local heuristics with AI reasoning.
   */
  public async detectBugs(
    code: string,
    filePath: string,
    languageId: string,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ReviewFinding[]> {
    this.logger.info(`Running Smart Bug Detector on ${filePath} (${languageId})`);

    // 1. Run deterministic pattern rules immediately
    const deterministicFindings = this.runDeterministicBugChecks(code, filePath, languageId);

    // 2. Run AI semantic analysis if configured
    let aiFindings: ReviewFinding[] = [];
    const isConfigured = await this.aiManager.isConfigured();

    if (isConfigured) {
      try {
        const reviewResult = await this.aiManager.reviewCode(
          {
            code,
            filePath,
            languageId,
            staticFindings: deterministicFindings,
          },
          cancellationToken
        );

        // Filter for bug-related findings from AI
        aiFindings = reviewResult.findings.filter(
          (f) => f.category === 'bug' || f.category === 'syntax'
        );
      } catch (err: any) {
        this.logger.warn(`AI bug detection skipped: ${err?.message || err}`);
      }
    }

    // 3. Deduplicate and merge findings
    return this.mergeAndDeduplicate(deterministicFindings, aiFindings);
  }

  /**
   * Fast, zero-network deterministic static checks for common programming bugs.
   */
  public runDeterministicBugChecks(
    code: string,
    filePath: string,
    languageId: string
  ): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = code.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNumber = i + 1;

      // 1. Empty catch block (swallowed exception)
      if (/(?:javascript|typescript|java|c|cpp|php)/.test(languageId)) {
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(lineText)) {
          findings.push({
            id: `det-empty-catch-${lineNumber}`,
            title: 'Silently Swallowed Exception',
            severity: 'warning',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('catch') + 1,
            explanation: 'Empty catch block silently suppresses errors, preventing logging and concealing runtime failures.',
            whyItMatters: 'Makes debugging failures difficult and can cause unhandled corrupted state.',
            suggestedSolution: 'Add error logging (e.g. console.error(err)) or re-throw the exception.',
            suggestedFix: lineText.replace(/catch\s*\(([^)]*)\)\s*\{\s*\}/, 'catch ($1) { console.error($1); }'),
            confidence: 0.98,
            source: 'static',
            conceptName: 'Exception Handling',
          });
        }
      }

      // 2. Loose equality type coercion bug (JS/TS)
      if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
        const looseEqMatch = lineText.match(/(?<![!=])(==|!=)(?!=)/);
        // Avoid regex literals or comments
        if (looseEqMatch && !lineText.trim().startsWith('//') && !lineText.trim().startsWith('*')) {
          const operator = looseEqMatch[1];
          const replacement = operator === '==' ? '===' : '!==';
          findings.push({
            id: `det-loose-eq-${lineNumber}`,
            title: `Loose Equality Coercion (${operator})`,
            severity: 'info',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: (looseEqMatch.index || 0) + 1,
            explanation: `Using "${operator}" performs implicit type coercion, leading to unexpected truths (e.g. "0" == false is true).`,
            whyItMatters: 'Can result in false-positive condition evaluations and hard-to-trace logic bugs.',
            suggestedSolution: `Replace "${operator}" with strict equality "${replacement}".`,
            suggestedFix: lineText.replace(operator, replacement),
            confidence: 0.95,
            source: 'static',
            conceptName: 'Strict vs Loose Equality',
          });
        }
      }

      // 3. Unawaited async call (fetch / axios)
      if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
        if (/\b(?:fetch|axios\.(?:get|post|put|delete))\s*\(/.test(lineText)) {
          if (!/\bawait\b/.test(lineText) && !/\.then\s*\(/.test(lineText) && !/return\s+/.test(lineText)) {
            findings.push({
              id: `det-unawaited-${lineNumber}`,
              title: 'Unawaited Async Promise',
              severity: 'warning',
              category: 'bug',
              filePath,
              line: lineNumber,
              column: lineText.search(/\b(?:fetch|axios)/) + 1,
              explanation: 'Asynchronous network call was initiated without "await", ".then()", or a return statement.',
              whyItMatters: 'Network errors will trigger unhandled promise rejections and execution will proceed out of order.',
              suggestedSolution: 'Add "await" before the async call or handle with .then().catch().',
              suggestedFix: lineText.replace(/\b(fetch|axios)/, 'await $1'),
              confidence: 0.9,
              source: 'static',
              conceptName: 'Asynchronous Programming',
            });
          }
        }
      }

      // 4. Python: Mutable default argument
      if (languageId === 'python') {
        const mutableDefMatch = lineText.match(/def\s+\w+\([^)]*=\s*(\[\]|\{\})\)/);
        if (mutableDefMatch) {
          findings.push({
            id: `det-py-mutable-arg-${lineNumber}`,
            title: 'Mutable Default Argument',
            severity: 'warning',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: mutableDefMatch.index ? mutableDefMatch.index + 1 : 1,
            explanation: `Python creates default arguments once when the function is defined. A mutable default like ${mutableDefMatch[1]} retains mutations across calls.`,
            whyItMatters: 'Causes data leakage and state pollution across different function invocations.',
            suggestedSolution: 'Use None as default parameter value and initialize inside the function (if arg is None: arg = []).',
            confidence: 0.99,
            source: 'static',
            conceptName: 'Python Default Arguments',
          });
        }
      }

      // 5. Infinite loop pattern: while(true) with no break
      if (/(?:javascript|typescript|python|java|c|cpp|php)/.test(languageId)) {
        if (/\bwhile\s*\(\s*(?:true|1)\s*\)|\bwhile\s+True:/.test(lineText)) {
          // Look ahead 10 lines to verify if break exists
          const lookahead = lines.slice(i, i + 10).join('\n');
          if (!/\b(?:break|return|throw|raise|process\.exit|sys\.exit)\b/.test(lookahead)) {
            findings.push({
              id: `det-infinite-loop-${lineNumber}`,
              title: 'Potential Infinite Loop',
              severity: 'critical',
              category: 'bug',
              filePath,
              line: lineNumber,
              column: lineText.indexOf('while') + 1,
              explanation: 'While loop has a constant true condition and no exit statement (break/return) was detected in the loop block.',
              whyItMatters: 'Will lock up the CPU thread and freeze the host process.',
              suggestedSolution: 'Ensure a terminating condition with a "break" or loop variable increment.',
              confidence: 0.92,
              source: 'static',
              conceptName: 'Loop Termination Condition',
            });
          }
        }
      }

      // 6. Accidental Assignment in Condition: if (x = 5)
      if (['javascript', 'typescript', 'c', 'cpp', 'java', 'php'].includes(languageId)) {
        const assignMatch = lineText.match(/\bif\s*\([^=!<>\n]*[^=!<>]=[^=][^)\n]*\)/);
        if (assignMatch && !lineText.includes('==') && !lineText.includes('===')) {
          findings.push({
            id: `det-assign-in-cond-${lineNumber}`,
            title: 'Accidental Assignment in Condition',
            severity: 'critical',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: assignMatch.index ? assignMatch.index + 1 : 1,
            explanation: 'Single "=" assignment operator found inside an "if" condition statement instead of equality comparison.',
            whyItMatters: 'Reassigns variable value every time and always evaluates to truthy/falsy assignment value.',
            suggestedSolution: 'Use comparison operator "===" or "==" instead of single assignment "=".',
            suggestedFix: lineText.replace(/=/, '==='),
            confidence: 0.95,
            source: 'static',
          });
        }
      }

      // 7. SQL: Catastrophic UPDATE / DELETE missing WHERE clause
      if (languageId === 'sql' || filePath.endsWith('.sql')) {
        const upper = lineText.toUpperCase().trim();
        if ((upper.startsWith('DELETE FROM') || upper.startsWith('UPDATE ')) && !upper.includes('WHERE')) {
          findings.push({
            id: `det-sql-no-where-${lineNumber}`,
            title: 'Catastrophic SQL Query: Missing WHERE Clause',
            severity: 'critical',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: 1,
            explanation: 'DELETE or UPDATE statement without a WHERE clause will modify or delete EVERY row in the database table.',
            whyItMatters: 'Severe data loss risk in development and production environments.',
            suggestedSolution: 'Add a restrictive WHERE clause (e.g. WHERE id = ?).',
            confidence: 0.99,
            source: 'static',
          });
        }
      }

      // 8. Python: Bare except:
      if (languageId === 'python') {
        if (/^\s*except\s*:/.test(lineText)) {
          findings.push({
            id: `det-py-bare-except-${lineNumber}`,
            title: 'Bare "except:" Statement',
            severity: 'warning',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('except') + 1,
            explanation: 'Bare "except:" catches all exceptions including SystemExit and KeyboardInterrupt, preventing user cancellation.',
            whyItMatters: 'Masks underlying bugs and ignores intentional program interruption signals.',
            suggestedSolution: 'Catch specific exception types or use "except Exception:".',
            suggestedFix: lineText.replace(/except\s*:/, 'except Exception:'),
            confidence: 0.98,
            source: 'static',
          });
        }
      }

      // 9. HTML: Missing alt attribute on <img>
      if (languageId === 'html') {
        if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(lineText)) {
          findings.push({
            id: `det-html-img-alt-${lineNumber}`,
            title: 'Missing Image "alt" Attribute (Accessibility)',
            severity: 'warning',
            category: 'quality',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('<img') + 1,
            explanation: 'HTML <img> tag is missing an "alt" attribute required for screen readers and SEO.',
            whyItMatters: 'Violates WCAG 2.1 accessibility guidelines and hinders visually impaired users.',
            suggestedSolution: 'Provide a descriptive alt attribute (e.g. alt="Company Logo").',
            confidence: 0.96,
            source: 'static',
          });
        }
      }

      // 10. Java: String comparison with ==
      if (languageId === 'java') {
        if (/["'][^"']*["']\s*==|==\s*["'][^"']*["']/.test(lineText)) {
          findings.push({
            id: `det-java-string-eq-${lineNumber}`,
            title: 'String Reference Comparison with "=="',
            severity: 'critical',
            category: 'bug',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('==') + 1,
            explanation: 'In Java, "==" compares object memory references rather than string contents.',
            whyItMatters: 'Produces unexpected false evaluations even when string characters are identical.',
            suggestedSolution: 'Use .equals() method instead of "==" (e.g. str1.equals(str2)).',
            confidence: 0.97,
            source: 'static',
          });
        }
      }

      // 11. C/C++: Buffer overflow risk with gets() or strcpy()
      if (['c', 'cpp'].includes(languageId)) {
        if (/\b(?:gets|strcpy|sprintf)\s*\(/.test(lineText)) {
          findings.push({
            id: `det-c-unsafe-func-${lineNumber}`,
            title: 'Unsafe Function Call (Buffer Overflow Risk)',
            severity: 'critical',
            category: 'security',
            filePath,
            line: lineNumber,
            column: lineText.search(/\b(?:gets|strcpy|sprintf)/) + 1,
            explanation: 'Functions like gets(), strcpy(), and sprintf() do not perform buffer boundary validation.',
            whyItMatters: 'Classic attack vector for arbitrary code execution and memory corruption vulnerabilities.',
            suggestedSolution: 'Replace with bounds-checked alternatives: fgets(), strncpy(), snprintf().',
            confidence: 0.98,
            source: 'static',
          });
        }
      }
    }

    return findings;
  }

  /**
   * Merges deterministic static findings with AI findings, deduplicating findings on the same line.
   */
  public mergeAndDeduplicate(
    staticFindings: ReviewFinding[],
    aiFindings: ReviewFinding[]
  ): ReviewFinding[] {
    const merged: ReviewFinding[] = [...staticFindings];
    const coveredLines = new Set(staticFindings.map((f) => f.line));

    for (const aiFinding of aiFindings) {
      if (coveredLines.has(aiFinding.line)) {
        // Line was already caught by deterministic check: combine them with boosted confidence
        const existing = merged.find((f) => f.line === aiFinding.line);
        if (existing) {
          existing.source = 'combined';
          existing.confidence = 1.0;
          if (aiFinding.suggestedFix && !existing.suggestedFix) {
            existing.suggestedFix = aiFinding.suggestedFix;
          }
        }
      } else {
        merged.push(aiFinding);
        coveredLines.add(aiFinding.line);
      }
    }

    // Sort: critical first, then warning, then line number
    const severityWeight: Record<string, number> = {
      critical: 3,
      warning: 2,
      info: 1,
      hint: 0,
    };

    return merged.sort((a, b) => {
      const weightDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      if (weightDiff !== 0) return weightDiff;
      return a.line - b.line;
    });
  }
}
