import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { DebuggerEngine } from '../core/debuggerEngine';

export function registerExplainTerminalCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.explainTerminal', async () => {
    const errorText = await vscode.window.showInputBox({
      title: 'Fixora AI: Explain Terminal Error & Stack Trace',
      prompt: 'Paste the error message, compiler output, or stack trace from your terminal',
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
