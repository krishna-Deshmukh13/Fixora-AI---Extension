import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';

/**
 * Manages local Git hooks for offline automated pre-commit scanning.
 */
export class GitHookManager {
  private static logger = Logger.getInstance();

  /**
   * Installs a lightweight pre-commit guard into .git/hooks/pre-commit.
   */
  public static async installPreCommitHook(): Promise<boolean> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: Open a workspace with a Git repository first.`);
      return false;
    }

    const rootPath = folders[0].uri.fsPath;
    const gitDir = path.join(rootPath, '.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const hookFile = path.join(hooksDir, 'pre-commit');

    if (!fs.existsSync(gitDir)) {
      vscode.window.showWarningMessage(`${BRANDING.PRODUCT_NAME}: No .git directory found in current workspace. Run "git init" first.`);
      return false;
    }

    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookScript = `#!/bin/sh
# ${BRANDING.PRODUCT_NAME} Pre-Commit Guard (Offline Security Scanner)
echo "🔒 ${BRANDING.PRODUCT_NAME}: Checking staged files for exposed secrets..."

# Check for AWS, Google, GitHub, or Private Keys
SECRETS=$(git diff --cached --name-only | xargs grep -E "(AIza[0-9A-Za-z-_]{35}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|BEGIN RSA PRIVATE KEY|sk_live_[0-9a-zA-Z]{24})" 2>/dev/null)

if [ -n "$SECRETS" ]; then
  echo "❌ ${BRANDING.PRODUCT_NAME}: Commit BLOCKED! Potential hardcoded credentials detected in staged changes:"
  echo "$SECRETS"
  echo "Please remove secrets or use environment variables before committing."
  exit 1
fi

echo "✅ ${BRANDING.PRODUCT_NAME}: Pre-commit secret check passed."
exit 0
`;

    try {
      fs.writeFileSync(hookFile, hookScript, { mode: 0o755 });
      GitHookManager.logger.info(`Installed Git pre-commit hook at ${hookFile}`);
      vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME}: Pre-commit security hook installed successfully into .git/hooks!`);
      return true;
    } catch (err: any) {
      GitHookManager.logger.error('Failed to install Git hook', err);
      vscode.window.showErrorMessage(`${BRANDING.PRODUCT_NAME}: Failed to install Git hook: ${err?.message || err}`);
      return false;
    }
  }
}
