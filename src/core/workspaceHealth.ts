import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ComplexityAnalyzer } from '../metrics/complexityAnalyzer';
import { DependencyAuditor } from '../security/dependencyAuditor';
import { FileUtils } from '../utils/fileUtils';
import { Logger } from '../utils/logger';

export interface ComplexityHotspot {
  functionName: string;
  complexity: number;
  filePath: string;
  line: number;
}

export interface WorkspaceHealthReport {
  score: number;
  rating: 'Excellent' | 'Good' | 'Needs Attention' | 'Critical Issues';
  totalFiles: number;
  diagnostics: {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  };
  complexity: {
    averageCC: number;
    highComplexityFunctionsCount: number;
    hotspots: ComplexityHotspot[];
  };
  security: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
  };
  timestamp: string;
}

/**
 * Computes objective, grounded workspace health metrics and transparent quality scores.
 */
export class WorkspaceHealthService {
  private static instance: WorkspaceHealthService;
  private logger = Logger.getInstance();

  public static getInstance(): WorkspaceHealthService {
    if (!WorkspaceHealthService.instance) {
      WorkspaceHealthService.instance = new WorkspaceHealthService();
    }
    return WorkspaceHealthService.instance;
  }

  /**
   * Scans the active workspace to compile a grounded health report.
   */
  public async computeHealthReport(
    cancellationToken?: vscode.CancellationToken
  ): Promise<WorkspaceHealthReport> {
    const folders = vscode.workspace.workspaceFolders || [];
    let totalFiles = 0;
    const hotspots: ComplexityHotspot[] = [];
    const complexities: number[] = [];

    // 1. Diagnostics distribution from VS Code Problems collection
    const allDiagnostics = vscode.languages.getDiagnostics();
    let errors = 0;
    let warnings = 0;
    let info = 0;
    let hints = 0;

    for (const [_uri, diags] of allDiagnostics) {
      for (const d of diags) {
        if (d.severity === vscode.DiagnosticSeverity.Error) errors++;
        else if (d.severity === vscode.DiagnosticSeverity.Warning) warnings++;
        else if (d.severity === vscode.DiagnosticSeverity.Information) info++;
        else if (d.severity === vscode.DiagnosticSeverity.Hint) hints++;
      }
    }

    // 2. Discover and sample source files for complexity analysis
    for (const folder of folders) {
      const files = this.collectSourceFiles(folder.uri.fsPath);
      totalFiles += files.length;

      // Sample up to 25 code files to keep computation fast
      const sampled = files.slice(0, 25);
      for (const file of sampled) {
        if (cancellationToken?.isCancellationRequested) break;
        try {
          const code = fs.readFileSync(file, 'utf8');
          const ext = path.extname(file).toLowerCase();
          const lang = ext === '.py' ? 'python' : ext === '.java' ? 'java' : 'javascript';
          const metrics = ComplexityAnalyzer.analyze(code, file, lang);

          complexities.push(metrics.cyclomaticComplexity);

          for (const fn of metrics.complexFunctions) {
            complexities.push(fn.complexity);
            if (fn.complexity > 10) {
              hotspots.push({
                functionName: fn.name,
                complexity: fn.complexity,
                filePath: file,
                line: fn.line,
              });
            }
          }
        } catch {
          // ignore unreadable files
        }
      }
    }

    // Sort hotspots descending by complexity
    hotspots.sort((a, b) => b.complexity - a.complexity);

    const averageCC =
      complexities.length > 0
        ? Math.round((complexities.reduce((a, b) => a + b, 0) / complexities.length) * 10) / 10
        : 1.0;

    // 3. Security dependencies audit
    const auditor = DependencyAuditor.getInstance();
    const auditResult = await auditor.auditWorkspace();
    const totalVulnerabilities = auditResult.vulnerabilities.length;
    const criticalVulnerabilities = auditResult.vulnerabilities.filter(
      (v) => v.severity === 'critical' || v.severity === 'high'
    ).length;

    // 4. Score computation with transparent deduction criteria
    let score = 100;
    score -= Math.min(40, errors * 10);
    score -= Math.min(20, warnings * 2);
    score -= Math.min(20, hotspots.filter((h) => h.complexity > 15).length * 5);
    score -= Math.min(30, criticalVulnerabilities * 15);
    score = Math.max(0, Math.min(100, Math.round(score)));

    let rating: WorkspaceHealthReport['rating'] = 'Excellent';
    if (score < 50) rating = 'Critical Issues';
    else if (score < 75) rating = 'Needs Attention';
    else if (score < 90) rating = 'Good';

    return {
      score,
      rating,
      totalFiles,
      diagnostics: { errors, warnings, info, hints },
      complexity: {
        averageCC,
        highComplexityFunctionsCount: hotspots.length,
        hotspots: hotspots.slice(0, 10),
      },
      security: {
        totalVulnerabilities,
        criticalVulnerabilities,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Recursively discovers supported source code files, respecting exclusion patterns.
   */
  private collectSourceFiles(dir: string, maxFiles = 100): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const walk = (currentDir: string) => {
      if (results.length >= maxFiles) return;

      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) break;

          const fullPath = path.join(currentDir, entry.name);
          if (FileUtils.isFileExcluded(fullPath)) continue;

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.php'].includes(ext)) {
              results.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    walk(dir);
    return results;
  }
}
