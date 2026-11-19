import * as vscode from 'vscode';
import { AIManager } from '../ai/aiManager';
import { SidebarProvider } from '../providers/sidebarProvider';
import { DiagnosticManager } from '../diagnostics/diagnosticManager';
import { LanguageDetector } from '../utils/languageDetector';
import { FileUtils } from '../utils/fileUtils';
import { ReviewFinding, ReviewResult } from '../types';
import { Logger } from '../utils/logger';

/**
 * Dedicated performance engine that identifies algorithmic bottlenecks, memory retention risks,
 * N+1 database queries, and unnecessary rendering cycles.
 */
export class PerformanceEngine {
  private static instance: PerformanceEngine;
  private logger = Logger.getInstance();

  private constructor(
    private readonly aiManager: AIManager,
    private readonly sidebarProvider: SidebarProvider
  ) {}

  public static initialize(aiManager: AIManager, sidebarProvider: SidebarProvider): PerformanceEngine {
    if (!PerformanceEngine.instance) {
      PerformanceEngine.instance = new PerformanceEngine(aiManager, sidebarProvider);
    }
    return PerformanceEngine.instance;
  }

  public static getInstance(): PerformanceEngine {
    if (!PerformanceEngine.instance) {
      throw new Error('PerformanceEngine must be initialized before use.');
    }
    return PerformanceEngine.instance;
  }

  /**
   * Conducts an in-depth performance analysis on the provided document.
   */
  public async auditDocument(document: vscode.TextDocument): Promise<ReviewResult | null> {
    const filePath = document.fileName;

    if (FileUtils.isFileExcluded(filePath)) {
      vscode.window.showInformationMessage('Fixora AI: File is excluded from performance reviews by configuration.');
      return null;
    }

    const code = document.getText();
    if (!code || code.trim().length === 0) {
      vscode.window.showWarningMessage('Fixora AI: Document is empty.');
      return null;
    }

    const langInfo = LanguageDetector.detect(filePath, document.languageId, code);
    this.logger.info(`Starting dedicated performance review on ${filePath} (${langInfo.name})`);

    const isConfigured = await this.aiManager.isConfigured();
    if (!isConfigured) {
      const action = await vscode.window.showWarningMessage(
        'Fixora AI requires a Gemini API Key for deep performance analysis.',
        'Configure API Key'
      );
      if (action === 'Configure API Key') {
        await vscode.commands.executeCommand('fixora.configureApiKey');
      }
      return null;
    }

    const config = vscode.workspace.getConfiguration('fixora');
    const learningMode = config.get<boolean>('enableLearningMode', false);

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fixora AI: Performance Review (${document.fileName.split(/[\\/]/).pop()})`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ message: 'Analyzing algorithmic complexity and resource usage...' });
        this.sidebarProvider.broadcastState(true, 'Analyzing code performance...');

        try {
          // 1. Run local deterministic performance heuristic checks
          const staticPerfFindings = this.runDeterministicPerformanceChecks(code, filePath, langInfo.id);

          // 2. Run AI performance review
          const aiResult = await this.aiManager.reviewPerformance(
            {
              code,
              filePath,
              languageId: langInfo.id,
              learningMode,
            },
            token
          );

          // 3. Merge findings
          const mergedFindings = this.mergePerformanceFindings(staticPerfFindings, aiResult.findings);

          const criticalCount = mergedFindings.filter((f) => f.severity === 'critical').length;
          const warningCount = mergedFindings.filter((f) => f.severity === 'warning').length;
          const infoCount = mergedFindings.filter((f) => f.severity === 'info' || f.severity === 'hint').length;

          const result: ReviewResult = {
            summary: aiResult.summary,
            findings: mergedFindings,
            durationMs: aiResult.durationMs,
            filesAnalyzed: [filePath],
            providerName: aiResult.providerName,
            modelName: aiResult.modelName,
            timestamp: new Date().toISOString(),
            totalIssues: mergedFindings.length,
            criticalCount,
            warningCount,
            infoCount,
          };

          // 4. Publish findings to sidebar and Problems panel
          this.sidebarProvider.displayReviewResult(result);
          DiagnosticManager.getInstance().publishFindings(document.uri, result.findings);

          const summaryText =
            result.totalIssues === 0
              ? 'No performance bottlenecks detected!'
              : `Found ${result.totalIssues} performance optimization opportunit${result.totalIssues > 1 ? 'ies' : 'y'}.`;

          vscode.window.showInformationMessage(`Fixora AI: Performance review finished. ${summaryText}`);
          return result;
        } catch (err: any) {
          if (token.isCancellationRequested) {
            this.sidebarProvider.broadcastState(false);
            return null;
          }

          const msg = err?.message || 'Performance review failed.';
          this.sidebarProvider.displayError(msg);
          vscode.window.showErrorMessage(`Fixora AI: ${msg}`);
          return null;
        }
      }
    );
  }

  /**
   * Deterministic checks for common resource leaks and computational bottlenecks.
   */
  public runDeterministicPerformanceChecks(
    code: string,
    filePath: string,
    languageId: string
  ): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = code.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNumber = i + 1;

      // 1. Synchronous I/O in Node.js server context
      if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
        if (/fs\.(?:readFileSync|writeFileSync|appendFileSync|existsSync)\s*\(/.test(lineText)) {
          findings.push({
            id: `perf-sync-io-${lineNumber}`,
            title: 'Blocking Synchronous File I/O',
            severity: 'warning',
            category: 'performance',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('fs.') + 1,
            explanation: 'Synchronous fs methods block the Node.js event loop, stalling all concurrent HTTP requests and async tasks.',
            whyItMatters: 'Drastically reduces server throughput and degrades response times under concurrent load.',
            suggestedSolution: 'Replace with non-blocking async promises: import fs from "fs/promises" and use await fs.readFile().',
            confidence: 0.95,
            source: 'static',
            conceptName: 'Non-blocking Asynchronous I/O',
          });
        }
      }

      // 2. Accumulator spread in reduce creates O(n^2) allocations
      if (['javascript', 'typescript'].includes(languageId)) {
        if (/\.reduce\s*\([\s\S]*?\[\s*\.\.\.\w+/.test(lineText)) {
          findings.push({
            id: `perf-reduce-spread-${lineNumber}`,
            title: 'Quadratic Spread in Array Reduce',
            severity: 'warning',
            category: 'performance',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('.reduce') + 1,
            explanation: 'Spreading an accumulator array inside reduce creates an O(n^2) time complexity and massive GC memory churn.',
            whyItMatters: 'Copies the entire array on every iteration; performance degrades sharply on arrays with >1000 items.',
            suggestedSolution: 'Mutate the accumulator with acc.push(item) or use a standard for...of loop.',
            confidence: 0.96,
            source: 'static',
            conceptName: 'Algorithmic Complexity & Garbage Collection',
          });
        }
      }

      // 3. SQL: SELECT * on unconstrained queries
      if (languageId === 'sql' || /SELECT\s+\*\s+FROM/i.test(lineText)) {
        if (/SELECT\s+\*\s+FROM\s+\w+\s*;?$/i.test(lineText.trim())) {
          findings.push({
            id: `perf-sql-select-all-${lineNumber}`,
            title: 'Unbounded SELECT * Query',
            severity: 'warning',
            category: 'performance',
            filePath,
            line: lineNumber,
            column: lineText.search(/SELECT/i) + 1,
            explanation: 'SELECT * retrieves all table columns without a LIMIT or WHERE clause, triggering a full table scan.',
            whyItMatters: 'Exhausts database memory and transfers unnecessary network payload.',
            suggestedSolution: 'Specify only the required column names and append a LIMIT clause.',
            confidence: 0.92,
            source: 'static',
            conceptName: 'Database Indexing & Query Optimization',
          });
        }
      }

      // 4. React inline object in JSX style prop causing re-renders
      if (['javascriptreact', 'typescriptreact'].includes(languageId)) {
        if (/style\s*=\s*\{\s*\{/.test(lineText)) {
          findings.push({
            id: `perf-react-inline-style-${lineNumber}`,
            title: 'React Inline Object in Style Prop',
            severity: 'hint',
            category: 'performance',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('style=') + 1,
            explanation: 'Inline object literal in JSX creates a new object instance on every render pass, defeating React.memo.',
            whyItMatters: 'Forces unnecessary child component re-renders.',
            suggestedSolution: 'Extract the style object outside the component or memoize with useMemo.',
            confidence: 0.88,
            source: 'static',
            conceptName: 'React Render Optimization',
          });
        }
      }
    }

    return findings;
  }

  private mergePerformanceFindings(
    staticFindings: ReviewFinding[],
    aiFindings: ReviewFinding[]
  ): ReviewFinding[] {
    const merged: ReviewFinding[] = [...staticFindings];
    const coveredLines = new Set(staticFindings.map((f) => f.line));

    for (const aiFinding of aiFindings) {
      if (coveredLines.has(aiFinding.line)) {
        const existing = merged.find((f) => f.line === aiFinding.line);
        if (existing) {
          existing.source = 'combined';
          existing.confidence = 1.0;
        }
      } else {
        merged.push({ ...aiFinding, category: 'performance' });
        coveredLines.add(aiFinding.line);
      }
    }

    return merged.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return a.line - b.line;
    });
  }
}
