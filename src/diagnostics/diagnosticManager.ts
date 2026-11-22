import * as vscode from 'vscode';
import { ReviewFinding, ReviewSeverity } from '../types';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';

/**
 * Manages the VS Code Problems panel diagnostics for Revion.
 * Features deduplication, range clamping, and contextual hover documentation.
 */
export class DiagnosticManager implements vscode.HoverProvider {
  private static instance: DiagnosticManager;
  private collection: vscode.DiagnosticCollection;
  private findingMap = new Map<string, ReviewFinding>();
  private logger = Logger.getInstance();
  private hoverDisposable?: vscode.Disposable;

  private constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(BRANDING.PRODUCT_NAME);
    this.hoverDisposable = vscode.languages.registerHoverProvider({ scheme: 'file' }, this);
  }

  public static getInstance(): DiagnosticManager {
    if (!DiagnosticManager.instance) {
      DiagnosticManager.instance = new DiagnosticManager();
    }
    return DiagnosticManager.instance;
  }

  /**
   * Converts findings into VS Code Problem diagnostics, deduplicates, and publishes them.
   */
  public publishFindings(uri: vscode.Uri, findings: ReviewFinding[]): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const seen = new Set<string>();

    for (const finding of findings) {
      const startLine = Math.max(0, (finding.line || 1) - 1);
      const startCol = Math.max(0, (finding.column || 1) - 1);
      const endLine = finding.endLine ? Math.max(0, finding.endLine - 1) : startLine;
      const endCol = finding.endColumn ? Math.max(0, finding.endColumn - 1) : Math.max(startCol + 1, 200);

      // Deduplication check
      const dedupKey = `${startLine}:${startCol}:${finding.category}:${finding.title}`;
      if (seen.has(dedupKey)) {
        continue;
      }
      seen.add(dedupKey);

      const range = new vscode.Range(
        new vscode.Position(startLine, startCol),
        new vscode.Position(endLine, endCol)
      );

      const severity = this.mapSeverity(finding.severity);
      const diagnostic = new vscode.Diagnostic(
        range,
        `${finding.title}: ${finding.explanation}`,
        severity
      );

      diagnostic.source = BRANDING.PRODUCT_NAME;
      diagnostic.code = `REVION-${finding.category.toUpperCase()}`;

      // Associate finding for Quick Fix & Hover lookup
      const key = this.getDiagnosticKey(uri, diagnostic);
      this.findingMap.set(key, finding);

      diagnostics.push(diagnostic);
    }

    this.collection.set(uri, diagnostics);
    this.logger.info(`Published ${diagnostics.length} diagnostics for ${uri.fsPath}`);
  }

  /**
   * HoverProvider implementation: provides rich markdown details for Revion Problem diagnostics.
   */
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    const diags = vscode.languages.getDiagnostics(document.uri);
    const revionDiag = diags.find(
      (d) => d.range.contains(position) && (d.source === BRANDING.PRODUCT_NAME || d.source === 'Fixora AI')
    );

    if (!revionDiag) {
      return null;
    }

    const finding = this.getFinding(document.uri, revionDiag);
    if (!finding) {
      return null;
    }

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`### 🔍 ${BRANDING.PRODUCT_NAME}: ${finding.title}\n`);
    md.appendMarkdown(`**Category**: \`${finding.category}\` &bull; **Severity**: \`${finding.severity.toUpperCase()}\` &bull; **Source**: \`${finding.source}\`\n\n`);
    md.appendMarkdown(`${finding.explanation}\n\n`);

    if (finding.whyItMatters) {
      md.appendMarkdown(`> **Why it matters:** ${finding.whyItMatters}\n\n`);
    }

    if (finding.suggestedSolution) {
      md.appendMarkdown(`💡 **Suggested Solution:** ${finding.suggestedSolution}\n\n`);
    }

    md.appendMarkdown(`---\n`);
    md.appendMarkdown(`[Explain Error](command:fixora.explainError) &bull; [Open Assistant](command:fixora.openDashboard)`);

    return new vscode.Hover(md, revionDiag.range);
  }

  /**
   * Retrieves the stored ReviewFinding associated with a specific diagnostic.
   */
  public getFinding(uri: vscode.Uri, diagnostic: vscode.Diagnostic): ReviewFinding | undefined {
    const key = this.getDiagnosticKey(uri, diagnostic);
    return this.findingMap.get(key);
  }

  /**
   * Clears all published diagnostics across the workspace.
   */
  public clearDiagnostics(): void {
    this.collection.clear();
    this.findingMap.clear();
    this.logger.info(`Cleared all ${BRANDING.PRODUCT_NAME} diagnostics.`);
  }

  /**
   * Clears diagnostics for a specific file URI.
   */
  public clearForUri(uri: vscode.Uri): void {
    this.collection.delete(uri);
    const prefix = uri.toString() + ':';
    for (const key of Array.from(this.findingMap.keys())) {
      if (key.startsWith(prefix)) {
        this.findingMap.delete(key);
      }
    }
  }

  public dispose(): void {
    if (this.hoverDisposable) {
      this.hoverDisposable.dispose();
    }
    this.collection.dispose();
  }

  private mapSeverity(severity: ReviewSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      case 'hint':
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Warning;
    }
  }

  private getDiagnosticKey(uri: vscode.Uri, diagnostic: vscode.Diagnostic): string {
    return `${uri.fsPath}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`;
  }
}
