import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { ReviewEngine } from '../core/reviewEngine';

export function registerReviewSelectionCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.reviewSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Fixora AI: No active editor found. Open a file to review code.');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showInformationMessage('Fixora AI: Please highlight a block of code to review.');
      return;
    }

    logger.info(`Triggered Review Selected Code for ${editor.document.fileName}`);
    const reviewEngine = ReviewEngine.getInstance();
    await reviewEngine.reviewDocument(editor.document, selection);
  });
}
