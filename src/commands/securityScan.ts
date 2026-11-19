import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { SecurityEngine } from '../core/securityEngine';

export function registerSecurityScanCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.securityScan', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Fixora AI: Open a file to run a security scan.');
      return;
    }

    logger.info(`Starting dedicated security audit for ${editor.document.fileName}`);
    const securityEngine = SecurityEngine.getInstance();
    await securityEngine.auditDocument(editor.document);
  });
}
