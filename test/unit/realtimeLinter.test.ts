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

  describe('Java Linter', () => {
    it('should catch string equality with == and empty catch blocks', () => {
      const javaCode = `
public class Main {
    public void test(String s) {
        if (s == "admin") {
            try {
                process();
            } catch (Exception e) {}
        }
    }
}
`;
      const doc = {
        uri: vscode.Uri.file('/app/Main.java'),
        languageId: 'java',
        getText: () => javaCode,
      } as any;

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(2);

      const strEq = diags.find((d) => d.code === 'java-string-equality');
      expect(strEq).toBeDefined();

      const emptyCatch = diags.find((d) => d.code === 'java-empty-catch');
      expect(emptyCatch).toBeDefined();
    });
  });

  describe('C / C++ Linter', () => {
    it('should catch dangerous buffer overflow functions and format string vulnerabilities', () => {
      const cCode = `
#include <stdio.h>
void run() {
    char buf[64];
    gets(buf);
    printf(buf);
}
`;
      const doc = {
        uri: vscode.Uri.file('/app/main.c'),
        languageId: 'c',
        getText: () => cCode,
      } as any;

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(2);

      const unsafeFunc = diags.find((d) => d.code === 'c-unsafe-func');
      expect(unsafeFunc).toBeDefined();

      const formatStr = diags.find((d) => d.code === 'c-format-string');
      expect(formatStr).toBeDefined();
    });
  });

  describe('PHP & SQL Linters', () => {
    it('should catch PHP short tags, loose equality, and eval usage', () => {
      const phpCode = `
<?
if ($x == 10) {
    eval($code);
}
`;
      const doc = {
        uri: vscode.Uri.file('/app/index.php'),
        languageId: 'php',
        getText: () => phpCode,
      } as any;

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(3);

      expect(diags.find((d) => d.code === 'php-short-tag')).toBeDefined();
      expect(diags.find((d) => d.code === 'php-loose-eq')).toBeDefined();
      expect(diags.find((d) => d.code === 'php-eval-usage')).toBeDefined();
    });

    it('should catch SELECT * and missing WHERE in SQL', () => {
      const sqlCode = `
SELECT * FROM users;
DELETE FROM accounts;
`;
      const doc = {
        uri: vscode.Uri.file('/app/query.sql'),
        languageId: 'sql',
        getText: () => sqlCode,
      } as any;

      const diags = linter.lintDocument(doc);
      expect(diags.length).toBeGreaterThanOrEqual(2);

      expect(diags.find((d) => d.code === 'sql-select-star')).toBeDefined();
      expect(diags.find((d) => d.code === 'sql-missing-where')).toBeDefined();
    });
  });

  describe('Lifecycle & Cancellation', () => {
    it('should respect cancellation tokens during lint execution', () => {
      const doc = {
        uri: vscode.Uri.file('/app/app.js'),
        languageId: 'javascript',
        getText: () => 'var x = 1;',
      } as any;

      const token = { isCancellationRequested: true } as vscode.CancellationToken;
      const diags = linter.lintDocument(doc, token);
      expect(diags).toEqual([]);
    });

    it('should clear diagnostics when document is closed via clearForUri', () => {
      const uri = vscode.Uri.file('/app/test.js');
      const doc = {
        uri,
        languageId: 'javascript',
        getText: () => 'var y = 2;',
      } as any;

      linter.lintDocument(doc);
      linter.clearForUri(uri);
      expect(linter.isEnabled()).toBe(true);
    });
  });

  describe('Toggle Behavior', () => {
    it('should toggle enabled state and clear diagnostics when disabled', () => {
      const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

      expect(linter.isEnabled()).toBe(true);

      const stateOff = linter.toggle(false);
      expect(stateOff).toBe(false);
      expect(linter.isEnabled()).toBe(false);
      expect(infoSpy).toHaveBeenCalledWith('Revion Real-time Linter (ESLint & Style): Disabled');

      const stateOn = linter.toggle(true);
      expect(stateOn).toBe(true);
      expect(linter.isEnabled()).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith('Revion Real-time Linter (ESLint & Style): Enabled');
    });
  });
});
