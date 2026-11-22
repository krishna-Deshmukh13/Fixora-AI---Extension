import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { DebuggerEngine } from '../core/debuggerEngine';
import { BRANDING } from '../constants/branding';

export function registerExplainTerminalCommand(
  _context: vscode.ExtensionContext,
  _sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.explainTerminal', async () => {
    // Smart clipboard pre-detection: if clipboard contains stack trace keywords, prefill it!
    let clipboardPrefill = '';
    try {
      const clipText = await vscode.env.clipboard.readText();
      if (
        clipText &&
        clipText.trim().length > 10 &&
        (clipText.includes('Error') ||
          clipText.includes('Exception') ||
          clipText.includes('Traceback') ||
          clipText.includes('at ') ||
          clipText.includes('line '))
      ) {
        clipboardPrefill = clipText.trim();
      }
    } catch {
      // Clipboard read fallback
    }

    const errorText = await vscode.window.showInputBox({
      title: `${BRANDING.PRODUCT_NAME}: Explain Terminal Error & Stack Trace`,
      prompt: 'Paste the error message, compiler log, or stack trace from your terminal',
      value: clipboardPrefill,
      placeHolder: 'e.g. ReferenceError: process is not defined at Object.<anonymous> (/app/index.js:15:3)',
      ignoreFocusOut: true,
    });

    if (!errorText || errorText.trim().length === 0) {
      return;
    }

    logger.info(`Received terminal error to explain (${errorText.length} chars).`);
    const debuggerEngine = DebuggerEngine.getInstance();
    await debuggerEngine.explainTerminalError(errorText.trim());
  });
}
