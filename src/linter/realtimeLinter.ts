import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';
import { FileUtils } from '../utils/fileUtils';

export interface LinterFix {
  title: string;
  replacement: string;
  range: vscode.Range;
}

export const SUPPORTED_LINTER_LANGUAGES = [
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'html',
  'css',
  'scss',
  'less',
  'python',
  'java',
  'c',
  'cpp',
  'php',
  'sql',
];

/**
 * Production-grade real-time as-you-type linter engine for:
 * JavaScript, TypeScript, JSX, TSX, Python, Java, C, C++, HTML, CSS/SCSS/LESS, PHP, and SQL.
 *
 * Features:
 * - Precise line and column coordinate clamping to avoid out-of-bounds positions
 * - Deduplicated diagnostics
 * - Cancellation of obsolete work via CancellationTokenSource on rapid typing
 * - Configurable debouncing
 * - Clean document closing disposal (onDidCloseTextDocument)
 * - Safe exclusion detection (respects .gitignore, node_modules, dist)
 * - 1-click Quick Fixes via CodeActionProvider
 * - Rich Hover Provider explanations
 */
export class RealtimeLinter implements vscode.CodeActionProvider, vscode.HoverProvider {
  private static instance: RealtimeLinter;
  private collection: vscode.DiagnosticCollection;
  private enabled: boolean = true;
  private debounceMs: number = 150;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private cancellationMap = new Map<string, vscode.CancellationTokenSource>();
  private disposables: vscode.Disposable[] = [];
  private fixMap = new Map<string, LinterFix>();
  private logger = Logger.getInstance();

  private constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(BRANDING.LINTER_COLLECTION_NAME);
    this.loadConfiguration();
    this.registerListeners();
    this.registerProviders();
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
    this.debounceMs = config.get<number>('debounceMs', 150);
  }

  private registerListeners(): void {
    // 1. As-you-type debounced incremental analysis with cancellation
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (!this.enabled) return;
        const activeDoc = vscode.window.activeTextEditor?.document;
        if (activeDoc && e.document.uri.toString() === activeDoc.uri.toString()) {
          this.scheduleLint(e.document);
        }
      })
    );

    // 2. Open document
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.enabled) {
          this.scheduleLint(doc);
        }
      })
    );

    // 3. Close document: clean up all cached diagnostics, fixes, and cancellation tokens
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.clearForUri(doc.uri);
      })
    );

    // 4. Active editor changed
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (this.enabled && editor) {
          this.lintDocument(editor.document);
        }
      })
    );

    // 5. Configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('fixora.linter') || e.affectsConfiguration('fixora')) {
          this.loadConfiguration();
          if (!this.enabled) {
            this.clearAllDiagnostics();
          } else if (vscode.window.activeTextEditor) {
            this.lintDocument(vscode.window.activeTextEditor.document);
          }
        }
      })
    );

    // Initial lint for active editor
    if (vscode.window.activeTextEditor) {
      this.lintDocument(vscode.window.activeTextEditor.document);
    }
  }

  private registerProviders(): void {
    for (const lang of SUPPORTED_LINTER_LANGUAGES) {
      this.disposables.push(
        vscode.languages.registerCodeActionsProvider(lang, this, {
          providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }),
        vscode.languages.registerHoverProvider(lang, this)
      );
    }
  }

  private scheduleLint(doc: vscode.TextDocument): void {
    const uriStr = doc.uri.toString();

    // Clear previous timer for this doc
    const prevTimer = this.debounceTimers.get(uriStr);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    // Cancel in-flight analysis for this doc
    const prevCts = this.cancellationMap.get(uriStr);
    if (prevCts) {
      prevCts.cancel();
      prevCts.dispose();
      this.cancellationMap.delete(uriStr);
    }

    const cts = new vscode.CancellationTokenSource();
    this.cancellationMap.set(uriStr, cts);

    const timer = setTimeout(() => {
      this.lintDocument(doc, cts.token);
      this.debounceTimers.delete(uriStr);
    }, this.debounceMs);

    this.debounceTimers.set(uriStr, timer);
  }

  /**
   * Lints a document and updates the diagnostics collection.
   */
  public lintDocument(
    document: vscode.TextDocument,
    cancellationToken?: vscode.CancellationToken
  ): vscode.Diagnostic[] {
    if (!this.enabled || !document) {
      return [];
    }

    // Respect exclusion settings
    const filePath = document.fileName || document.uri?.fsPath || '';
    if (FileUtils.isFileExcluded(filePath)) {
      this.collection.delete(document.uri);
      return [];
    }

    const langId = document.languageId.toLowerCase();
    const isSupported = SUPPORTED_LINTER_LANGUAGES.includes(langId);

    if (!isSupported) {
      return [];
    }

    const code = document.getText();
    if (!code.trim()) {
      this.collection.delete(document.uri);
      return [];
    }

    if (cancellationToken?.isCancellationRequested) {
      return [];
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const seenHashes = new Set<string>();

    // Clean old fixes for this doc
    const uriPrefix = document.uri.toString() + ':';
    for (const key of Array.from(this.fixMap.keys())) {
      if (key.startsWith(uriPrefix)) {
        this.fixMap.delete(key);
      }
    }

    // Multi-Language Dispatch
    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(langId)) {
      this.lintJavaScriptAndTypeScript(document, code, diagnostics, seenHashes);
    } else if (langId === 'python') {
      this.lintPython(document, code, diagnostics, seenHashes);
    } else if (langId === 'html') {
      this.lintHtml(document, code, diagnostics, seenHashes);
    } else if (['css', 'scss', 'less'].includes(langId)) {
      this.lintCss(document, code, diagnostics, seenHashes);
    } else if (langId === 'java') {
      this.lintJava(document, code, diagnostics, seenHashes);
    } else if (['c', 'cpp'].includes(langId)) {
      this.lintCAndCpp(document, code, diagnostics, seenHashes);
    } else if (langId === 'php') {
      this.lintPhp(document, code, diagnostics, seenHashes);
    } else if (langId === 'sql') {
      this.lintSql(document, code, diagnostics, seenHashes);
    }

    if (cancellationToken?.isCancellationRequested) {
      return [];
    }

    this.collection.set(document.uri, diagnostics);
    return diagnostics;
  }

  // ==========================================
  // 1. JavaScript / TypeScript / JSX / TSX
  // ==========================================
  private lintJavaScriptAndTypeScript(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);
    let openBraces = 0;
    let openParens = 0;
    let openBrackets = 0;
    let inBlockComment = false;

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed) return;

      if (trimmed.includes('/*')) inBlockComment = true;
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false;
        return;
      }
      if (trimmed.startsWith('//')) return;

      // Rule: eqeqeq (=== / !==)
      const eqMatch = lineText.match(/(?<=\s)(==|!=)(?=\s)/);
      if (eqMatch && eqMatch.index !== undefined) {
        const idx = eqMatch.index;
        const op = eqMatch[0];
        const range = this.createClampedRange(doc, lineIdx, idx, idx + op.length);
        const replacement = op === '==' ? '===' : '!==';
        const diag = this.createDiagnostic(
          range,
          `Expected '${replacement}' and instead saw '${op}' (eqeqeq)`,
          vscode.DiagnosticSeverity.Warning,
          'eqeqeq',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Replace with '${replacement}'`, replacement, range);
        }
      }

      // Rule: no-var
      const varMatch = lineText.match(/(?:^|\s)var\s+([a-zA-Z0-9_$]+)/);
      if (varMatch && varMatch.index !== undefined) {
        const start = lineText.indexOf('var', varMatch.index);
        const range = this.createClampedRange(doc, lineIdx, start, start + 3);
        const diag = this.createDiagnostic(
          range,
          "Unexpected 'var'. Use 'let' or 'const' instead (no-var)",
          vscode.DiagnosticSeverity.Warning,
          'no-var',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, "Replace 'var' with 'let'", 'let', range);
        }
      }

      // Rule: no-debugger
      if (/\bdebugger\b;?/.test(lineText)) {
        const idx = lineText.indexOf('debugger');
        const range = this.createClampedRange(doc, lineIdx, idx, idx + 8);
        const diag = this.createDiagnostic(
          range,
          "Unexpected 'debugger' statement in code (no-debugger)",
          vscode.DiagnosticSeverity.Error,
          'no-debugger',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, 'Remove debugger statement', '', range);
        }
      }

      // Rule: no-console in non-test files
      const fileName = doc.fileName || doc.uri?.fsPath || '';
      if (
        /console\.(log|debug|info)\s*\(/.test(lineText) &&
        !fileName.includes('.test.') &&
        !fileName.includes('.spec.')
      ) {
        const idx = lineText.indexOf('console.');
        const range = this.createClampedRange(doc, lineIdx, idx, idx + 11);
        const diag = this.createDiagnostic(
          range,
          "Avoid leaving 'console.log' statements in production code (no-console)",
          vscode.DiagnosticSeverity.Information,
          'no-console',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }

      // Rule: Accidental assignment in conditional if (x = 5)
      const assignMatch = lineText.match(/if\s*\(\s*([a-zA-Z0-9_$.]+)\s*=\s*([^=][^)]*)\)/);
      if (assignMatch && assignMatch.index !== undefined) {
        const idx = lineText.indexOf('=', assignMatch.index);
        const range = this.createClampedRange(doc, lineIdx, idx, idx + 1);
        const diag = this.createDiagnostic(
          range,
          'Assignment within conditional expression. Did you mean strict equality "==="? (no-cond-assign)',
          vscode.DiagnosticSeverity.Error,
          'no-cond-assign',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, 'Change = to ===', '===', range);
        }
      }

      // Track braces
      for (const char of lineText) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '(') openParens++;
        else if (char === ')') openParens--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    });

    if (openBraces !== 0 || openParens !== 0 || openBrackets !== 0) {
      const lastLineIdx = Math.max(0, lines.length - 1);
      const lastLineLen = lines[lastLineIdx].length;
      const range = this.createClampedRange(doc, lastLineIdx, Math.max(0, lastLineLen - 1), lastLineLen);

      let msg = 'Unbalanced syntax: ';
      if (openBraces > 0) msg += `missing ${openBraces} closing curly brace(s) '}'`;
      else if (openBraces < 0) msg += `extraneous ${Math.abs(openBraces)} closing curly brace(s) '}'`;
      else if (openParens > 0) msg += `missing ${openParens} closing parenthesis ')'`;
      else if (openBrackets > 0) msg += `missing ${openBrackets} closing bracket ']'`;

      const diag = this.createDiagnostic(
        range,
        msg,
        vscode.DiagnosticSeverity.Error,
        'syntax-unclosed-brace',
        BRANDING.PRODUCT_NAME,
        seen
      );
      if (diag) {
        diagnostics.push(diag);
      }
    }
  }

  // ==========================================
  // 2. Python PEP 8 & Syntax
  // ==========================================
  private lintPython(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Rule: Missing colon after control statements
      const colonMatch = trimmed.match(/^(def|class|if|elif|else|for|while|try|except|finally|with)\b.*[^:]$/);
      if (colonMatch && !trimmed.endsWith('\\')) {
        const start = lineText.indexOf(trimmed);
        const range = this.createClampedRange(doc, lineIdx, start + trimmed.length, start + trimmed.length);
        const diag = this.createDiagnostic(
          range,
          `Expected ':' at the end of '${colonMatch[1]}' statement (pep8-missing-colon)`,
          vscode.DiagnosticSeverity.Error,
          'pep8-missing-colon',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, "Add missing ':'", ':', range);
        }
      }

      // Rule: Comparison to None (E711)
      const noneMatch = lineText.match(/[!=]=\s*None\b/);
      if (noneMatch && noneMatch.index !== undefined) {
        const isNegated = noneMatch[0].startsWith('!=');
        const target = noneMatch[0];
        const replacement = isNegated ? 'is not None' : 'is None';
        const start = noneMatch.index;
        const range = this.createClampedRange(doc, lineIdx, start, start + target.length);
        const diag = this.createDiagnostic(
          range,
          `Comparison to None should be 'if cond ${replacement}:' (PEP 8 E711)`,
          vscode.DiagnosticSeverity.Warning,
          'E711',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Replace with '${replacement}'`, replacement, range);
        }
      }

      // Rule: Bare except clause (E722)
      if (/^except\s*:/.test(trimmed)) {
        const start = lineText.indexOf('except');
        const range = this.createClampedRange(doc, lineIdx, start, start + 6);
        const diag = this.createDiagnostic(
          range,
          "Do not use bare 'except': Specify explicit exception type like 'except Exception:' (PEP 8 E722)",
          vscode.DiagnosticSeverity.Warning,
          'E722',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, "Change to 'except Exception:'", 'except Exception:', range);
        }
      }

      // Rule: Mutable default argument in def
      const mutableDefault = lineText.match(/def\s+[a-zA-Z0-9_]+\s*\([^)]*=\s*(\[\]|\{\})\s*[,)]/);
      if (mutableDefault) {
        const start = lineText.indexOf(mutableDefault[1]);
        const range = this.createClampedRange(doc, lineIdx, start, start + mutableDefault[1].length);
        const diag = this.createDiagnostic(
          range,
          'Dangerous mutable default parameter. Use None as default value and assign in function body.',
          vscode.DiagnosticSeverity.Warning,
          'python-mutable-default',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, 'Replace mutable default with None', 'None', range);
        }
      }
    });
  }

  // ==========================================
  // 3. HTML Syntax & Accessibility
  // ==========================================
  private lintHtml(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);
    const tagStack: { tag: string; line: number }[] = [];
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
    ]);

    lines.forEach((lineText, lineIdx) => {
      // 1. Rule: img tags without alt
      const imgRegex = /<img\b([^>]*)>/gi;
      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = imgRegex.exec(lineText)) !== null) {
        const attrs = imgMatch[1];
        if (!/\balt\s*=/i.test(attrs)) {
          const range = this.createClampedRange(doc, lineIdx, imgMatch.index, imgMatch.index + imgMatch[0].length);
          const diag = this.createDiagnostic(
            range,
            "Images must have an 'alt' attribute for accessibility compliance (WCAG 1.1.1 / HTMLHint)",
            vscode.DiagnosticSeverity.Warning,
            'html-img-alt',
            BRANDING.PRODUCT_NAME,
            seen
          );
          if (diag) {
            diagnostics.push(diag);
            const fixedTag = imgMatch[0].replace(/<img\b/i, '<img alt=""');
            this.registerFix(doc.uri, diag, 'Add empty alt="" attribute', fixedTag, range);
          }
        }
      }

      // 2. Rule: Deprecated tags (<center>, <font>, <marquee>, <strike>)
      const depRegex = /<(center|font|marquee|strike|big)\b/gi;
      let depMatch: RegExpExecArray | null;
      while ((depMatch = depRegex.exec(lineText)) !== null) {
        const tagName = depMatch[1].toLowerCase();
        const range = this.createClampedRange(doc, lineIdx, depMatch.index, depMatch.index + depMatch[0].length);
        const diag = this.createDiagnostic(
          range,
          `The '<${tagName}>' is obsolete in modern HTML5. Use modern CSS layout and styling instead.`,
          vscode.DiagnosticSeverity.Warning,
          'html-deprecated-tag',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }

      // 3. Simple unclosed tag tracking
      const tagOpenRegex = /<([a-zA-Z0-9_-]+)(?:\s+[^>]*)?(?<!\/)>/g;
      let openMatch: RegExpExecArray | null;
      while ((openMatch = tagOpenRegex.exec(lineText)) !== null) {
        const t = openMatch[1].toLowerCase();
        if (!voidTags.has(t) && !lineText.includes(`</${t}>`)) {
          tagStack.push({ tag: t, line: lineIdx });
        }
      }

      const tagCloseRegex = /<\/([a-zA-Z0-9_-]+)>/g;
      let closeMatch: RegExpExecArray | null;
      while ((closeMatch = tagCloseRegex.exec(lineText)) !== null) {
        const t = closeMatch[1].toLowerCase();
        const top = tagStack[tagStack.length - 1];
        if (top && top.tag === t) {
          tagStack.pop();
        } else if (tagStack.length > 0) {
          const range = this.createClampedRange(doc, lineIdx, closeMatch.index, closeMatch.index + closeMatch[0].length);
          const diag = this.createDiagnostic(
            range,
            `Unexpected closing tag '</${t}>'. Expected closing tag for '<${top ? top.tag : 'unknown'}'.`,
            vscode.DiagnosticSeverity.Error,
            'html-mismatched-tag',
            BRANDING.PRODUCT_NAME,
            seen
          );
          if (diag) {
            diagnostics.push(diag);
          }
        }
      }
    });
  }

  // ==========================================
  // 4. CSS / SCSS / LESS
  // ==========================================
  private lintCss(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);
    const seenPropertiesInBlock = new Set<string>();

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('//')) return;

      if (trimmed.includes('{')) {
        seenPropertiesInBlock.clear();
      }

      if (trimmed.includes(':') && !trimmed.startsWith('@')) {
        // Rule: missing unit on non-zero numeric length (e.g. width: 100;)
        const missingUnitMatch = trimmed.match(/^([a-zA-Z-]+)\s*:\s*([1-9][0-9]*)\s*;/);
        if (
          missingUnitMatch &&
          [
            'width', 'height', 'margin', 'padding', 'font-size', 'top', 'bottom', 'left', 'right',
          ].includes(missingUnitMatch[1].toLowerCase())
        ) {
          const prop = missingUnitMatch[1];
          const val = missingUnitMatch[2];
          const startCol = lineText.indexOf(val);
          const range = this.createClampedRange(doc, lineIdx, startCol, startCol + val.length);
          const diag = this.createDiagnostic(
            range,
            `CSS length unit missing: '${val}' in '${prop}' expected '${val}px' (css-missing-unit)`,
            vscode.DiagnosticSeverity.Warning,
            'css-missing-unit',
            BRANDING.PRODUCT_NAME,
            seen
          );
          if (diag) {
            diagnostics.push(diag);
            this.registerFix(doc.uri, diag, `Add 'px' unit: '${val}px'`, `${val}px`, range);
          }
        }

        // Rule: unnecessary zero units (margin: 0px -> 0)
        const zeroUnitMatch = trimmed.match(/:\s*(0(px|em|rem|%|pt|vh|vw))\b/);
        if (zeroUnitMatch) {
          const raw = zeroUnitMatch[1];
          const startCol = lineText.indexOf(raw);
          const range = this.createClampedRange(doc, lineIdx, startCol, startCol + raw.length);
          const diag = this.createDiagnostic(
            range,
            `Unexpected unit on zero length '${raw}'. Use '0' (css-zero-units)`,
            vscode.DiagnosticSeverity.Information,
            'css-zero-units',
            BRANDING.PRODUCT_NAME,
            seen
          );
          if (diag) {
            diagnostics.push(diag);
            this.registerFix(doc.uri, diag, "Replace with '0'", '0', range);
          }
        }

        // Rule: Duplicate properties in the same block
        const propMatch = trimmed.match(/^([a-zA-Z-]+)\s*:/);
        if (propMatch) {
          const propName = propMatch[1].toLowerCase();
          if (seenPropertiesInBlock.has(propName)) {
            const startCol = lineText.indexOf(propMatch[1]);
            const range = this.createClampedRange(doc, lineIdx, startCol, startCol + propMatch[1].length);
            const diag = this.createDiagnostic(
              range,
              `Duplicate CSS property '${propName}' found in ruleset`,
              vscode.DiagnosticSeverity.Warning,
              'css-duplicate-property',
              BRANDING.PRODUCT_NAME,
              seen
            );
            if (diag) {
              diagnostics.push(diag);
            }
          } else {
            seenPropertiesInBlock.add(propName);
          }
        }
      }
    });
  }

  // ==========================================
  // 5. Java
  // ==========================================
  private lintJava(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      // Rule: String equality with == instead of .equals()
      const strEqMatch = lineText.match(/(?<=\s)(==|!=)\s*"([^"]*)"/);
      if (strEqMatch && strEqMatch.index !== undefined) {
        const range = this.createClampedRange(doc, lineIdx, strEqMatch.index, strEqMatch.index + 2);
        const diag = this.createDiagnostic(
          range,
          'Comparing strings with "==" checks identity, not content. Use .equals() or Objects.equals() instead.',
          vscode.DiagnosticSeverity.Warning,
          'java-string-equality',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }

      // Rule: Empty catch block
      if (/catch\s*\([^)]+\)\s*\{\s*\}/.test(trimmed)) {
        const start = lineText.indexOf('catch');
        const range = this.createClampedRange(doc, lineIdx, start, start + trimmed.length);
        const diag = this.createDiagnostic(
          range,
          'Empty catch block suppresses errors silently. Log exception or rethrow.',
          vscode.DiagnosticSeverity.Warning,
          'java-empty-catch',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }

      // Rule: e.printStackTrace() in production
      if (/\.printStackTrace\(\)/.test(lineText)) {
        const start = lineText.indexOf('.printStackTrace');
        const range = this.createClampedRange(doc, lineIdx, start, start + 18);
        const diag = this.createDiagnostic(
          range,
          'Avoid System/PrintStackTrace in production Java. Use a standard logger (SLF4J / Log4j2).',
          vscode.DiagnosticSeverity.Information,
          'java-print-stack-trace',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }
    });
  }

  // ==========================================
  // 6. C & C++
  // ==========================================
  private lintCAndCpp(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

      // Rule: Unsafe C library functions (gets, strcpy, sprintf)
      const unsafeMatch = lineText.match(/\b(gets|strcpy|sprintf|strcat)\s*\(/);
      if (unsafeMatch && unsafeMatch.index !== undefined) {
        const fn = unsafeMatch[1];
        const range = this.createClampedRange(doc, lineIdx, unsafeMatch.index, unsafeMatch.index + fn.length);
        const replacement = fn === 'gets' ? 'fgets' : fn === 'strcpy' ? 'strncpy' : fn === 'sprintf' ? 'snprintf' : 'strncat';
        const diag = this.createDiagnostic(
          range,
          `Dangerous buffer overflow function '${fn}'. Use bounded safe alternative '${replacement}' instead.`,
          vscode.DiagnosticSeverity.Error,
          'c-unsafe-func',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Replace with '${replacement}'`, replacement, range);
        }
      }

      // Rule: Format string vulnerability: printf(user_input)
      const printfMatch = lineText.match(/\bprintf\s*\(\s*([a-zA-Z0-9_]+)\s*\)/);
      if (printfMatch && printfMatch.index !== undefined) {
        const varName = printfMatch[1];
        const range = this.createClampedRange(doc, lineIdx, printfMatch.index, printfMatch.index + printfMatch[0].length);
        const diag = this.createDiagnostic(
          range,
          `Format string vulnerability: Passing variable '${varName}' directly to printf. Use 'printf("%s", ${varName})'.`,
          vscode.DiagnosticSeverity.Error,
          'c-format-string',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, `Use printf("%s", ${varName})`, `printf("%s", ${varName})`, range);
        }
      }
    });
  }

  // ==========================================
  // 7. PHP
  // ==========================================
  private lintPhp(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

      // Rule: Short open tag (<? instead of <?php)
      if (/^<\?(?!php|=|xml)/i.test(trimmed)) {
        const start = lineText.indexOf('<?');
        const range = this.createClampedRange(doc, lineIdx, start, start + 2);
        const diag = this.createDiagnostic(
          range,
          "Avoid PHP short open tags '<?'. Use '<?php' for standard server portability.",
          vscode.DiagnosticSeverity.Warning,
          'php-short-tag',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, "Replace with '<?php'", '<?php', range);
        }
      }

      // Rule: Dangerous eval() usage
      if (/\beval\s*\(/.test(lineText)) {
        const start = lineText.indexOf('eval');
        const range = this.createClampedRange(doc, lineIdx, start, start + 4);
        const diag = this.createDiagnostic(
          range,
          "Dangerous 'eval()' execution. May lead to Remote Code Execution (RCE).",
          vscode.DiagnosticSeverity.Error,
          'php-eval-usage',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }

      // Rule: Loose equality in PHP ==
      const eqMatch = lineText.match(/(?<=\s)==(?=\s)/);
      if (eqMatch && eqMatch.index !== undefined) {
        const range = this.createClampedRange(doc, lineIdx, eqMatch.index, eqMatch.index + 2);
        const diag = this.createDiagnostic(
          range,
          "PHP loose equality '==' can trigger subtle type juggling bugs. Prefer '==='.",
          vscode.DiagnosticSeverity.Warning,
          'php-loose-eq',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
          this.registerFix(doc.uri, diag, "Change to '==='", '===', range);
        }
      }
    });
  }

  // ==========================================
  // 8. SQL
  // ==========================================
  private lintSql(
    doc: vscode.TextDocument,
    code: string,
    diagnostics: vscode.Diagnostic[],
    seen: Set<string>
  ): void {
    const lines = code.split(/\r?\n/);

    lines.forEach((lineText, lineIdx) => {
      const trimmed = lineText.trim();
      if (!trimmed || trimmed.startsWith('--')) return;

      // Rule: SELECT * in production queries
      const selectStarMatch = lineText.match(/\bSELECT\s+\*\s+FROM\b/i);
      if (selectStarMatch && selectStarMatch.index !== undefined) {
        const starIdx = lineText.indexOf('*', selectStarMatch.index);
        const range = this.createClampedRange(doc, lineIdx, starIdx, starIdx + 1);
        const diag = this.createDiagnostic(
          range,
          "Avoid 'SELECT *' in production queries. Specify explicit columns for performance and index coverage.",
          vscode.DiagnosticSeverity.Information,
          'sql-select-star',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }

      // Rule: DELETE FROM or UPDATE without WHERE
      if (
        (/\bDELETE\s+FROM\s+[a-zA-Z0-9_.]+\s*;?$/i.test(trimmed) ||
          /\bUPDATE\s+[a-zA-Z0-9_.]+\s+SET\s+[^;]+;?$/i.test(trimmed)) &&
        !trimmed.toUpperCase().includes('WHERE')
      ) {
        const range = this.createClampedRange(doc, lineIdx, 0, trimmed.length);
        const diag = this.createDiagnostic(
          range,
          'Critical: DELETE or UPDATE query without a WHERE clause will modify all rows in the table!',
          vscode.DiagnosticSeverity.Error,
          'sql-missing-where',
          BRANDING.PRODUCT_NAME,
          seen
        );
        if (diag) {
          diagnostics.push(diag);
        }
      }
    });
  }

  // ==========================================
  // Helper & Provider Implementations
  // ==========================================

  private createClampedRange(
    doc: vscode.TextDocument,
    line: number,
    startCol: number,
    endCol: number
  ): vscode.Range {
    const totalLines = typeof doc.lineCount === 'number' && doc.lineCount > 0 ? doc.lineCount : 100000;
    const clampedLine = Math.max(0, Math.min(totalLines - 1, line));
    let lineLen = 500;
    if (typeof doc.lineAt === 'function') {
      try {
        lineLen = doc.lineAt(clampedLine).text.length;
      } catch {
        lineLen = 500;
      }
    }
    const clampedStart = Math.max(0, Math.min(lineLen, startCol));
    const clampedEnd = Math.max(clampedStart, Math.min(lineLen, endCol));
    return new vscode.Range(clampedLine, clampedStart, clampedLine, clampedEnd);
  }

  private createDiagnostic(
    range: vscode.Range,
    message: string,
    severity: vscode.DiagnosticSeverity,
    code: string,
    source: string,
    seen: Set<string>
  ): vscode.Diagnostic | null {
    // Deduplication check
    const hash = `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}:${code}:${message}`;
    if (seen.has(hash)) {
      return null;
    }
    seen.add(hash);

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
   * CodeActionProvider: Provides 1-click QuickFixes for detected issues
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      const key = `${document.uri.toString()}:${diag.range.start.line}:${diag.range.start.character}:${diag.code}`;
      const fix = this.fixMap.get(key);

      if (fix) {
        const action = new vscode.CodeAction(
          `💡 ${BRANDING.PRODUCT_NAME} (${diag.code}): ${fix.title}`,
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
   * HoverProvider: Displays rich contextual markdown documentation on hover
   */
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    const diags = vscode.languages.getDiagnostics(document.uri);
    const activeDiag = diags.find((d) => d.range.contains(position) && d.source === BRANDING.PRODUCT_NAME);

    if (!activeDiag) return null;

    const severityLabel =
      activeDiag.severity === vscode.DiagnosticSeverity.Error
        ? '🔴 Critical Error'
        : activeDiag.severity === vscode.DiagnosticSeverity.Warning
        ? '⚠️ Warning'
        : 'ℹ️ Information';

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`### ${BRANDING.PRODUCT_NAME}: ${activeDiag.code || 'Diagnostic'}\n`);
    md.appendMarkdown(`**${severityLabel}**: ${activeDiag.message}\n\n`);
    md.appendMarkdown(`--- \n`);
    md.appendMarkdown(`[Explain Issue](command:fixora.explainError) &bull; [Open Assistant](command:fixora.openDashboard)`);

    return new vscode.Hover(md, activeDiag.range);
  }

  /**
   * Clears diagnostics and caches for a specific file URI.
   */
  public clearForUri(uri: vscode.Uri): void {
    this.collection.delete(uri);
    const uriStr = uri.toString();

    // Cancel and clean pending timers & tokens
    const timer = this.debounceTimers.get(uriStr);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(uriStr);
    }

    const cts = this.cancellationMap.get(uriStr);
    if (cts) {
      cts.cancel();
      cts.dispose();
      this.cancellationMap.delete(uriStr);
    }

    // Clear fix entries for this document
    const prefix = uriStr + ':';
    for (const key of Array.from(this.fixMap.keys())) {
      if (key.startsWith(prefix)) {
        this.fixMap.delete(key);
      }
    }
  }

  public clearAllDiagnostics(): void {
    this.collection.clear();
    this.fixMap.clear();
    for (const cts of this.cancellationMap.values()) {
      cts.cancel();
      cts.dispose();
    }
    this.cancellationMap.clear();
    for (const t of this.debounceTimers.values()) {
      clearTimeout(t);
    }
    this.debounceTimers.clear();
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
      `${BRANDING.PRODUCT_NAME} Real-time Linter (ESLint & Style): ${this.enabled ? 'Enabled' : 'Disabled'}`
    );
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public dispose(): void {
    this.clearAllDiagnostics();
    this.collection.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
