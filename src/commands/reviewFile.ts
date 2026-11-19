import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { ReviewEngine } from '../core/reviewEngine';

export function registerReviewFileCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.reviewFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Fixora AI: No active editor found. Open a file to review.');
      return;
    }

    logger.info(`Triggered Review Current File for ${editor.document.fileName}`);
    const reviewEngine = ReviewEngine.getInstance();
    await reviewEngine.reviewDocument(editor.document);
  });
}
