import { z } from 'zod';
import {
  ErrorExplanationResult,
  ReviewCategory,
  ReviewFinding,
  ReviewResult,
  ReviewSeverity,
} from '../types';
import { Logger } from '../utils/logger';

// Zod Schema for Raw Finding from LLM
const RawFindingSchema = z.object({
  title: z.string().default('Unnamed Issue'),
  severity: z.string().default('warning'),
  category: z.string().default('bug'),
  line: z.union([z.number(), z.string()]).default(1),
  column: z.union([z.number(), z.string()]).optional().default(1),
  endLine: z.union([z.number(), z.string()]).optional(),
  endColumn: z.union([z.number(), z.string()]).optional(),
  explanation: z.string().default(''),
  whyItMatters: z.string().default(''),
  suggestedSolution: z.string().default(''),
  suggestedFix: z.string().optional(),
  originalCodeSnippet: z.string().optional(),
  evidence: z.string().optional(),
  confidence: z.number().optional().default(0.9),
  conceptName: z.string().optional(),
  learningNote: z.string().optional(),
});

// Zod Schema for Code Review Response
const RawReviewResponseSchema = z.object({
  summary: z.string().default('Analysis complete.'),
  findings: z.array(RawFindingSchema).default([]),
});

// Zod Schema for Error Explanation Response
const RawErrorExplanationSchema = z.object({
  whatHappened: z.string().default('An error occurred during execution.'),
  whyItHappened: z.string().default('The program encountered an unexpected condition.'),
  rootCause: z.string().default('Root cause could not be determined with certainty.'),
  howToFix: z.string().default('Review the error stack and correct the failing statement.'),
  correctedCodeSnippet: z.string().optional(),
  explanationOfCorrection: z.string().default(''),
  conceptName: z.string().optional(),
  learningTakeaway: z.string().optional(),
  inferredCauses: z.array(z.string()).optional(),
  confirmedCauses: z.array(z.string()).optional(),
  relatedReferences: z.array(z.string()).optional(),
  suggestedActions: z.array(z.string()).optional(),
});

// Zod Schema for Fix Generation Response
const RawFixResponseSchema = z.object({
  replacementCode: z.string().default(''),
  explanation: z.string().default(''),
});

/**
 * Safely parses, validates, and normalizes AI model outputs into strictly typed structures.
 */
export class ResponseParser {
  private static logger = Logger.getInstance();

  /**
   * Extract JSON string from potentially markdown-wrapped text.
   */
  public static extractJson(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Empty response received from AI model.');
    }

    const trimmed = rawText.trim();

    // Check for markdown ```json ... ``` code fence
    const jsonFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonFenceMatch && jsonFenceMatch[1]) {
      return jsonFenceMatch[1].trim();
    }

    // Check for raw JSON object { ... }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1).trim();
    }

    return trimmed;
  }

  /**
   * Parse full code review response.
   */
  public static parseReviewResponse(
    rawText: string,
    filePath: string,
    providerName: string,
    modelName: string,
    durationMs: number
  ): ReviewResult {
    try {
      const jsonStr = this.extractJson(rawText);
      const parsed = JSON.parse(jsonStr);
      const validated = RawReviewResponseSchema.parse(parsed);

      let criticalCount = 0;
      let warningCount = 0;
      let infoCount = 0;

      const findings: ReviewFinding[] = validated.findings.map((raw, index) => {
        const severity = this.normalizeSeverity(raw.severity);
        const category = this.normalizeCategory(raw.category);
        const line = this.normalizeLineNumber(raw.line);
        const column = typeof raw.column === 'number' ? raw.column : parseInt(String(raw.column), 10) || 1;

        if (severity === 'critical') criticalCount++;
        else if (severity === 'warning') warningCount++;
        else infoCount++;

        return {
          id: `fixora-${Date.now()}-${index + 1}`,
          title: raw.title,
          severity,
          category,
          filePath,
          line,
          column,
          endLine: raw.endLine ? this.normalizeLineNumber(raw.endLine) : undefined,
          endColumn: typeof raw.endColumn === 'number' ? raw.endColumn : undefined,
          explanation: raw.explanation,
          whyItMatters: raw.whyItMatters,
          suggestedSolution: raw.suggestedSolution,
          suggestedFix: raw.suggestedFix,
          originalCodeSnippet: raw.originalCodeSnippet,
          evidence: raw.evidence || raw.originalCodeSnippet,
          confidence: Math.min(1.0, Math.max(0.0, raw.confidence)),
          source: 'ai',
          conceptName: raw.conceptName,
          learningNote: raw.learningNote,
        };
      });

      return {
        summary: validated.summary,
        findings,
        durationMs,
        filesAnalyzed: [filePath],
        providerName,
        modelName,
        timestamp: new Date().toISOString(),
        totalIssues: findings.length,
        criticalCount,
        warningCount,
        infoCount,
      };
    } catch (err: any) {
      this.logger.error('Failed to parse AI review JSON response', err);
      throw new Error(`Invalid response format from AI provider: ${err.message || 'Malformed JSON'}`);
    }
  }

  /**
   * Parse error explanation response.
   */
  public static parseErrorExplanation(rawText: string): ErrorExplanationResult {
    try {
      const jsonStr = this.extractJson(rawText);
      const parsed = JSON.parse(jsonStr);
      const validated = RawErrorExplanationSchema.parse(parsed);

      return {
        whatHappened: validated.whatHappened,
        whyItHappened: validated.whyItHappened,
        rootCause: validated.rootCause,
        howToFix: validated.howToFix,
        correctedCodeSnippet: validated.correctedCodeSnippet,
        explanationOfCorrection: validated.explanationOfCorrection,
        conceptName: validated.conceptName,
        learningTakeaway: validated.learningTakeaway,
        inferredCauses: validated.inferredCauses || [],
        confirmedCauses: validated.confirmedCauses || [],
        relatedReferences: validated.relatedReferences || [],
        suggestedActions: validated.suggestedActions || [],
      };
    } catch (err: any) {
      this.logger.error('Failed to parse AI error explanation JSON response', err);
      // Fallback graceful object if JSON parsing fails
      return {
        whatHappened: rawText.slice(0, 500),
        whyItHappened: 'Could not extract structured JSON from model output.',
        rootCause: 'Unstructured model response.',
        howToFix: 'Please check the model response text directly.',
        explanationOfCorrection: '',
        inferredCauses: ['Model generated unstructured explanation'],
        confirmedCauses: [],
        relatedReferences: [],
        suggestedActions: ['Inspect stack trace and referenced lines'],
      };
    }
  }

  /**
   * Parse fix proposal response.
   */
  public static parseFixResponse(rawText: string): { replacementCode: string; explanation: string } {
    try {
      const jsonStr = this.extractJson(rawText);
      const parsed = JSON.parse(jsonStr);
      const validated = RawFixResponseSchema.parse(parsed);
      return {
        replacementCode: validated.replacementCode,
        explanation: validated.explanation,
      };
    } catch (err: any) {
      this.logger.error('Failed to parse AI fix JSON response', err);
      throw new Error(`Could not parse fix proposal: ${err.message}`);
    }
  }

  /**
   * Normalizes severity strings from various LLM representations.
   */
  public static normalizeSeverity(input: string): ReviewSeverity {
    const s = (input || '').toLowerCase().trim();
    if (['critical', 'fatal', 'error', 'high', 'severe'].includes(s)) return 'critical';
    if (['warning', 'warn', 'medium', 'moderate'].includes(s)) return 'warning';
    if (['hint', 'style', 'suggestion'].includes(s)) return 'hint';
    return 'info';
  }

  /**
   * Normalizes category strings from various LLM representations.
   */
  public static normalizeCategory(input: string): ReviewCategory {
    const c = (input || '').toLowerCase().trim();
    if (['bug', 'defect', 'error', 'runtime'].includes(c)) return 'bug';
    if (['security', 'vulnerability', 'cwe', 'owasp'].includes(c)) return 'security';
    if (['performance', 'optimization', 'speed', 'memory'].includes(c)) return 'performance';
    if (['quality', 'clean-code', 'maintainability', 'refactor'].includes(c)) return 'quality';
    if (['syntax', 'parser'].includes(c)) return 'syntax';
    return 'bug';
  }

  /**
   * Validates and coerces positive integer line number.
   */
  public static normalizeLineNumber(val: number | string): number {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    return isNaN(num) || num < 1 ? 1 : Math.floor(num);
  }
}
