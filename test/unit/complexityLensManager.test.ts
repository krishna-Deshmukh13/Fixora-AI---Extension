import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ComplexityLensManager } from '../../src/metrics/complexityLensManager';

describe('ComplexityLensManager', () => {
  let manager: ComplexityLensManager;

  beforeEach(() => {
    (ComplexityLensManager as any).instance = undefined;
    manager = ComplexityLensManager.initialize();
  });

  it('should initialize with enabled state', () => {
    expect(manager).toBeDefined();
    expect(manager.isEnabled()).toBe(true);
  });

  it('should toggle enabled state and clear decorations when disabled', () => {
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const clearSpy = vi.spyOn(manager, 'clearDecorations');

    const disabledState = manager.toggle(false);
    expect(disabledState).toBe(false);
    expect(manager.isEnabled()).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith('Fixora Code Complexity Lens: Disabled');

    const enabledState = manager.toggle(true);
    expect(enabledState).toBe(true);
    expect(manager.isEnabled()).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('Fixora Code Complexity Lens: Enabled');
  });

  it('should calculate decorations on right side for functions in document', () => {
    const code = `
function simpleAdd(a, b) {
  return a + b;
}

function heavyBranches(x) {
  if (x === 1) return 'a';
  if (x === 2) return 'b';
  if (x === 3) return 'c';
  if (x === 4) return 'd';
  if (x === 5) return 'e';
  if (x === 6) return 'f';
  if (x === 7) return 'g';
  if (x === 8) return 'h';
  if (x === 9) return 'i';
  if (x === 10) return 'j';
  if (x === 11) return 'k';
  return 'z';
}
`;
    const mockUri = vscode.Uri.file('/path/to/test.js');
    const mockDoc = {
      fileName: '/path/to/test.js',
      languageId: 'javascript',
      uri: mockUri,
      lineCount: 25,
      getText: () => code,
      lineAt: (lineIndex: number) => ({
        text: 'function test() {}',
        range: new vscode.Range(lineIndex, 0, lineIndex, 30),
      }),
    };

    const setDecorationsSpy = vi.fn();
    const mockEditor = {
      document: mockDoc,
      setDecorations: setDecorationsSpy,
    } as any;

    manager.updateDecorations(mockEditor);

    expect(setDecorationsSpy).toHaveBeenCalled();
    const args = setDecorationsSpy.mock.calls[0];
    const decorationOptions = args[1] as any[];
    expect(decorationOptions.length).toBeGreaterThanOrEqual(1);

    // One of the decoration options should have CC and rating in after.contentText
    const heavyDeco = decorationOptions.find((d) => d.renderOptions?.after?.contentText?.includes('CC:'));
    expect(heavyDeco).toBeDefined();
    expect(heavyDeco.renderOptions.after.contentText).toContain('⚡ CC:');
  });

  it('should provide CodeActions for high-complexity functions with offline refactored code', () => {
    const code = `function calculateDiscount(tier) {
  if (tier === 'bronze') return 0.05;
  if (tier === 'silver') return 0.10;
  if (tier === 'gold') return 0.15;
  if (tier === 'platinum') return 0.20;
  if (tier === 'diamond') return 0.25;
  if (tier === 'vip') return 0.30;
  if (tier === 'svip') return 0.35;
  if (tier === 'vvip') return 0.40;
  if (tier === 'partner') return 0.45;
  if (tier === 'founder') return 0.50;
  if (tier === 'staff') return 0.55;
  return 0;
}`;
    const mockUri = vscode.Uri.file('/path/to/discount.js');
    const mockDoc = {
      fileName: '/path/to/discount.js',
      languageId: 'javascript',
      uri: mockUri,
      lineCount: 15,
      getText: () => code,
      lineAt: (lineIndex: number) => ({
        text: '  return 0;',
        range: new vscode.Range(lineIndex, 0, lineIndex, 40),
      }),
    } as any;

    const mockEditor = {
      document: mockDoc,
      setDecorations: vi.fn(),
    } as any;

    // First update decorations to register active functions and offline refactored alternatives
    manager.updateDecorations(mockEditor);

    const range = new vscode.Range(0, 0, 0, 10);
    const actions = manager.provideCodeActions(mockDoc, range);

    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].title).toContain('Fixora AI: Replace with low-complexity alternative code');
    expect(actions[0].edit).toBeDefined();
  });
});
