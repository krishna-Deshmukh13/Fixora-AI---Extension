import * as vscode from 'vscode';
import { DiagnosticManager } from './diagnosticManager';
import { BRANDING } from '../constants/branding';

/**
 * Provides Quick Fix actions (Lightbulb menu) in the VS Code editor for Revion findings.
 */
export class FixoraCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const diagnosticManager = DiagnosticManager.getInstance();

    // Filter for diagnostics that belong to Revion or legacy Fixora AI
    const revionDiagnostics = context.diagnostics.filter(
      (d) => d.source === BRANDING.PRODUCT_NAME || d.source === 'Fixora AI'
    );

    for (const diagnostic of revionDiagnostics) {
      const finding = diagnosticManager.getFinding(document.uri, diagnostic);

      // 1. Quick Fix: Apply Suggested Fix (if replacement code is available)
      if (finding && finding.suggestedFix) {
        const fixAction = new vscode.CodeAction(
          `Fix with ${BRANDING.PRODUCT_NAME}: ${finding.title}`,
          vscode.CodeActionKind.QuickFix
        );

        const edit = new vscode.WorkspaceEdit();
        // Determine replacement range: if line replacement, target entire line
        const line = document.lineAt(diagnostic.range.start.line);
        const replaceRange = line ? line.range : diagnostic.range;

        edit.replace(document.uri, replaceRange, finding.suggestedFix);
        fixAction.edit = edit;
        fixAction.isPreferred = true;
        fixAction.diagnostics = [diagnostic];

        actions.push(fixAction);
      }

      // 2. Quick Action: Explain Issue with Revion
      const explainAction = new vscode.CodeAction(
        `Explain Issue with ${BRANDING.PRODUCT_NAME}: ${diagnostic.message.split(':')[0]}`,
        vscode.CodeActionKind.QuickFix
      );
      explainAction.command = {
        title: `Explain with ${BRANDING.PRODUCT_NAME}`,
        command: 'fixora.explainError',
      };
      explainAction.diagnostics = [diagnostic];
      actions.push(explainAction);
    }

    // 3. Quick Action: Open Dashboard / Assistant
    if (revionDiagnostics.length > 0) {
      const dashboardAction = new vscode.CodeAction(
        `Open ${BRANDING.PRODUCT_NAME} Assistant`,
        vscode.CodeActionKind.QuickFix
      );
      dashboardAction.command = {
        title: 'Open Assistant',
        command: 'fixora.openDashboard',
      };
      actions.push(dashboardAction);
    }

    return actions;
  }
}
