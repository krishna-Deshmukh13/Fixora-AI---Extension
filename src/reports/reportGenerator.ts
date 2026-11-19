import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ReviewResult } from '../types';
import { Logger } from '../utils/logger';

/**
 * Generates beautiful, self-contained offline HTML audit reports.
 */
export class ReportGenerator {
  private static logger = Logger.getInstance();

  /**
   * Generates and saves an offline HTML report for a ReviewResult.
   */
  public static async exportHtmlReport(result: ReviewResult): Promise<string | null> {
    const folders = vscode.workspace.workspaceFolders;
    const defaultDir = folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `fixora-report-${timestamp}.html`;
    const outputPath = path.join(defaultDir, fileName);

    const findingsHtml = result.findings
      .map(
        (f) => `
        <div class="card severity-${f.severity}">
          <div class="card-header">
            <span class="badge badge-${f.severity}">${f.severity.toUpperCase()}</span>
            <span class="badge badge-source">${f.source.toUpperCase()}</span>
            <strong>${this.escapeHtml(f.title)}</strong>
          </div>
          <div class="card-meta">
            <span>📍 ${this.escapeHtml(f.filePath)}:<strong>${f.line}</strong></span>
            <span>Category: ${f.category}</span>
          </div>
          <p class="explanation">${this.escapeHtml(f.explanation)}</p>
          <div class="why-matters"><strong>Why it matters:</strong> ${this.escapeHtml(f.whyItMatters)}</div>
          <div class="solution"><strong>Suggested Solution:</strong> ${this.escapeHtml(f.suggestedSolution)}</div>
          ${
            f.suggestedFix
              ? `<pre class="code-box"><code>${this.escapeHtml(f.suggestedFix)}</code></pre>`
              : ''
          }
        </div>
      `
      )
      .join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fixora AI Code Quality Audit Report</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --critical: #ef4444;
      --warning: #f59e0b;
      --info: #3b82f6;
      --border: #334155;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 40px;
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    h1 { margin: 0 0 8px 0; color: #38bdf8; font-size: 28px; }
    .subtitle { color: var(--text-muted); font-size: 14px; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .metric-value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
    .metric-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      border-left: 4px solid var(--info);
    }
    .card.severity-critical { border-left-color: var(--critical); }
    .card.severity-warning { border-left-color: var(--warning); }
    .card.severity-info { border-left-color: var(--info); }
    .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-critical { background: #7f1d1d; color: #fca5a5; }
    .badge-warning { background: #78350f; color: #fde68a; }
    .badge-info { background: #1e3a8a; color: #93c5fd; }
    .badge-source { background: #334155; color: #e2e8f0; }
    .card-meta { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; display: flex; gap: 20px; }
    .why-matters, .solution { margin-top: 8px; font-size: 14px; }
    .code-box {
      background: #020617;
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: Consolas, monospace;
      font-size: 13px;
      color: #38bdf8;
      margin-top: 12px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Fixora AI: Code Quality Audit Report</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()} | Provider: ${result.providerName} | Model: ${result.modelName}</div>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value" style="color: #38bdf8;">${result.totalIssues}</div>
      <div class="metric-label">Total Issues</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: var(--critical);">${result.criticalCount}</div>
      <div class="metric-label">Critical</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: var(--warning);">${result.warningCount}</div>
      <div class="metric-label">Warnings</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: var(--info);">${result.infoCount}</div>
      <div class="metric-label">Quality & Hints</div>
    </div>
  </div>

  <h2>Audit Findings (${result.findings.length})</h2>
  ${findingsHtml.length > 0 ? findingsHtml : '<p>No issues found. Your code is clean!</p>'}

  <div class="footer">
    Generated by <strong>Fixora AI</strong> &bull; Fixora.foundation &bull; Find Bugs. Understand Errors. Fix Code. Build Better.
  </div>
</body>
</html>`;

    try {
      fs.writeFileSync(outputPath, htmlContent, 'utf8');
      ReportGenerator.logger.info(`Generated HTML audit report at ${outputPath}`);

      // Open in default browser
      vscode.env.openExternal(vscode.Uri.file(outputPath));
      vscode.window.showInformationMessage(`Fixora AI: Audit report saved to ${fileName}!`);
      return outputPath;
    } catch (err: any) {
      ReportGenerator.logger.error('Failed to export HTML report', err);
      vscode.window.showErrorMessage(`Fixora AI: Could not save report: ${err?.message || err}`);
      return null;
    }
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
