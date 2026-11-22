import { AIAnalysisOptions, ErrorExplanationOptions, ReviewFinding } from '../types';

/**
 * Manages specialized prompts for Google Gemini and other AI providers.
 * Enforces structured JSON responses across all review tasks.
 */
export class PromptManager {
  /**
   * Base system instructions ensuring reliable, parseable output.
   */
  public static getSystemInstruction(learningMode = false): string {
    return `You are Fixora AI, a world-class senior software architect, compiler engineer, and security auditor.
Your job is to analyze source code, find real bugs, detect security risks, optimize performance, and explain errors.

STRICT OPERATIONAL RULES:
1. Always return strictly valid JSON matching the requested schema. Never output markdown prose outside the JSON object.
2. Only report genuine issues with high confidence. Do not invent line numbers or fabricate imaginary bugs.
3. Keep line numbers accurate according to the provided code (1-indexed).
4. Categorize severities strictly as: "critical", "warning", "info", or "hint".
5. Categorize issue types strictly as: "bug", "security", "performance", "quality", or "syntax".
6. When suggesting code fixes, provide clean, idiomatic, and syntactically correct code.
${
  learningMode
    ? `7. LEARNING MODE IS ENABLED: Explain concepts in beginner-friendly, educational terms. Explain why the bug happened, what principle applies, and provide a small illustrative concept example.`
    : `7. Provide concise, professional, production-grade recommendations.`
}`;
  }

  /**
   * Build comprehensive code review prompt.
   */
  public static buildReviewPrompt(options: AIAnalysisOptions): string {
    const { code, filePath, languageId, learningMode, staticFindings } = options;

    let staticContext = '';
    if (staticFindings && staticFindings.length > 0) {
      staticContext = `\nDeterministic Static Linter Findings (Reference only):\n${JSON.stringify(
        staticFindings.map((f) => ({
          line: f.line,
          title: f.title,
          severity: f.severity,
          source: f.source,
        })),
        null,
        2
      )}\n`;
    }

    return `Analyze the following ${languageId} code from file "${filePath}".
${staticContext}
CODE TO ANALYZE:
\`\`\`${languageId}
${code}
\`\`\`

Return a JSON object with this EXACT structure:
{
  "summary": "Brief 1-2 sentence overview of the code quality and findings",
  "findings": [
    {
      "title": "Concise issue description",
      "severity": "critical" | "warning" | "info" | "hint",
      "category": "bug" | "security" | "performance" | "quality" | "syntax",
      "line": 1,
      "column": 1,
      "explanation": "Detailed explanation of what is wrong",
      "whyItMatters": "Impact if not resolved (e.g. crash, security exploit, data leak)",
      "suggestedSolution": "How the developer should fix it",
      "suggestedFix": "Corrected code snippet replacement (if applicable)",
      "confidence": 0.95,
      ${learningMode ? `"conceptName": "Name of programming concept (e.g. Null Safety, Asynchronous Flow)",\n      "learningNote": "Beginner-friendly explanation and takeaway"` : ''}
    }
  ]
}`;
  }

  /**
   * Build error explanation prompt.
   */
  public static buildErrorExplanationPrompt(options: ErrorExplanationOptions): string {
    const { errorMessage, codeSnippet, filePath, line, stackTrace, languageId, learningMode } = options;

    return `Explain this error encountered by a developer:
ERROR MESSAGE:
${errorMessage}

${stackTrace ? `STACK TRACE:\n${stackTrace}\n` : ''}
${filePath ? `FILE: ${filePath} (line ${line || 'unknown'})\n` : ''}
${codeSnippet ? `RELEVANT CODE (${languageId || 'code'}):\n\`\`\`\n${codeSnippet}\n\`\`\`\n` : ''}

Respond with a JSON object with this EXACT structure:
{
  "whatHappened": "Plain English explanation of what the error means",
  "whyItHappened": "Explanation of what condition triggered this error",
  "rootCause": "The underlying technical root cause in the code",
  "howToFix": "Step-by-step actionable instructions to resolve it",
  "correctedCodeSnippet": "The corrected code replacement (if code context was provided)",
  "explanationOfCorrection": "Why this specific fix resolves the problem",
  "conceptName": "Relevant programming concept or error category",
  "learningTakeaway": "${learningMode ? 'Beginner-friendly lesson explaining how to avoid this error in the future' : 'Key takeaway for developers'}"
}`;
  }

  /**
   * Build fix generation prompt.
   */
  public static buildFixPrompt(finding: ReviewFinding, surroundingCode: string): string {
    return `Generate a precise, safe code fix for this issue in ${finding.filePath}:
ISSUE: ${finding.title}
SEVERITY: ${finding.severity}
EXPLANATION: ${finding.explanation}
LINE: ${finding.line}

SURROUNDING CODE CONTEXT:
\`\`\`
${surroundingCode}
\`\`\`

Return a JSON object with this EXACT structure:
{
  "replacementCode": "The exact replacement code snippet that fixes line ${finding.line}",
  "explanation": "Brief explanation of how the replacement code fixes the issue without breaking surrounding logic"
}`;
  }

  /**
   * Build focused security audit prompt.
   */
  public static buildSecurityPrompt(options: AIAnalysisOptions): string {
    return `Perform a dedicated SECURITY AUDIT on this ${options.languageId} code from "${options.filePath}".
Focus on OWASP Top 10 vulnerabilities, including:
- SQL / NoSQL Injection
- Cross-Site Scripting (XSS)
- Command Injection
- Path Traversal
- Hardcoded Credentials / Exposed Secrets
- Insecure Deserialization
- Insecure Cryptographic Practices
- Missing Authorization / Authentication Flaws

CODE TO AUDIT:
\`\`\`${options.languageId}
${options.code}
\`\`\`

Return a JSON object with this EXACT structure:
{
  "summary": "Summary of security posture and identified risks",
  "findings": [
    {
      "title": "Vulnerability title",
      "severity": "critical" | "warning" | "info",
      "category": "security",
      "line": 1,
      "column": 1,
      "explanation": "Detailed vulnerability breakdown",
      "whyItMatters": "Exploit scenario and potential damage",
      "suggestedSolution": "Remediation guidance using defense-in-depth",
      "suggestedFix": "Patched code snippet",
      "confidence": 0.95
    }
  ]
}`;
  }

  /**
   * Build focused performance analysis prompt.
   */
  public static buildPerformancePrompt(options: AIAnalysisOptions): string {
    return `Perform a dedicated PERFORMANCE REVIEW on this ${options.languageId} code from "${options.filePath}".
Focus on:
- Algorithmic complexity bottlenecks (e.g. O(n^2) nested loops that can be O(n))
- Redundant or repeated computations
- N+1 database queries
- Unnecessary object allocations / memory leaks
- React unnecessary re-renders / missing memoization
- Blocking synchronous operations

CODE TO REVIEW:
\`\`\`${options.languageId}
${options.code}
\`\`\`

Return a JSON object with this EXACT structure:
{
  "summary": "Summary of performance bottlenecks and efficiency",
  "findings": [
    {
      "title": "Performance bottleneck title",
      "severity": "warning" | "info" | "hint",
      "category": "performance",
      "line": 1,
      "column": 1,
      "explanation": "What causes the performance degradation",
      "whyItMatters": "Resource impact (CPU, Memory, Network latency, FPS)",
      "suggestedSolution": "Optimized algorithmic approach",
      "suggestedFix": "Optimized code snippet",
      "confidence": 0.9
    }
  ]
}`;
  }

  /**
   * Build prompt for unit test generation.
   */
  public static buildTestGenerationPrompt(
    code: string,
    filePath: string,
    languageId: string,
    testFramework: string
  ): string {
    return `Generate high-coverage unit tests for the following ${languageId} code from "${filePath}".
Target Testing Framework: ${testFramework}.

CODE TO TEST:
\`\`\`${languageId}
${code}
\`\`\`

REQUIREMENTS:
1. Cover happy paths, edge cases, error conditions, and null/undefined handling.
2. Follow ${testFramework} best practices and modern assertion syntax.
3. Mock external I/O, network requests, or database calls where appropriate.
4. Provide clean, self-contained test code that is ready to run.

Return a JSON object with this EXACT structure:
{
  "framework": "${testFramework}",
  "testCode": "Full runnable test file code as a single string",
  "testFilePath": "Suggested relative file path for this test file (e.g. test/unit/... or tests/...)",
  "dependenciesNeeded": ["list of npm packages or test runners needed"],
  "testCasesSummary": [
    "Test case 1 description",
    "Test case 2 description"
  ]
}`;
  }
}
