import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';

export interface ErrorLensConfig {
  enabled: boolean;
  highlightLine: boolean;
  showInlineMessage: boolean;
  showGutterIcons: boolean;
  showStatusBar: boolean;
  prefix: string;
}

/**
 * 100% Native ErrorLens Implementation for Revion.
 * Provides live inline diagnostics, entire line highlighting, gutter icons,
 * status bar summaries, and quick jumping between errors and warnings.
 */
export class ErrorLensManager {
  private static instance: ErrorLensManager;
  private logger = Logger.getInstance();

  private enabled = true;
  private highlightLine = true;
  private showInlineMessage = true;
  private showStatusBar = true;
  private debounceTimer: NodeJS.Timeout | null = null;

  // Decoration Types for each Diagnostic Severity
  private errorDecoration!: vscode.TextEditorDecorationType;
  private warningDecoration!: vscode.TextEditorDecorationType;
  private infoDecoration!: vscode.TextEditorDecorationType;
  private hintDecoration!: vscode.TextEditorDecorationType;

  private statusBarItem!: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    this.loadConfiguration();
    this.createDecorationTypes();
    this.initStatusBar();
    this.registerListeners();
  }

  public static initialize(): ErrorLensManager {
    if (!ErrorLensManager.instance) {
      ErrorLensManager.instance = new ErrorLensManager();
    }
    return ErrorLensManager.instance;
  }

  public static getInstance(): ErrorLensManager {
    return ErrorLensManager.instance;
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('fixora.errorLens');
    this.enabled = config.get<boolean>('enabled', true);
    this.highlightLine = config.get<boolean>('highlightLine', true);
    this.showInlineMessage = config.get<boolean>('showInlineMessage', true);
    this.showStatusBar = config.get<boolean>('showStatusBar', true);
  }

  private createDecorationTypes(): void {
    this.errorDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: this.highlightLine,
      backgroundColor: this.highlightLine ? 'rgba(239, 68, 68, 0.12)' : undefined,
      overviewRulerColor: '#ef4444',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        backgroundColor: this.highlightLine ? 'rgba(239, 68, 68, 0.08)' : undefined,
      },
      dark: {
        backgroundColor: this.highlightLine ? 'rgba(239, 68, 68, 0.15)' : undefined,
      },
    });

    this.warningDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: this.highlightLine,
      backgroundColor: this.highlightLine ? 'rgba(245, 158, 11, 0.12)' : undefined,
      overviewRulerColor: '#f59e0b',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        backgroundColor: this.highlightLine ? 'rgba(245, 158, 11, 0.08)' : undefined,
      },
      dark: {
        backgroundColor: this.highlightLine ? 'rgba(245, 158, 11, 0.15)' : undefined,
      },
    });

    this.infoDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: this.highlightLine,
      backgroundColor: this.highlightLine ? 'rgba(59, 130, 246, 0.08)' : undefined,
      overviewRulerColor: '#3b82f6',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        backgroundColor: this.highlightLine ? 'rgba(59, 130, 246, 0.05)' : undefined,
      },
      dark: {
        backgroundColor: this.highlightLine ? 'rgba(59, 130, 246, 0.10)' : undefined,
      },
    });

    this.hintDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: this.highlightLine,
      backgroundColor: this.highlightLine ? 'rgba(16, 185, 129, 0.08)' : undefined,
      overviewRulerColor: '#10b981',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: {
        backgroundColor: this.highlightLine ? 'rgba(16, 185, 129, 0.05)' : undefined,
      },
      dark: {
        backgroundColor: this.highlightLine ? 'rgba(16, 185, 129, 0.10)' : undefined,
      },
    });
  }

  private initStatusBar(): void {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40);
    this.statusBarItem.command = 'fixora.nextDiagnostic';
    this.statusBarItem.tooltip = `${BRANDING.LENS_STATUS_NAME}: Click to jump to next issue`;
    if (this.showStatusBar && this.enabled) {
      this.statusBarItem.show();
    }
  }

  private registerListeners(): void {
    // 1. Reactive on diagnostics changed
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics((e) => {
        const activeDoc = vscode.window.activeTextEditor?.document;
        if (activeDoc && e.uris.some((u) => u.toString() === activeDoc.uri.toString())) {
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
        if (e.affectsConfiguration('fixora.errorLens')) {
          this.loadConfiguration();
          this.createDecorationTypes();
          this.updateDecorations(vscode.window.activeTextEditor);
        }
      })
    );

    // Initial run
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
    }, 40);
  }

  /**
   * Core rendering logic: reads all diagnostics on the current active document,
   * groups by line, and renders entire line background and inline after: contentText.
   */
  public updateDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor || !editor.document) {
      if (this.statusBarItem) this.statusBarItem.hide();
      return;
    }

    if (!this.enabled) {
      this.clearDecorations(editor);
      if (this.statusBarItem) this.statusBarItem.hide();
      return;
    }

    const doc = editor.document;
    const diagnostics = vscode.languages.getDiagnostics(doc.uri);

    let errorCount = 0;
    let warningCount = 0;

    // Group diagnostics by line number to prevent overlapping messages
    const lineMap: Map<number, vscode.Diagnostic[]> = new Map();
    for (const diag of diagnostics) {
      const line = diag.range.start.line;
      if (!lineMap.has(line)) {
        lineMap.set(line, []);
      }
      lineMap.get(line)!.push(diag);

      if (diag.severity === vscode.DiagnosticSeverity.Error) {
        errorCount++;
      } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
        warningCount++;
      }
    }

    const errorOptions: vscode.DecorationOptions[] = [];
    const warningOptions: vscode.DecorationOptions[] = [];
    const infoOptions: vscode.DecorationOptions[] = [];
    const hintOptions: vscode.DecorationOptions[] = [];

    for (const [line, diags] of lineMap.entries()) {
      // Sort by highest severity (Error=0, Warning=1, Information=2, Hint=3)
      diags.sort((a, b) => a.severity - b.severity);
      const primary = diags[0];
      const countSuffix = diags.length > 1 ? ` (+${diags.length - 1} more)` : '';
      const cleanMessage = primary.message.replace(/\r?\n/g, ' ').slice(0, 120);

      const targetRange = new vscode.Range(line, 0, line, 0);

      let icon = 'ℹ️';
      let color = '#38bdf8';
      let targetList = infoOptions;

      switch (primary.severity) {
        case vscode.DiagnosticSeverity.Error:
          icon = '⛔';
          color = '#f87171';
          targetList = errorOptions;
          break;
        case vscode.DiagnosticSeverity.Warning:
          icon = '⚠️';
          color = '#fbbf24';
          targetList = warningOptions;
          break;
        case vscode.DiagnosticSeverity.Information:
          icon = 'ℹ️';
          color = '#60a5fa';
          targetList = infoOptions;
          break;
        case vscode.DiagnosticSeverity.Hint:
          icon = '💡';
          color = '#34d399';
          targetList = hintOptions;
          break;
      }

      targetList.push({
        range: targetRange,
        renderOptions: this.showInlineMessage
          ? {
              after: {
                contentText: `    ${icon} ${cleanMessage}${countSuffix}`,
                color,
                fontStyle: 'italic',
                fontWeight: '500',
                margin: '0 0 0 2ch',
              },
            }
          : undefined,
      });
    }

    editor.setDecorations(this.errorDecoration, errorOptions);
    editor.setDecorations(this.warningDecoration, warningOptions);
    editor.setDecorations(this.infoDecoration, infoOptions);
    editor.setDecorations(this.hintDecoration, hintOptions);

    this.updateStatusBar(errorCount, warningCount);
  }

  private updateStatusBar(errors: number, warnings: number): void {
    if (!this.showStatusBar || !this.enabled) {
      this.statusBarItem.hide();
      return;
    }

    if (errors === 0 && warnings === 0) {
      this.statusBarItem.text = `$(check) ${BRANDING.LENS_STATUS_NAME}`;
      this.statusBarItem.tooltip = `${BRANDING.PRODUCT_NAME} Lens: No diagnostics in active file`;
    } else {
      this.statusBarItem.text = `$(error) ${errors}  $(warning) ${warnings}  ${BRANDING.LENS_STATUS_NAME}`;
      this.statusBarItem.tooltip = `${BRANDING.PRODUCT_NAME} Lens: ${errors} error(s), ${warnings} warning(s). Click to jump to next.`;
    }
    this.statusBarItem.show();
  }

  public clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.errorDecoration, []);
    editor.setDecorations(this.warningDecoration, []);
    editor.setDecorations(this.infoDecoration, []);
    editor.setDecorations(this.hintDecoration, []);
  }

  /**
   * Toggle Fixora Error Lens on or off.
   */
  public toggle(forceState?: boolean): boolean {
    this.enabled = forceState !== undefined ? forceState : !this.enabled;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.updateDecorations(editor);
    }
    vscode.window.showInformationMessage(
      `${BRANDING.PRODUCT_NAME} Lens: ${this.enabled ? 'Enabled' : 'Disabled'}`
    );
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Jump to next diagnostic in active text editor.
   */
  public jumpToNext(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diags = vscode.languages.getDiagnostics(editor.document.uri);
    if (diags.length === 0) {
      vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME} Lens: No issues found in current file.`);
      return;
    }

    const currentLine = editor.selection.active.line;
    const sorted = [...diags].sort((a, b) => a.range.start.line - b.range.start.line);

    let next = sorted.find((d) => d.range.start.line > currentLine);
    if (!next) {
      // Wrap around to first
      next = sorted[0];
    }

    const pos = next.range.start;
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(next.range, vscode.TextEditorRevealType.InCenter);
  }

  /**
   * Jump to previous diagnostic in active text editor.
   */
  public jumpToPrevious(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diags = vscode.languages.getDiagnostics(editor.document.uri);
    if (diags.length === 0) {
      vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME} Lens: No issues found in current file.`);
      return;
    }

    const currentLine = editor.selection.active.line;
    const sorted = [...diags].sort((a, b) => b.range.start.line - a.range.start.line);

    let prev = sorted.find((d) => d.range.start.line < currentLine);
    if (!prev) {
      // Wrap around to last
      prev = sorted[0];
    }

    const pos = prev.range.start;
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(prev.range, vscode.TextEditorRevealType.InCenter);
  }

  public dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.disposables.forEach((d) => d.dispose());
    this.statusBarItem.dispose();
  }
}
