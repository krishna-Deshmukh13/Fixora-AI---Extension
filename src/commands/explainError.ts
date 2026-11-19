import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { DebuggerEngine } from '../core/debuggerEngine';

export function registerExplainErrorCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.explainError', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Fixora AI: No active editor found. Open a file with an error to explain.');
      return;
    }

    const debuggerEngine = DebuggerEngine.getInstance();
    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection).trim();

    // Case 1: User explicitly highlighted error text in the editor
    if (selectedText.length > 0) {
      logger.info(`Explaining highlighted error text: "${selectedText.slice(0, 60)}..."`);
      await debuggerEngine.explainCustomError(
        selectedText,
        document.getText(),
        document.fileName,
        selection.start.line + 1,
        document.languageId
      );
      return;
    }

    // Case 2: Cursor is positioned over a diagnostic squiggly line
    const position = selection.active;
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const activeDiag = diagnostics.find((d) => d.range.contains(position));

    if (activeDiag) {
      logger.info(`Explaining diagnostic under cursor at line ${activeDiag.range.start.line + 1}: "${activeDiag.message}"`);
      await debuggerEngine.explainDiagnostic(document, activeDiag);
      return;
    }

    // Case 3: No diagnostic at cursor, but diagnostics exist in document
    if (diagnostics.length > 0) {
      // Pick the first diagnostic in the document
      const firstDiag = diagnostics[0];
      logger.info(`Explaining first diagnostic in document at line ${firstDiag.range.start.line + 1}: "${firstDiag.message}"`);
      await debuggerEngine.explainDiagnostic(document, firstDiag);
      return;
    }

    // Case 4: No error found
    vscode.window.showInformationMessage(
      'Fixora AI: No active error found at cursor. Highlight an error message or run "Fixora AI: Explain Terminal Error" to paste compiler output.'
    );
  });
}
