import * as vscode from 'vscode';
import { DiagnosticManager } from './diagnosticManager';

/**
 * Provides Quick Fix actions (Lightbulb menu) in the VS Code editor for Fixora findings.
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

    // Filter for diagnostics that belong to Fixora AI
    const fixoraDiagnostics = context.diagnostics.filter(
      (d) => d.source === 'Fixora AI'
    );

    for (const diagnostic of fixoraDiagnostics) {
      const finding = diagnosticManager.getFinding(document.uri, diagnostic);

      // 1. Quick Fix: Apply Suggested Fix (if replacement code is available)
      if (finding && finding.suggestedFix) {
        const fixAction = new vscode.CodeAction(
          `Fix with Fixora AI: ${finding.title}`,
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

      // 2. Quick Action: Explain Issue with Fixora AI
      const explainAction = new vscode.CodeAction(
        `Explain Issue with Fixora AI: ${diagnostic.message.split(':')[0]}`,
        vscode.CodeActionKind.QuickFix
      );
      explainAction.command = {
        title: 'Explain with Fixora AI',
        command: 'fixora.explainError',
      };
      explainAction.diagnostics = [diagnostic];
      actions.push(explainAction);
    }

    // 3. Quick Action: Open Dashboard
    if (fixoraDiagnostics.length > 0) {
      const dashboardAction = new vscode.CodeAction(
        'Open Fixora AI Dashboard',
        vscode.CodeActionKind.QuickFix
      );
      dashboardAction.command = {
        title: 'Open Dashboard',
        command: 'fixora.openDashboard',
      };
      actions.push(dashboardAction);
    }

    return actions;
  }
}
