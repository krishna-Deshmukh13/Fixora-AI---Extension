import { describe, it, expect, vi } from 'vitest';
import { getNonce, SidebarProvider } from '../../src/providers/sidebarProvider';
import * as vscode from 'vscode';

describe('SidebarProvider & Webview Foundation', () => {
  it('should generate a 32-character alphanumeric nonce', () => {
    const nonce1 = getNonce();
    const nonce2 = getNonce();

    expect(nonce1).toBeDefined();
    expect(nonce1.length).toBe(32);
    expect(nonce2.length).toBe(32);
    // Nonces must be unique
    expect(nonce1).not.toBe(nonce2);
    // Only alphanumeric
    expect(/^[A-Za-z0-9]+$/.test(nonce1)).toBe(true);
  });

  it('should construct CSP compliant HTML with required headers and nonces', () => {
    const mockWebview: any = {
      cspSource: 'vscode-webview:',
      asWebviewUri: (uri: any) => uri.toString(),
    };

    const mockExtensionUri: any = {
      toString: () => 'vscode-resource:/path/to/extension',
      fsPath: '/path/to/extension',
    };

    const mockContext: any = {
      subscriptions: [],
      workspaceState: {
        get: (_k: string, d: any) => d,
        update: async () => {},
      },
      globalState: {
        get: (_k: string, d: any) => d,
        update: async () => {},
      },
    };

    const provider = new SidebarProvider(mockExtensionUri, mockContext);
    const html = provider.getHtmlForWebview(mockWebview, false, 'gemini-2.5-flash', false, 'test-nonce-fixed');

    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("script-src 'nonce-test-nonce-fixed'");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("Fixora AI");
    expect(html).toContain("toggle-linter");
    expect(html).toContain("toggle-error-lens");
    expect(html).toContain("toggle-complexity-lens");
    expect(html).toContain("toggle-formatter");
    expect(html).toContain("btn-review-selection");
    expect(html).toContain("btn-review-file");
    expect(html).toContain("btn-security-scan");
  });

  it('should handle incoming webview messages gracefully', async () => {
    const mockExtensionUri: any = {
      toString: () => 'vscode-resource:/path/to/extension',
      fsPath: '/path/to/extension',
    };

    const mockContext: any = {
      subscriptions: [],
      workspaceState: {
        get: (_k: string, d: any) => d,
        update: async () => {},
      },
      globalState: {
        get: (_k: string, d: any) => d,
        update: async () => {},
      },
    };

    const provider = new SidebarProvider(mockExtensionUri, mockContext);
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    await provider.handleWebviewMessage({ type: 'runReviewSelection' });
    expect(executeCommandSpy).toHaveBeenCalledWith('fixora.reviewSelection');

    await provider.handleWebviewMessage({ type: 'runReviewFile' });
    expect(executeCommandSpy).toHaveBeenCalledWith('fixora.reviewFile');

    await provider.handleWebviewMessage({ type: 'runSecurityScan' });
    expect(executeCommandSpy).toHaveBeenCalledWith('fixora.securityScan');

    await provider.handleWebviewMessage({ type: 'clearDiagnostics' });
    expect(executeCommandSpy).toHaveBeenCalledWith('fixora.clearDiagnostics');
  });

  it('should update stats and recent files upon displayReviewResult', () => {
    const mockExtensionUri: any = {
      toString: () => 'vscode-resource:/path/to/extension',
      fsPath: '/path/to/extension',
    };

    let savedState: any = null;
    const mockContext: any = {
      subscriptions: [],
      workspaceState: {
        get: (_k: string, d: any) => d,
        update: async () => {},
      },
      globalState: {
        get: (_k: string, d: any) => d,
        update: async (k: string, v: any) => {
          savedState = v;
        },
      },
    };

    const provider = new SidebarProvider(mockExtensionUri, mockContext);
    provider.displayReviewResult({
      summary: 'Found 2 issues in test.ts',
      findings: [],
      durationMs: 120,
      filesAnalyzed: ['src/test.ts'],
      providerName: 'Gemini',
      modelName: 'gemini-2.5-flash',
      timestamp: new Date().toISOString(),
      totalIssues: 2,
      criticalCount: 1,
      warningCount: 1,
      infoCount: 0,
    });

    expect(savedState).toBeDefined();
    expect(savedState.totalReviews).toBe(1);
    expect(savedState.totalIssuesDetected).toBe(2);
    expect(savedState.criticalCount).toBe(1);
    expect(savedState.warningCount).toBe(1);
  });
});
