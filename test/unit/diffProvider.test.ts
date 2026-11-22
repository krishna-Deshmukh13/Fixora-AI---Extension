import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { FixoraDiffContentProvider } from '../../src/fixes/diffProvider';

describe('FixoraDiffContentProvider', () => {
  it('should be a singleton with fixora-diff scheme', () => {
    const provider1 = FixoraDiffContentProvider.getInstance();
    const provider2 = FixoraDiffContentProvider.getInstance();
    expect(provider1).toBe(provider2);
    expect(FixoraDiffContentProvider.scheme).toBe('fixora-diff');
  });

  it('should set and retrieve document content by URI', () => {
    const provider = FixoraDiffContentProvider.getInstance();
    const testUri = vscode.Uri.parse('fixora-diff:/path/to/file.ts?fix=123');
    const content = 'const fixed = true;\n';

    provider.setContent(testUri, content);
    const retrieved = provider.provideTextDocumentContent(testUri);
    expect(retrieved).toBe(content);
  });

  it('should return empty string for unregistered URI', () => {
    const provider = FixoraDiffContentProvider.getInstance();
    const unregisteredUri = vscode.Uri.parse('fixora-diff:/unknown/file.ts');
    const retrieved = provider.provideTextDocumentContent(unregisteredUri);
    expect(retrieved).toBe('');
  });

  it('should clear stored content', () => {
    const provider = FixoraDiffContentProvider.getInstance();
    const testUri = vscode.Uri.parse('fixora-diff:/path/to/clear.ts');
    provider.setContent(testUri, 'temporary content');
    provider.clearContent(testUri);
    expect(provider.provideTextDocumentContent(testUri)).toBe('');
  });
});
