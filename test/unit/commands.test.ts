import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerAllCommands } from '../../src/commands';
import { SidebarProvider } from '../../src/providers/sidebarProvider';

describe('registerAllCommands', () => {
  it('should register all 29 extension commands into context.subscriptions', () => {
    const subscriptions: vscode.Disposable[] = [];
    const mockContext: any = {
      subscriptions,
      extensionUri: vscode.Uri.file('/app'),
      secrets: {
        get: async () => undefined,
        store: async () => {},
      },
      globalState: {
        get: () => undefined,
        update: async () => {},
      },
    };

    const mockSidebar = new SidebarProvider(mockContext.extensionUri, mockContext);

    // Track registered command names
    const registeredCommands: string[] = [];
    const origRegisterCommand = vscode.commands.registerCommand;
    vi.spyOn(vscode.commands, 'registerCommand').mockImplementation((id: string, callback: any) => {
      registeredCommands.push(id);
      return { dispose: () => {} };
    });

    registerAllCommands(mockContext, mockSidebar);

    expect(registeredCommands.length).toBe(29);
    expect(registeredCommands).toContain('fixora.openDashboard');
    expect(registeredCommands).toContain('fixora.reviewSelection');
    expect(registeredCommands).toContain('fixora.reviewFile');
    expect(registeredCommands).toContain('fixora.reviewWorkspace');
    expect(registeredCommands).toContain('fixora.reviewGit');
    expect(registeredCommands).toContain('fixora.reviewStaged');
    expect(registeredCommands).toContain('fixora.explainError');
    expect(registeredCommands).toContain('fixora.explainTerminal');
    expect(registeredCommands).toContain('fixora.fixIssue');
    expect(registeredCommands).toContain('fixora.securityScan');
    expect(registeredCommands).toContain('fixora.performanceReview');
    expect(registeredCommands).toContain('fixora.qualityReview');
    expect(registeredCommands).toContain('fixora.learningMode');
    expect(registeredCommands).toContain('fixora.clearDiagnostics');
    expect(registeredCommands).toContain('fixora.viewHistory');
    expect(registeredCommands).toContain('fixora.configureApiKey');
    expect(registeredCommands).toContain('fixora.selectModel');
    expect(registeredCommands).toContain('fixora.configureExcludedFiles');
    expect(registeredCommands).toContain('fixora.exportReport');
    expect(registeredCommands).toContain('fixora.installGitHook');
    expect(registeredCommands).toContain('fixora.analyzeComplexity');
    expect(registeredCommands).toContain('fixora.toggleInlineDiagnostics');
    expect(registeredCommands).toContain('fixora.nextDiagnostic');
    expect(registeredCommands).toContain('fixora.previousDiagnostic');
    expect(registeredCommands).toContain('fixora.formatDocument');
    expect(registeredCommands).toContain('fixora.formatSelection');
    expect(registeredCommands).toContain('fixora.toggleComplexityLens');
    expect(registeredCommands).toContain('fixora.toggleFormatter');
    expect(registeredCommands).toContain('fixora.toggleLinter');

    expect(subscriptions.length).toBeGreaterThanOrEqual(29);
    vi.restoreAllMocks();
  });
});
