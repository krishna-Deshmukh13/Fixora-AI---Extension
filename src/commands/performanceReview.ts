import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { PerformanceEngine } from '../core/performanceEngine';

export function registerPerformanceReviewCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.performanceReview', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Fixora AI: Open a file to analyze performance.');
      return;
    }

    logger.info(`Starting dedicated performance review for ${editor.document.fileName}`);
    const performanceEngine = PerformanceEngine.getInstance();
    await performanceEngine.auditDocument(editor.document);
  });
}
