import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { GitHookManager } from '../../src/git/gitHookManager';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('GitHookManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);
    vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as any);
    vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined as any);
  });

  it('should warn and return false if no workspace folder is open', async () => {
    (vscode.workspace as any).workspaceFolders = [];

    const result = await GitHookManager.installPreCommitHook();
    expect(result).toBe(false);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Open a workspace with a Git repository first')
    );
  });

  it('should warn and return false if .git directory does not exist', async () => {
    (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/repo' } }];
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = await GitHookManager.installPreCommitHook();
    expect(result).toBe(false);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('No .git directory found')
    );
  });

  it('should install pre-commit hook with executable permissions when .git exists', async () => {
    (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/repo' } }];
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return p.toString().endsWith('.git');
    });

    const result = await GitHookManager.installPreCommitHook();
    expect(result).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writtenArgs = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writtenArgs[0].toString()).toContain('pre-commit');
    expect(writtenArgs[1].toString()).toContain('#!/bin/sh');
    expect(writtenArgs[1].toString()).toContain('Fixora AI Pre-Commit Guard');
    expect(writtenArgs[2]).toEqual({ mode: 0o755 });
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('installed successfully')
    );
  });
});
