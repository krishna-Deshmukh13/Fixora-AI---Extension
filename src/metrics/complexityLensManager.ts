import * as vscode from 'vscode';
import { ComplexityAnalyzer, FunctionComplexity } from './complexityAnalyzer';
import { LanguageDetector } from '../utils/languageDetector';
import { Logger } from '../utils/logger';

/**
 * Live Automatic Complexity Lens for Fixora AI.
 * Automatically displays function cyclomatic complexity on the right side of code,
 * offers rich hover information, and provides 100% offline alternative code refactoring.
 */
export class ComplexityLensManager implements vscode.CodeActionProvider {
  private static instance: ComplexityLensManager;
  private logger = Logger.getInstance();

  private enabled = true;
  private debounceTimer: NodeJS.Timeout | null = null;
  private decorationType!: vscode.TextEditorDecorationType;
  private activeFunctions: Map<string, FunctionComplexity[]> = new Map();
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    this.loadConfiguration();
    this.createDecorationType();
    this.registerListeners();
  }

  public static initialize(): ComplexityLensManager {
    if (!ComplexityLensManager.instance) {
      ComplexityLensManager.instance = new ComplexityLensManager();
    }
    return ComplexityLensManager.instance;
  }

  public static getInstance(): ComplexityLensManager {
    return ComplexityLensManager.instance;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('fixora.complexityLens');
    this.enabled = config.get<boolean>('enabled', true);
  }

  private createDecorationType(): void {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: vscode.DecorationRangeBehavior ? vscode.DecorationRangeBehavior.ClosedClosed : undefined,
    });
  }

  private registerListeners(): void {
    // 1. Text changed in editor
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const activeDoc = vscode.window.activeTextEditor?.document;
        if (activeDoc && e.document.uri.toString() === activeDoc.uri.toString()) {
          this.scheduleUpdate(vscode.window.activeTextEditor);
        }
      })
    );

    // 2. Active editor changed
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.scheduleUpdate(editor);
      })
    );

    // 3. Configuration changed
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('fixora.complexityLens')) {
          this.loadConfiguration();
          this.updateDecorations(vscode.window.activeTextEditor);
        }
      })
    );

    // Initial update
    if (vscode.window.activeTextEditor) {
      this.scheduleUpdate(vscode.window.activeTextEditor);
    }
  }

  private scheduleUpdate(editor: vscode.TextEditor | undefined): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.updateDecorations(editor);
    }, 80);
  }

  /**
   * Automatically computes cyclomatic complexity and displays badges on the right side of every function.
   */
  public updateDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || !editor.document) {
      return;
    }

    if (!this.enabled) {
      editor.setDecorations(this.decorationType, []);
      this.activeFunctions.delete(editor.document.uri.toString());
      return;
    }

    const doc = editor.document;
    const code = doc.getText();
    if (!code.trim()) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const lang = LanguageDetector.detect(doc.fileName, doc.languageId, code);
    const metrics = ComplexityAnalyzer.analyze(code, doc.fileName, lang.id);

    this.activeFunctions.set(doc.uri.toString(), metrics.complexFunctions);

    const decorations: vscode.DecorationOptions[] = [];

    for (const fn of metrics.complexFunctions) {
      const lineIdx = fn.line - 1;
      if (lineIdx < 0 || lineIdx >= doc.lineCount) continue;

      const lineText = doc.lineAt(lineIdx).text;
      const targetPos = new vscode.Position(lineIdx, lineText.length);
      const range = new vscode.Range(targetPos, targetPos);

      // Color coding based on complexity thresholds
      let color = '#10b981'; // Green
      let badgeLabel = `⚡ CC: ${fn.complexity} (Low)`;

      if (fn.complexity >= 15) {
        color = '#ef4444'; // Red
        badgeLabel = `⛔ CC: ${fn.complexity} (Critical Complexity)`;
      } else if (fn.complexity >= 10) {
        color = '#f59e0b'; // Amber
        badgeLabel = `⚠️ CC: ${fn.complexity} (High Complexity)`;
      } else if (fn.complexity > 5) {
        color = '#38bdf8'; // Cyan
        badgeLabel = `⚡ CC: ${fn.complexity} (Moderate)`;
      }

      // Rich interactive Hover Card
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.appendMarkdown(`### ⚡ Function: \`${fn.name}\`\n\n`);
      md.appendMarkdown(`- **Cyclomatic Complexity**: **${fn.complexity}** (${fn.rating.toUpperCase()})\n`);
      md.appendMarkdown(`- **Overall Code Health Grade**: **${metrics.grade}** (${metrics.maintainabilityIndex}/100 Maintainability)\n\n`);

      if (fn.refactoredCode) {
        md.appendMarkdown(`---\n\n#### 💡 Recommended Alternative Code (Offline Refactor):\n`);
        md.appendMarkdown(`*Reduces Cyclomatic Complexity from **${fn.complexity}** down to **2***\n\n`);
        md.appendCodeblock(fn.refactoredCode, lang.id);
        md.appendMarkdown(`\n*(Press \`Ctrl+.\` / click 💡 Lightbulb on line ${fn.line} to apply this refactor instantly)*\n`);
      } else {
        md.appendMarkdown(`✅ *Code complexity is within healthy maintainable limits.*`);
      }

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: `    ${badgeLabel}`,
            color,
            fontStyle: 'italic',
            fontWeight: '500',
            margin: '0 0 0 3ch',
          },
        },
        hoverMessage: md,
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * CodeActionProvider: Provides one-click Quick Fix lightbulb to replace complex function with recommended code.
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.CodeAction[] {
    const list = this.activeFunctions.get(document.uri.toString());
    if (!list || list.length === 0) return [];

    const cursorLine = range.start.line + 1;
    const targetFn = list.find((f) => cursorLine >= f.line && cursorLine <= f.endLine && f.refactoredCode);

    if (!targetFn || !targetFn.refactoredCode) return [];

    const action = new vscode.CodeAction(
      `💡 Fixora AI: Replace with low-complexity alternative code (Offline Refactor: CC ${targetFn.complexity} ➔ 2)`,
      vscode.CodeActionKind.RefactorRewrite
    );

    const edit = new vscode.WorkspaceEdit();
    const startPos = new vscode.Position(targetFn.line - 1, 0);
    const endPos = new vscode.Position(
      Math.min(document.lineCount - 1, targetFn.endLine),
      document.lineAt(Math.min(document.lineCount - 1, targetFn.endLine - 1)).text.length
    );

    edit.replace(document.uri, new vscode.Range(startPos, endPos), targetFn.refactoredCode);
    action.edit = edit;
    action.isPreferred = true;

    return [action];
  }

  public clearDecorations(editor?: vscode.TextEditor): void {
    const target = editor || vscode.window.activeTextEditor;
    if (target) {
      target.setDecorations(this.decorationType, []);
      if (target.document) {
        this.activeFunctions.delete(target.document.uri.toString());
      }
    }
  }

  /**
   * Toggle complexity lens on or off.
   */
  public toggle(forceState?: boolean): boolean {
    this.enabled = forceState !== undefined ? forceState : !this.enabled;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      if (!this.enabled) {
        this.clearDecorations(editor);
      } else {
        this.updateDecorations(editor);
      }
    }
    vscode.window.showInformationMessage(
      `Fixora Code Complexity Lens: ${this.enabled ? 'Enabled' : 'Disabled'}`
    );
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.disposables.forEach((d) => d.dispose());
    this.decorationType.dispose();
  }
}
