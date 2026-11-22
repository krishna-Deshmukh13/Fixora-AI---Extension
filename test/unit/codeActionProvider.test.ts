import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { FixoraCodeActionProvider } from '../../src/diagnostics/codeActionProvider';
import { DiagnosticManager } from '../../src/diagnostics/diagnosticManager';
import { ReviewFinding } from '../../src/types';

describe('FixoraCodeActionProvider', () => {
  it('should ignore diagnostics not sourced from Fixora AI', () => {
    const provider = new FixoraCodeActionProvider();
    const mockDoc = {
      uri: vscode.Uri.file('/app/test.ts'),
      lineAt: () => ({ range: new vscode.Range(0, 0, 0, 10) }),
    } as any;

    const nonFixoraDiag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 5),
      'Syntax error',
      vscode.DiagnosticSeverity.Error
    );
    nonFixoraDiag.source = 'TypeScript';

    const actions = provider.provideCodeActions(
      mockDoc,
      new vscode.Range(0, 0, 0, 5),
      { diagnostics: [nonFixoraDiag] } as any,
      {} as any
    );

    expect(actions).toEqual([]);
  });

  it('should provide explain and dashboard actions for Fixora AI diagnostics', () => {
    const provider = new FixoraCodeActionProvider();
    const uri = vscode.Uri.file('/app/sample.ts');
    const mockDoc = {
      uri,
      lineAt: () => ({ range: new vscode.Range(0, 0, 0, 20) }),
    } as any;

    const fixoraDiag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 10),
      'Potential null reference issue',
      vscode.DiagnosticSeverity.Warning
    );
    fixoraDiag.source = 'Fixora AI';

    const actions = provider.provideCodeActions(
      mockDoc,
      new vscode.Range(0, 0, 0, 10),
      { diagnostics: [fixoraDiag] } as any,
      {} as any
    );

    expect(actions.length).toBeGreaterThanOrEqual(2);
    const explainAction = actions.find((a) => a.title.includes('Explain Issue with Fixora AI'));
    expect(explainAction).toBeDefined();
    expect(explainAction?.command?.command).toBe('fixora.explainError');

    const dashboardAction = actions.find((a) => a.title.includes('Open Fixora AI Dashboard'));
    expect(dashboardAction).toBeDefined();
    expect(dashboardAction?.command?.command).toBe('fixora.openDashboard');
  });

  it('should provide a 1-click QuickFix action when suggestedFix is available', () => {
    const provider = new FixoraCodeActionProvider();
    const uri = vscode.Uri.file('/app/fixable.ts');
    const mockDoc = {
      uri,
      lineAt: () => ({ range: new vscode.Range(1, 0, 1, 25) }),
    } as any;

    const finding: ReviewFinding = {
      id: 'fix-1',
      title: 'Use triple equals',
      severity: 'warning',
      category: 'bug',
      filePath: '/app/fixable.ts',
      line: 2,
      column: 5,
      explanation: 'Use === instead of ==',
      whyItMatters: 'Avoid unexpected type coercion',
      suggestedSolution: 'Change == to ===',
      suggestedFix: 'if (x === 5) {',
      confidence: 0.95,
      source: 'ai',
    };

    const diagManager = DiagnosticManager.getInstance();
    diagManager.publishFindings(uri, [finding]);

    const fixoraDiag = new vscode.Diagnostic(
      new vscode.Range(1, 4, 1, 200),
      'Use triple equals: Use === instead of ==',
      vscode.DiagnosticSeverity.Warning
    );
    fixoraDiag.source = 'Fixora AI';

    const actions = provider.provideCodeActions(
      mockDoc,
      new vscode.Range(1, 4, 1, 200),
      { diagnostics: [fixoraDiag] } as any,
      {} as any
    );

    const fixAction = actions.find((a) => a.title.includes('Fix with Fixora AI: Use triple equals'));
    expect(fixAction).toBeDefined();
    expect(fixAction?.isPreferred).toBe(true);
    expect(fixAction?.edit).toBeDefined();
  });
});
