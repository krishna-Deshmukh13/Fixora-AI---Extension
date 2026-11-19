import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface LinterFix {
  title: string;
  replacement: string;
  range: vscode.Range;
}

/**
 * Real-time as-you-type linter engine for JavaScript, TypeScript, HTML, CSS, and Python.
 * Functions like ESLint & Stylelint, publishing problems inline and providing 1-click Quick Fixes.
 */
export class RealtimeLinter implements vscode.CodeActionProvider {
  private static instance: RealtimeLinter;
  private collection: vscode.DiagnosticCollection;
  private enabled: boolean = true;
  private debounceTimer: NodeJS.Timeout | null = null;
  private disposables: vscode.Disposable[] = [];
  private fixMap = new Map<string, LinterFix>();
  private logger = Logger.getInstance();

  private constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('fixora-linter');
    this.loadConfiguration();
    this.registerListeners();
  }

  public static initialize(context?: vscode.ExtensionContext): RealtimeLinter {
    if (!RealtimeLinter.instance) {
      RealtimeLinter.instance = new RealtimeLinter();
      if (context) {
        context.subscriptions.push(RealtimeLinter.instance);
      }
    }
    return RealtimeLinter.instance;
  }

  public static getInstance(): RealtimeLinter {
    if (!RealtimeLinter.instance) {
      RealtimeLinter.instance = new RealtimeLinter();
    }
    return RealtimeLinter.instance;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('fixora.linter');
    this.enabled = config.get<boolean>('enabled', true);
  }

  private registerListeners(): void {
    // 1. Lint as user types (debounced)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (!this.enabled) return;
        const activeDoc = vscode.window.activeTextEditor?.document;
        if (activeDoc && e.document.uri.toString() === activeDoc.uri.toString()) {
          this.scheduleLint(e.document);
        }
      })
    );

    // 2. Lint on document open
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.enabled) {
          this.scheduleLint(doc);
        }
      })
    );

    // 3. Lint on active editor change
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (this.enabled && editor) {
          this.lintDocument(editor.document);
        }
      })
    );

    // 4. Configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('fixora.linter')) {
          this.loadConfiguration();
          if (!this.enabled) {
            this.clearAllDiagnostics();
          } else if (vscode.window.activeTextEditor) {
            this.lintDocument(vscode.window.activeTextEditor.document);
          }
        }
      })
    );

    // Run initial lint if editor already open
    if (vscode.window.activeTextEditor) {
      this.lintDocument(vscode.window.activeTextEditor.document);
    }
  }

  private scheduleLint(doc: vscode.TextDocument): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.lintDocument(doc);
    }, 120);
  }

  /**
   * Lints a document and updates the diagnostics collection.
   */
  public lintDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
    if (!this.enabled || !document) {
      return [];
    }

    const langId = document.languageId.toLowerCase();
    const isSupported =
      ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html', 'css', 'scss', 'less', 'python'].includes(
        langId
      );

    if (!isSupported) {
      return [];
    }

    const code = document.getText();
    if (!code.trim()) {
      this.collection.delete(document.uri);
      return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];

    // Clean old fixes for this doc
    const uriPrefix = document.uri.toString() + ':';
    for (const key of Array.from(this.fixMap.keys())) {
      if (key.startsWith(uriPrefix)) {
        this.fixMap.delete(key);
      }
    }

    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(langId)) {
      this.lintJavaScriptAndTypeScript(document, code, diagnostics);
    } else if (langId === 'python') {
      this.lintPython(document, code, diagnostics);
    } else if (langId === 'html') {
      this.lintHtml(document, code, diagnostics);
    } else if (['css', 'scss', 'less'].includes(langId)) {
      this.lintCss(document, code, diagnostics);
    }

    this.collection.set(document.uri, diagnostics);
    return diagnostics;
  }

  /**
   * JavaScript & TypeScript ESLint & Syntax Linter
   */
  private lintJavaScriptAndTypeScript(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const lines = code.split(/\r?\n/);

    // 1. Global bracket/brace balance check (Syntax Error)
    let openBraces = 0;
    let openParens = 0;
    let openBrackets = 0;
    let inBlockComment = false;

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed) return;

      // Handle block comments
      if (trimmed.includes('/*')) inBlockComment = true;
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false;
        return;
      }
      if (trimmed.startsWith('//')) return;

      // Rule: eqeqeq (=== instead of ==, !== instead of !=)
      const eqMatch = lineText.match(/(?<=\s)(==|!=)(?=\s)/);
      if (eqMatch && eqMatch.index !== undefined) {
        // Exclude null/undefined comparisons if intended or if already ===
        const idx = eqMatch.index;
        const op = eqMatch[0];
        const range = new vscode.Range(lineIdx, idx, lineIdx, idx + op.length);
        const replacement = op === '==' ? '===' : '!==';
        const diag = this.createDiagnostic(
          range,
          `Expected '${replacement}' and instead saw '${op}' (eqeqeq)`,
          vscode.DiagnosticSeverity.Warning,
          'eqeqeq',
          'Fixora ESLint'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Replace with '${replacement}'`, replacement, range);
      }

      // Rule: no-var (use let or const instead of var)
      const varMatch = lineText.match(/\bvar\s+([a-zA-Z0-9_$]+)/);
      if (varMatch && varMatch.index !== undefined) {
        const range = new vscode.Range(lineIdx, varMatch.index, lineIdx, varMatch.index + 3);
        const diag = this.createDiagnostic(
          range,
          `Unexpected 'var', use 'let' or 'const' instead (no-var)`,
          vscode.DiagnosticSeverity.Warning,
          'no-var',
          'Fixora ESLint'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Replace 'var' with 'let'`, 'let', range);
      }

      // Rule: no-debugger
      const debugMatch = lineText.match(/\bdebugger\s*;?/);
      if (debugMatch && debugMatch.index !== undefined) {
        const range = new vscode.Range(lineIdx, debugMatch.index, lineIdx, debugMatch.index + debugMatch[0].length);
        const diag = this.createDiagnostic(
          range,
          `Unexpected 'debugger' statement in code (no-debugger)`,
          vscode.DiagnosticSeverity.Error,
          'no-debugger',
          'Fixora ESLint'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Remove 'debugger'`, '', range);
      }

      // Rule: no-console (warn in production)
      const consoleMatch = lineText.match(/\bconsole\.(log|debug|info|warn|error)\s*\(/);
      if (consoleMatch && consoleMatch.index !== undefined) {
        const range = new vscode.Range(lineIdx, consoleMatch.index, lineIdx, consoleMatch.index + consoleMatch[0].length - 1);
        const diag = this.createDiagnostic(
          range,
          `Unexpected console statement (no-console)`,
          vscode.DiagnosticSeverity.Information,
          'no-console',
          'Fixora ESLint'
        );
        diagnostics.push(diag);
      }

      // Rule: no-cond-assign (e.g. if (x = 5))
      const condAssign = lineText.match(/\b(if|while)\s*\(\s*([a-zA-Z0-9_$]+)\s*=\s*([^=][^)]*)\)/);
      if (condAssign && condAssign.index !== undefined) {
        const range = new vscode.Range(lineIdx, condAssign.index, lineIdx, condAssign.index + condAssign[0].length);
        const diag = this.createDiagnostic(
          range,
          `Expected a conditional expression and instead saw an assignment (no-cond-assign)`,
          vscode.DiagnosticSeverity.Error,
          'no-cond-assign',
          'Fixora ESLint'
        );
        diagnostics.push(diag);
      }

      // Rule: no-eval
      const evalMatch = lineText.match(/\beval\s*\(/);
      if (evalMatch && evalMatch.index !== undefined) {
        const range = new vscode.Range(lineIdx, evalMatch.index, lineIdx, evalMatch.index + 4);
        diagnostics.push(
          this.createDiagnostic(
            range,
            `eval can be harmful and opens remote code execution vulnerabilities (no-eval)`,
            vscode.DiagnosticSeverity.Error,
            'no-eval',
            'Fixora ESLint'
          )
        );
      }

      // Bracket counting for syntax check (excluding strings)
      const sanitized = lineText.replace(/(['"`]).*?\1/g, '');
      for (const char of sanitized) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '(') openParens++;
        if (char === ')') openParens--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
      }
    });

    // Report unclosed syntax structures
    if (openBraces > 0) {
      const lastLine = lines.length - 1;
      diagnostics.push(
        this.createDiagnostic(
          new vscode.Range(lastLine, 0, lastLine, lines[lastLine].length),
          `SyntaxError: ${openBraces} unclosed curly brace(s) '{' detected`,
          vscode.DiagnosticSeverity.Error,
          'syntax-unclosed-brace',
          'Fixora Syntax'
        )
      );
    }
    if (openParens > 0) {
      const lastLine = lines.length - 1;
      diagnostics.push(
        this.createDiagnostic(
          new vscode.Range(lastLine, 0, lastLine, lines[lastLine].length),
          `SyntaxError: ${openParens} unclosed parenthesis '(' detected`,
          vscode.DiagnosticSeverity.Error,
          'syntax-unclosed-paren',
          'Fixora Syntax'
        )
      );
    }
  }

  /**
   * Python PEP 8 & Syntax Linter
   */
  private lintPython(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const lines = code.split(/\r?\n/);

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Rule: Missing colon in statements (def, class, if, elif, else, while, for, try, except, finally, with)
      const colonMatch = trimmed.match(/^(def\s+\w+\(.*?\)|class\s+\w+.*|if\s+.*|elif\s+.*|else|while\s+.*|for\s+.*|try|except.*|finally|with\s+.*)$/);
      if (colonMatch && !trimmed.endsWith(':')) {
        const startCol = lineText.indexOf(trimmed);
        const range = new vscode.Range(lineIdx, startCol, lineIdx, startCol + trimmed.length);
        const diag = this.createDiagnostic(
          range,
          `SyntaxError: Expected ':' at end of ${trimmed.split(/\s+/)[0]} statement`,
          vscode.DiagnosticSeverity.Error,
          'pep8-missing-colon',
          'Fixora PEP8'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Add missing ':'`, `${lineText}:`, new vscode.Range(lineIdx, 0, lineIdx, lineText.length));
      }

      // Rule: pep8 comparison with None (use `is None` / `is not None` instead of `== None` / `!= None`)
      const noneMatch = lineText.match(/(\w+|\))\s*(==|!=)\s*None\b/);
      if (noneMatch && noneMatch.index !== undefined) {
        const op = noneMatch[2];
        const range = new vscode.Range(lineIdx, noneMatch.index, lineIdx, noneMatch.index + noneMatch[0].length);
        const replacementOp = op === '==' ? 'is None' : 'is not None';
        const replacement = `${noneMatch[1]} ${replacementOp}`;
        const diag = this.createDiagnostic(
          range,
          `Comparison to None should be 'if cond ${replacementOp}:' (PEP 8 E711)`,
          vscode.DiagnosticSeverity.Warning,
          'E711',
          'Fixora PEP8'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Replace with '${replacement}'`, replacement, range);
      }

      // Rule: pep8 comparison with True / False (use `if cond:` instead of `if cond == True:`)
      const boolMatch = lineText.match(/(\w+)\s*==\s*(True|False)\b/);
      if (boolMatch && boolMatch.index !== undefined) {
        const range = new vscode.Range(lineIdx, boolMatch.index, lineIdx, boolMatch.index + boolMatch[0].length);
        const replacement = boolMatch[2] === 'True' ? boolMatch[1] : `not ${boolMatch[1]}`;
        const diag = this.createDiagnostic(
          range,
          `Comparison to ${boolMatch[2]} should be '${replacement}' (PEP 8 E712)`,
          vscode.DiagnosticSeverity.Warning,
          'E712',
          'Fixora PEP8'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Simplify to '${replacement}'`, replacement, range);
      }

      // Rule: bare except
      if (trimmed === 'except:') {
        const startCol = lineText.indexOf('except:');
        const range = new vscode.Range(lineIdx, startCol, lineIdx, startCol + 7);
        const diag = this.createDiagnostic(
          range,
          `Do not use bare 'except', specify exception type 'except Exception:' (PEP 8 E722)`,
          vscode.DiagnosticSeverity.Warning,
          'E722',
          'Fixora PEP8'
        );
        diagnostics.push(diag);
        this.registerFix(doc.uri, diag, `Replace with 'except Exception:'`, 'except Exception:', range);
      }

      // Rule: Python 2 print statement
      const py2Print = trimmed.match(/^print\s+("[^"]*"|'[^']*'|\w+)/);
      if (py2Print) {
        const startCol = lineText.indexOf(trimmed);
        const range = new vscode.Range(lineIdx, startCol, lineIdx, startCol + trimmed.length);
        const arg = py2Print[1];
        diagnostics.push(
          this.createDiagnostic(
            range,
            `SyntaxError: Missing parentheses in call to 'print'. Did you mean print(${arg})?`,
            vscode.DiagnosticSeverity.Error,
            'python-missing-parens-print',
            'Fixora Python'
          )
        );
      }
    });
  }

  /**
   * HTML Syntax & Accessibility Linter
   */
  private lintHtml(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const lines = code.split(/\r?\n/);

    // Track tag nesting
    const tagStack: Array<{ tag: string; line: number }> = [];
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    const deprecatedTags = new Set([
      'center', 'font', 'marquee', 'blink', 'strike', 'big', 'u'
    ]);

    lines.forEach((lineText, lineIdx) => {
      // Rule 1: <img> tag without alt attribute
      const imgMatch = lineText.match(/<img\b([^>]*)>/gi);
      if (imgMatch) {
        imgMatch.forEach((tagStr) => {
          if (!tagStr.includes('alt=')) {
            const startCol = lineText.indexOf(tagStr);
            const range = new vscode.Range(lineIdx, startCol, lineIdx, startCol + tagStr.length);
            const diag = this.createDiagnostic(
              range,
              `Accessibility: <img> element must have an 'alt' attribute for screen readers`,
              vscode.DiagnosticSeverity.Warning,
              'html-img-alt',
              'Fixora HTML'
            );
            diagnostics.push(diag);
            const replacement = tagStr.replace(/<img\b/, '<img alt=""');
            this.registerFix(doc.uri, diag, `Add empty alt="" attribute`, replacement, range);
          }
        });
      }

      // Rule 2: Deprecated HTML elements
      for (const dep of Array.from(deprecatedTags)) {
        const regex = new RegExp(`<${dep}\\b`, 'gi');
        let match;
        while ((match = regex.exec(lineText)) !== null) {
          const range = new vscode.Range(lineIdx, match.index, lineIdx, match.index + dep.length + 1);
          diagnostics.push(
            this.createDiagnostic(
              range,
              `HTML Element '<${dep}>' is obsolete and deprecated in HTML5`,
              vscode.DiagnosticSeverity.Warning,
              'html-deprecated-tag',
              'Fixora HTML'
            )
          );
        }
      }

      // Rule 3: Find unclosed opening tags / mismatched closing tags
      const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*?)?(\/?)>/g;
      let tagMatch;
      while ((tagMatch = tagRegex.exec(lineText)) !== null) {
        const fullTag = tagMatch[0];
        const tagName = tagMatch[1].toLowerCase();
        const isClosing = fullTag.startsWith('</');
        const isSelfClosing = tagMatch[2] === '/' || voidTags.has(tagName);

        if (tagName.startsWith('!') || tagName === 'doctype') continue;

        if (isClosing) {
          if (tagStack.length > 0) {
            const last = tagStack[tagStack.length - 1];
            if (last.tag === tagName) {
              tagStack.pop();
            } else {
              const range = new vscode.Range(lineIdx, tagMatch.index, lineIdx, tagMatch.index + fullTag.length);
              diagnostics.push(
                this.createDiagnostic(
                  range,
                  `HTML Mismatch: Closing tag '</${tagName}>' does not match opening tag '<${last.tag}>' at line ${last.line + 1}`,
                  vscode.DiagnosticSeverity.Error,
                  'html-mismatched-tag',
                  'Fixora HTML'
                )
              );
            }
          }
        } else if (!isSelfClosing) {
          tagStack.push({ tag: tagName, line: lineIdx });
        }
      }
    });

    // Check remaining unclosed tags
    for (const unclosed of tagStack) {
      if (!['p', 'li', 'td', 'th', 'tr'].includes(unclosed.tag)) {
        diagnostics.push(
          this.createDiagnostic(
            new vscode.Range(unclosed.line, 0, unclosed.line, lines[unclosed.line].length),
            `HTML SyntaxError: Unclosed tag '<${unclosed.tag}>'`,
            vscode.DiagnosticSeverity.Error,
            'html-unclosed-tag',
            'Fixora HTML'
          )
        );
      }
    }
  }

  /**
   * CSS / SCSS Stylelint & Syntax Linter
   */
  private lintCss(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const lines = code.split(/\r?\n/);
    let insideRule = false;
    const seenPropertiesInBlock = new Set<string>();

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('/*')) return;

      if (trimmed.includes('{')) {
        insideRule = true;
        seenPropertiesInBlock.clear();
      }

      if (trimmed.includes('}')) {
        insideRule = false;
        seenPropertiesInBlock.clear();
      }

      if (insideRule && trimmed.includes(':') && !trimmed.includes('{')) {
        // Rule 1: Missing semicolon at end of declaration
        if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
          const range = new vscode.Range(lineIdx, 0, lineIdx, lineText.length);
          const diag = this.createDiagnostic(
            range,
            `CSS Syntax: Missing semicolon ';' at end of declaration`,
            vscode.DiagnosticSeverity.Error,
            'css-missing-semicolon',
            'Fixora CSS'
          );
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Add ';' at end of line`, `${lineText};`, range);
        }

        // Rule 2: Zero units (e.g. 0px -> 0)
        const zeroUnitMatch = lineText.match(/:\s*0(px|em|rem|pt|cm|mm|in)\b/);
        if (zeroUnitMatch && zeroUnitMatch.index !== undefined) {
          const range = new vscode.Range(
            lineIdx,
            zeroUnitMatch.index + 2,
            lineIdx,
            zeroUnitMatch.index + zeroUnitMatch[0].length
          );
          const diag = this.createDiagnostic(
            range,
            `Unexpected unit on zero length '0${zeroUnitMatch[1]}', prefer '0'`,
            vscode.DiagnosticSeverity.Warning,
            'css-zero-units',
            'Fixora CSS'
          );
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Replace '0${zeroUnitMatch[1]}' with '0'`, '0', range);
        }

        // Rule 3: Missing units on non-zero dimension (e.g. width: 200;)
        const missingUnit = lineText.match(/\b(width|height|margin|padding|top|left|right|bottom|font-size)\s*:\s*([1-9]\d*)\s*;/);
        if (missingUnit && missingUnit.index !== undefined) {
          const propName = missingUnit[1];
          const val = missingUnit[2];
          const range = new vscode.Range(lineIdx, missingUnit.index, lineIdx, missingUnit.index + missingUnit[0].length);
          const replacement = `${propName}: ${val}px;`;
          const diag = this.createDiagnostic(
            range,
            `CSS Syntax: Missing length unit for '${propName}: ${val}', expected '${val}px'`,
            vscode.DiagnosticSeverity.Error,
            'css-missing-unit',
            'Fixora CSS'
          );
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Add 'px' unit: '${replacement}'`, replacement, range);
        }

        // Rule 4: Duplicate properties in the same block
        const propMatch = trimmed.match(/^([a-zA-Z-]+)\s*:/);
        if (propMatch) {
          const propName = propMatch[1].toLowerCase();
          if (seenPropertiesInBlock.has(propName)) {
            const startCol = lineText.indexOf(propMatch[1]);
            const range = new vscode.Range(lineIdx, startCol, lineIdx, startCol + propMatch[1].length);
            diagnostics.push(
              this.createDiagnostic(
                range,
                `Duplicate CSS property '${propName}' found in ruleset`,
                vscode.DiagnosticSeverity.Warning,
                'css-duplicate-property',
                'Fixora CSS'
              )
            );
          } else {
            seenPropertiesInBlock.add(propName);
          }
        }
      }
    });
  }

  private createDiagnostic(
    range: vscode.Range,
    message: string,
    severity: vscode.DiagnosticSeverity,
    code: string,
    source: string
  ): vscode.Diagnostic {
    const diag = new vscode.Diagnostic(range, message, severity);
    diag.code = code;
    diag.source = source;
    return diag;
  }

  private registerFix(
    uri: vscode.Uri,
    diagnostic: vscode.Diagnostic,
    title: string,
    replacement: string,
    range: vscode.Range
  ): void {
    const key = `${uri.toString()}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.code}`;
    this.fixMap.set(key, { title, replacement, range });
  }

  /**
   * CodeActionProvider: Provides Quick Fixes for ESLint & Stylelint issues
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      const key = `${document.uri.toString()}:${diag.range.start.line}:${diag.range.start.character}:${diag.code}`;
      const fix = this.fixMap.get(key);

      if (fix) {
        const action = new vscode.CodeAction(
          `💡 Fixora AI (${diag.code}): ${fix.title}`,
          vscode.CodeActionKind.QuickFix
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fix.range, fix.replacement);
        action.edit = edit;
        action.diagnostics = [diag];
        action.isPreferred = true;
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Toggle linter on or off.
   */
  public toggle(forceState?: boolean): boolean {
    this.enabled = forceState !== undefined ? forceState : !this.enabled;
    if (!this.enabled) {
      this.clearAllDiagnostics();
    } else if (vscode.window.activeTextEditor) {
      this.lintDocument(vscode.window.activeTextEditor.document);
    }
    vscode.window.showInformationMessage(
      `Fixora Real-time Linter (ESLint & Style): ${this.enabled ? 'Enabled' : 'Disabled'}`
    );
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clearAllDiagnostics(): void {
    this.collection.clear();
    this.fixMap.clear();
  }

  public dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.collection.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
