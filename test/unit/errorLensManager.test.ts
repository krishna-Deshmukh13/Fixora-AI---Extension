import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ErrorLensManager } from '../../src/diagnostics/errorLensManager';

describe('ErrorLensManager (Native ErrorLens Clone)', () => {
  let manager: ErrorLensManager;

  beforeEach(() => {
    (ErrorLensManager as any).instance = undefined;
    manager = ErrorLensManager.initialize();
  });

  it('should initialize with enabled state and register decoration types', () => {
    expect(manager).toBeDefined();
    expect((manager as any).enabled).toBe(true);
    expect((manager as any).errorDecoration).toBeDefined();
    expect((manager as any).warningDecoration).toBeDefined();
  });

  it('should toggle enabled state and notify user', () => {
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    const newState = manager.toggle();
    expect(newState).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith('Revion Lens: Disabled');

    const toggledBack = manager.toggle();
    expect(toggledBack).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('Revion Lens: Enabled');
  });

  it('should update decorations with inline icons and line groupings', () => {
    const mockUri = vscode.Uri.file('/mock/app.ts');
    const mockDoc = {
      uri: mockUri,
      getText: () => 'const a = 1;\nconst b = 2;\n',
    };

    const setDecorationsSpy = vi.fn();
    const mockEditor = {
      document: mockDoc,
      setDecorations: setDecorationsSpy,
      selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
      revealRange: vi.fn(),
    } as any;

    vi.spyOn(vscode.languages, 'getDiagnostics').mockReturnValue([
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 10),
        'Missing semicolon',
        vscode.DiagnosticSeverity.Error
      ),
      new vscode.Diagnostic(
        new vscode.Range(0, 2, 0, 5),
        'Unused identifier "a"',
        vscode.DiagnosticSeverity.Warning
      ),
    ]);

    manager.updateDecorations(mockEditor);

    expect(setDecorationsSpy).toHaveBeenCalledTimes(4); // error, warning, info, hint
    const errorCalls = setDecorationsSpy.mock.calls[0];
    const options = errorCalls[1];
    expect(options.length).toBe(1);
    expect(options[0].renderOptions.after.contentText).toContain('⛔ Missing semicolon (+1 more)');
  });

  it('should navigate to next and previous diagnostics in active editor', () => {
    const mockUri = vscode.Uri.file('/mock/app.ts');
    const mockDoc = { uri: mockUri };

    const revealSpy = vi.fn();
    const mockEditor = {
      document: mockDoc,
      selection: { active: new vscode.Position(0, 0) },
      revealRange: revealSpy,
      setDecorations: vi.fn(),
    } as any;

    (vscode.window as any).activeTextEditor = mockEditor;

    vi.spyOn(vscode.languages, 'getDiagnostics').mockReturnValue([
      new vscode.Diagnostic(
        new vscode.Range(2, 0, 2, 5),
        'First error',
        vscode.DiagnosticSeverity.Error
      ),
      new vscode.Diagnostic(
        new vscode.Range(8, 0, 8, 5),
        'Second error',
        vscode.DiagnosticSeverity.Warning
      ),
    ]);

    // Jump to next
    manager.jumpToNext();
    expect(mockEditor.selection.active.line).toBe(2);
    expect(revealSpy).toHaveBeenCalled();

    // Jump to next again (line 8)
    manager.jumpToNext();
    expect(mockEditor.selection.active.line).toBe(8);

    // Jump to previous (back to line 2)
    manager.jumpToPrevious();
    expect(mockEditor.selection.active.line).toBe(2);
  });
});
