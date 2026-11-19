import * as vscode from 'vscode';
import { ReviewFinding, ReviewSeverity } from '../types';
import { Logger } from '../utils/logger';

/**
 * Manages the VS Code Problems panel diagnostics for Fixora AI.
 */
export class DiagnosticManager {
  private static instance: DiagnosticManager;
  private collection: vscode.DiagnosticCollection;
  private findingMap = new Map<string, ReviewFinding>();
  private logger = Logger.getInstance();

  private constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('Fixora AI');
  }

  public static getInstance(): DiagnosticManager {
    if (!DiagnosticManager.instance) {
      DiagnosticManager.instance = new DiagnosticManager();
    }
    return DiagnosticManager.instance;
  }

  /**
   * Converts findings into VS Code Problem diagnostics and publishes them.
   */
  public publishFindings(uri: vscode.Uri, findings: ReviewFinding[]): void {
    const diagnostics: vscode.Diagnostic[] = [];

    for (const finding of findings) {
      const startLine = Math.max(0, finding.line - 1);
      const startCol = Math.max(0, (finding.column || 1) - 1);
      const endLine = finding.endLine ? Math.max(0, finding.endLine - 1) : startLine;
      const endCol = finding.endColumn ? Math.max(0, finding.endColumn - 1) : 200;

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

      diagnostic.source = 'Fixora AI';
      diagnostic.code = `FIXORA-${finding.category.toUpperCase()}`;

      // Associate finding for Quick Fix lookup
      const key = this.getDiagnosticKey(uri, diagnostic);
      this.findingMap.set(key, finding);

      diagnostics.push(diagnostic);
    }

    this.collection.set(uri, diagnostics);
    this.logger.info(`Published ${diagnostics.length} diagnostics for ${uri.fsPath}`);
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
    this.logger.info('Cleared all Fixora AI diagnostics.');
  }

  /**
   * Clears diagnostics for a specific file URI.
   */
  public clearForUri(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  public dispose(): void {
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
