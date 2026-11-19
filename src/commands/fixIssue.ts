import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { FixEngine } from '../fixes/fixEngine';
import { DiagnosticManager } from '../diagnostics/diagnosticManager';

export function registerFixIssueCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.fixIssue', async (findingId?: string) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Fixora AI: Open a file with a finding to apply a fix.');
      return;
    }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const diagManager = DiagnosticManager.getInstance();

    // Find diagnostic matching cursor or requested findingId
    let targetFinding = undefined;
    for (const diag of diagnostics) {
      const finding = diagManager.getFinding(editor.document.uri, diag);
      if (finding && (!findingId || finding.id === findingId)) {
        targetFinding = finding;
        break;
      }
    }

    if (!targetFinding) {
      vscode.window.showInformationMessage('Fixora AI: No fixable Fixora issue found at cursor.');
      return;
    }

    logger.info(`Initiating fix preview for ${targetFinding.id}`);
    const fixEngine = FixEngine.getInstance();
    await fixEngine.previewFix(targetFinding);
  });
}
