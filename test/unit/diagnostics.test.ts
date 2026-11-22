import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticManager } from '../../src/diagnostics/diagnosticManager';
import { FixoraCodeActionProvider } from '../../src/diagnostics/codeActionProvider';
import { ReviewFinding } from '../../src/types';
import * as vscode from 'vscode';

describe('DiagnosticManager & CodeActionProvider', () => {
  let diagnosticManager: DiagnosticManager;
  let codeActionProvider: FixoraCodeActionProvider;

  beforeEach(() => {
    (DiagnosticManager as any).instance = undefined;
    diagnosticManager = DiagnosticManager.getInstance();
    codeActionProvider = new FixoraCodeActionProvider();
  });

  it('should map review findings to VS Code Diagnostics with correct severities', () => {
    const uri = vscode.Uri.file('C:/project/src/index.ts');
    const findings: ReviewFinding[] = [
      {
        id: 'f-1',
        title: 'Critical Bug',
        severity: 'critical',
        category: 'bug',
        filePath: 'C:/project/src/index.ts',
        line: 5,
        column: 2,
        explanation: 'Null pointer exception',
        whyItMatters: 'Process crash',
        suggestedSolution: 'Add null guard',
        confidence: 0.95,
        source: 'ai',
      },
      {
        id: 'f-2',
        title: 'Style Hint',
        severity: 'hint',
        category: 'style',
        filePath: 'C:/project/src/index.ts',
        line: 12,
        column: 1,
        explanation: 'Prefer const over let',
        whyItMatters: 'Immutability',
        suggestedSolution: 'Use const',
        confidence: 0.8,
        source: 'static',
      },
    ];

    diagnosticManager.publishFindings(uri, findings);

    // Retrieve finding for first diagnostic
    const dummyDiag = new vscode.Diagnostic(
      new vscode.Range(new vscode.Position(4, 1), new vscode.Position(4, 200)),
      'Critical Bug: Null pointer exception',
      vscode.DiagnosticSeverity.Error
    );

    const retrieved = diagnosticManager.getFinding(uri, dummyDiag);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('f-1');
  });

  it('should generate Quick Fix with WorkspaceEdit when suggestedFix is available', () => {
    const uri = vscode.Uri.file('C:/project/src/app.ts');
    const finding: ReviewFinding = {
      id: 'fix-1',
      title: 'Loose equality',
      severity: 'warning',
      category: 'bug',
      filePath: 'C:/project/src/app.ts',
      line: 3,
      column: 1,
      explanation: 'Use strict equality',
      whyItMatters: 'Type coercion',
      suggestedSolution: 'Use ===',
      suggestedFix: 'if (x === 0) {',
      confidence: 1.0,
      source: 'static',
    };

    diagnosticManager.publishFindings(uri, [finding]);

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 20)),
      'Loose equality: Use strict equality',
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = 'Fixora AI';

    const mockDoc: any = {
      uri,
      lineAt: () => ({ range: diagnostic.range }),
    };

    const mockContext: any = {
      diagnostics: [diagnostic],
    };

    const actions = codeActionProvider.provideCodeActions(
      mockDoc,
      diagnostic.range,
      mockContext,
      {} as any
    );

    expect(actions.length).toBeGreaterThanOrEqual(2);

    const fixAction = actions.find((a) => a.title.includes('Fix with'));
    expect(fixAction).toBeDefined();
    expect(fixAction?.isPreferred).toBe(true);
    expect(fixAction?.edit?.entries.length).toBe(1);
    expect(fixAction?.edit?.entries[0].newText).toBe('if (x === 0) {');

    const explainAction = actions.find((a) => a.title.includes('Explain Issue with'));
    expect(explainAction).toBeDefined();
  });

  it('should clear all diagnostics when clearDiagnostics is invoked', () => {
    const uri = vscode.Uri.file('C:/project/src/index.ts');
    diagnosticManager.publishFindings(uri, [
      {
        id: 'f-1',
        title: 'Bug',
        severity: 'warning',
        category: 'bug',
        filePath: uri.fsPath,
        line: 1,
        explanation: 'Test',
        whyItMatters: '',
        suggestedSolution: '',
        confidence: 0.9,
        source: 'static',
      },
    ]);

    diagnosticManager.clearDiagnostics();
    const dummyDiag = new vscode.Diagnostic(
      new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10)),
      'Bug: Test',
      vscode.DiagnosticSeverity.Warning
    );
    expect(diagnosticManager.getFinding(uri, dummyDiag)).toBeUndefined();
  });
});
