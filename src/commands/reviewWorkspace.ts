import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { WorkspaceReviewEngine } from '../core/workspaceReviewEngine';

export function registerReviewWorkspaceCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable {
  const logger = Logger.getInstance();

  return vscode.commands.registerCommand('fixora.reviewWorkspace', async () => {
    logger.info('User initiated Workspace Review command.');
    const workspaceEngine = WorkspaceReviewEngine.getInstance();
    await workspaceEngine.reviewWorkspace();
  });
}
