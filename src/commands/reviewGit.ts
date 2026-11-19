import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SidebarProvider } from '../providers/sidebarProvider';
import { WorkspaceReviewEngine } from '../core/workspaceReviewEngine';

export function registerReviewGitCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: SidebarProvider
): vscode.Disposable[] {
  const logger = Logger.getInstance();

  const reviewGitDisposable = vscode.commands.registerCommand('fixora.reviewGit', async () => {
    logger.info('User initiated Git unstaged review.');
    const workspaceEngine = WorkspaceReviewEngine.getInstance();
    await workspaceEngine.reviewGitChanges(false);
  });

  const reviewStagedDisposable = vscode.commands.registerCommand('fixora.reviewStaged', async () => {
    logger.info('User initiated Git staged review.');
    const workspaceEngine = WorkspaceReviewEngine.getInstance();
    await workspaceEngine.reviewGitChanges(true);
  });

  return [reviewGitDisposable, reviewStagedDisposable];
}
