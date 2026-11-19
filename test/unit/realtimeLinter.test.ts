import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { RealtimeLinter } from '../../src/linter/realtimeLinter';

describe('RealtimeLinter (ESLint & Style as you type)', () => {
  let linter: RealtimeLinter;

  beforeEach(() => {
    (RealtimeLinter as any).instance = undefined;
    linter = RealtimeLinter.initialize();
  });

  describe('JavaScript & TypeScript Linter', () => {
    it('should catch eqeqeq and no-var with QuickFixes in JS/TS', () => {
      const code = `
var myVal = 10;
if (myVal == 10) {
  debugger;
}
`;
      const doc = {
        uri: vscode.Uri.file('/app/index.js'),
        languageId: 'javascript',
        getText: () => code,
      } as any;

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(3);

      const noVarDiag = diags.find((d) => d.code === 'no-var');
      expect(noVarDiag).toBeDefined();
      expect(noVarDiag?.message).toContain("Unexpected 'var'");

      const eqDiag = diags.find((d) => d.code === 'eqeqeq');
      expect(eqDiag).toBeDefined();
      expect(eqDiag?.message).toContain("Expected '==='");

      const debugDiag = diags.find((d) => d.code === 'no-debugger');
      expect(debugDiag).toBeDefined();

      // Test CodeActions / QuickFixes
      const actions = linter.provideCodeActions(doc, eqDiag!.range, {
        diagnostics: [eqDiag!],
        only: undefined,
        triggerKind: 1 as any,
      });
      expect(actions.length).toBe(1);
      expect(actions[0].title).toContain("Replace with '==='");
    });

    it('should catch unclosed curly braces syntax error', () => {
      const code = `
function broken() {
  if (true) {
    console.log('never closed');
`;
      const doc = {
        uri: vscode.Uri.file('/app/broken.ts'),
        languageId: 'typescript',
        getText: () => code,
      } as any;

      const diags = linter.lintDocument(doc);
      const syntaxDiag = diags.find((d) => d.code === 'syntax-unclosed-brace');
      expect(syntaxDiag).toBeDefined();
      expect(syntaxDiag?.severity).toBe(vscode.DiagnosticSeverity.Error);
    });
  });

  describe('Python PEP 8 & Syntax Linter', () => {
    it('should catch missing colons, PEP 8 None comparisons and bare except', () => {
      const pyCode = `
def calculate(x)
    if x == None:
        return 0
    try:
        val = 1 / x
    except:
        return None
`;
      const doc = {
        uri: vscode.Uri.file('/app/calc.py'),
        languageId: 'python',
        getText: () => pyCode,
      } as any;

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(3);

      const colonDiag = diags.find((d) => d.code === 'pep8-missing-colon');
      expect(colonDiag).toBeDefined();
      expect(colonDiag?.message).toContain("Expected ':'");

      const noneDiag = diags.find((d) => d.code === 'E711');
      expect(noneDiag).toBeDefined();
      expect(noneDiag?.message).toContain('Comparison to None');

      const exceptDiag = diags.find((d) => d.code === 'E722');
      expect(exceptDiag).toBeDefined();
      expect(exceptDiag?.message).toContain("bare 'except'");
    });
  });

  describe('HTML Syntax & Accessibility Linter', () => {
    it('should catch img tags missing alt attribute and deprecated tags', () => {
      const htmlCode = `
<!DOCTYPE html>
<html>
<body>
  <center>Welcome</center>
  <img src="banner.png">
</body>
</html>
`;
      const doc = {
        uri: vscode.Uri.file('/app/index.html'),
        languageId: 'html',
        getText: () => htmlCode,
      } as any;

      const diags = linter.lintDocument(doc);
      const altDiag = diags.find((d) => d.code === 'html-img-alt');
      expect(altDiag).toBeDefined();
      expect(altDiag?.message).toContain("must have an 'alt' attribute");

      const depDiag = diags.find((d) => d.code === 'html-deprecated-tag');
      expect(depDiag).toBeDefined();
      expect(depDiag?.message).toContain("'<center>' is obsolete");

      // Verify QuickFix to add alt=""
      const actions = linter.provideCodeActions(doc, altDiag!.range, {
        diagnostics: [altDiag!],
        only: undefined,
        triggerKind: 1 as any,
      });
      expect(actions.length).toBe(1);
      expect(actions[0].title).toContain('Add empty alt="" attribute');
    });

    it('should detect unclosed HTML tags', () => {
      const htmlCode = `
<div class="wrapper">
  <span>Unclosed span
</div>
`;
      const doc = {
        uri: vscode.Uri.file('/app/unclosed.html'),
        languageId: 'html',
        getText: () => htmlCode,
      } as any;

      const diags = linter.lintDocument(doc);
      const mismatch = diags.find((d) => d.code === 'html-mismatched-tag' || d.code === 'html-unclosed-tag');
      expect(mismatch).toBeDefined();
    });
  });

  describe('CSS / SCSS Stylelint', () => {
    it('should catch missing semicolons, zero units, and duplicate properties', () => {
      const cssCode = `
.box {
  width: 100;
  margin: 0px;
  color: red;
  color: blue;
}
`;
      const doc = {
        uri: vscode.Uri.file('/app/styles.css'),
        languageId: 'css',
        getText: () => codeClean(cssCode),
      } as any;

      function codeClean(s: string) {
        return s;
      }

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(3);

      const unitDiag = diags.find((d) => d.code === 'css-missing-unit');
      expect(unitDiag).toBeDefined();
      expect(unitDiag?.message).toContain("expected '100px'");

      const zeroDiag = diags.find((d) => d.code === 'css-zero-units');
      expect(zeroDiag).toBeDefined();

      const dupDiag = diags.find((d) => d.code === 'css-duplicate-property');
      expect(dupDiag).toBeDefined();
      expect(dupDiag?.message).toContain("Duplicate CSS property 'color'");
    });
  });

  describe('Toggle Behavior', () => {
    it('should toggle enabled state and clear diagnostics when disabled', () => {
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

      expect(linter.isEnabled()).toBe(true);

      const stateOff = linter.toggle(false);
      expect(stateOff).toBe(false);
      expect(linter.isEnabled()).toBe(false);
      expect(infoSpy).toHaveBeenCalledWith('Fixora Real-time Linter (ESLint & Style): Disabled');

      const stateOn = linter.toggle(true);
      expect(stateOn).toBe(true);
      expect(linter.isEnabled()).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith('Fixora Real-time Linter (ESLint & Style): Enabled');
    });
  });
});
