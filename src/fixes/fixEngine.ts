import * as vscode from 'vscode';
import { AIManager } from '../ai/aiManager';
import { SidebarProvider } from '../providers/sidebarProvider';
import { FixoraDiffContentProvider } from './diffProvider';
import { ReviewFinding } from '../types';
import { Logger } from '../utils/logger';

/**
 * Manages safe code fix generation, diff previewing, and WorkspaceEdit application.
 */
export class FixEngine {
  private static instance: FixEngine;
  private logger = Logger.getInstance();

  private constructor(
    private readonly aiManager: AIManager,
    private readonly sidebarProvider: SidebarProvider
  ) {}

  public static initialize(aiManager: AIManager, sidebarProvider: SidebarProvider): FixEngine {
    if (!FixEngine.instance) {
      FixEngine.instance = new FixEngine(aiManager, sidebarProvider);
    }
    return FixEngine.instance;
  }

  public static getInstance(): FixEngine {
    if (!FixEngine.instance) {
      throw new Error('FixEngine must be initialized before use.');
    }
    return FixEngine.instance;
  }

  /**
   * Previews a suggested fix side-by-side using VS Code diff view.
   */
  public async previewFix(finding: ReviewFinding): Promise<void> {
    const documentUri = vscode.Uri.file(finding.filePath);
    let document: vscode.TextDocument;

    try {
      document = await vscode.workspace.openTextDocument(documentUri);
    } catch {
      vscode.window.showErrorMessage(`Fixora AI: Could not open file ${finding.filePath}`);
      return;
    }

    let fixCode = finding.suggestedFix;
    if (!fixCode) {
      // Generate fix on demand via AI
      const surroundingCode = this.getSurroundingCode(document, finding.line);
      const generated = await this.aiManager.generateFix(finding, surroundingCode);
      fixCode = generated.replacementCode;
      finding.suggestedFix = fixCode;
    }

    if (!fixCode) {
      vscode.window.showWarningMessage('Fixora AI: No code fix available for this finding.');
      return;
    }

    // Build modified text
    const originalText = document.getText();
    const modifiedText = this.computeModifiedText(document, finding.line, fixCode);

    // Register virtual document
    const diffUri = vscode.Uri.parse(
      `${FixoraDiffContentProvider.scheme}:${documentUri.path}?fix=${finding.id}`
    );
    FixoraDiffContentProvider.getInstance().setContent(diffUri, modifiedText);

    // Open side-by-side diff
    await vscode.commands.executeCommand(
      'vscode.diff',
      documentUri,
      diffUri,
      `Fixora AI Fix Preview: ${finding.title}`,
      { preview: true }
    );

    // Prompt user to accept or reject
    const choice = await vscode.window.showInformationMessage(
      `Fixora AI: Accept proposed fix for "${finding.title}"?`,
      'Apply Fix',
      'Discard'
    );

    if (choice === 'Apply Fix') {
      await this.applyFix(finding);
    }
  }

  /**
   * Safely applies a verified fix using the VS Code WorkspaceEdit API.
   */
  public async applyFix(finding: ReviewFinding): Promise<boolean> {
    if (!finding.suggestedFix) {
      vscode.window.showWarningMessage('Fixora AI: No replacement fix found.');
      return false;
    }

    const documentUri = vscode.Uri.file(finding.filePath);
    let document: vscode.TextDocument;

    try {
      document = await vscode.workspace.openTextDocument(documentUri);
    } catch {
      vscode.window.showErrorMessage(`Fixora AI: Could not open file ${finding.filePath}`);
      return false;
    }

    const targetLine = Math.max(0, finding.line - 1);
    if (targetLine >= document.lineCount) {
      vscode.window.showErrorMessage('Fixora AI: File content has changed. Please rerun review before applying fix.');
      return false;
    }

    const lineObj = document.lineAt(targetLine);
    const edit = new vscode.WorkspaceEdit();

    // Target the entire line or endLine range
    const startPos = new vscode.Position(targetLine, 0);
    const endLineNum = finding.endLine ? Math.max(0, finding.endLine - 1) : targetLine;
    const endLineObj = document.lineAt(Math.min(document.lineCount - 1, endLineNum));
    const endPos = endLineObj.range.end;

    edit.replace(documentUri, new vscode.Range(startPos, endPos), finding.suggestedFix);

    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      this.logger.info(`Successfully applied fix for finding: ${finding.id} in ${finding.filePath}`);
      vscode.window.showInformationMessage(`Fixora AI: Fix applied for "${finding.title}".`);
      return true;
    } else {
      vscode.window.showErrorMessage('Fixora AI: Failed to apply code edit.');
      return false;
    }
  }

  /**
   * Helper to replace lines in virtual document.
   */
  private computeModifiedText(document: vscode.TextDocument, line: number, replacement: string): string {
    const lines = document.getText().split(/\r?\n/);
    const targetIdx = Math.max(0, line - 1);
    if (targetIdx < lines.length) {
      lines[targetIdx] = replacement;
    }
    return lines.join('\n');
  }

  private getSurroundingCode(document: vscode.TextDocument, line: number): string {
    const targetLine = Math.max(0, line - 1);
    const start = Math.max(0, targetLine - 5);
    const end = Math.min(document.lineCount - 1, targetLine + 5);
    const range = new vscode.Range(start, 0, end, document.lineAt(end).text.length);
    return document.getText(range);
  }
}
