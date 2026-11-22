import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { PrettierFormatter } from '../../src/formatter/prettierFormatter';

describe('PrettierFormatter (Built-in Prettier Clone)', () => {
  const formatter = PrettierFormatter.getInstance();

  it('should format unformatted JavaScript code with consistent quotes and semicolons', async () => {
    const rawJs = 'const  x= {a: 1 , b :  2 };';
    const mockDoc = {
      getText: () => rawJs,
      languageId: 'javascript',
      fileName: 'test.js',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(1);
    expect(edits[0].newText).toContain("const x = { a: 1, b: 2 };");
  });

  it('should format TypeScript code correctly', async () => {
    const rawTs = 'interface  User  {id :string ;age: number ;}';
    const mockDoc = {
      getText: () => rawTs,
      languageId: 'typescript',
      fileName: 'user.ts',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(1);
    expect(edits[0].newText).toContain('interface User {');
    expect(edits[0].newText).toContain('id: string;');
  });

  it('should format JSON documents with correct indentation', async () => {
    const rawJson = '{"name":"fixora","features":["ai","formatter","error-lens"]}';
    const mockDoc = {
      getText: () => rawJson,
      languageId: 'json',
      fileName: 'manifest.json',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(1);
    expect(edits[0].newText).toContain('"name": "fixora"');
    expect(edits[0].newText).toContain('"formatter"');
  });

  it('should format HTML documents with proper tag indentation', async () => {
    const rawHtml = '<div class="card"><h1>Title</h1><p>Description</p></div>';
    const mockDoc = {
      getText: () => rawHtml,
      languageId: 'html',
      fileName: 'index.html',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(1);
    expect(edits[0].newText).toContain('<div class="card">');
    expect(edits[0].newText).toContain('  <h1>Title</h1>');
  });

  it('should return empty edits when code is already formatted', async () => {
    const formatted = "const a = 1;\n";
    const mockDoc = {
      getText: () => formatted,
      languageId: 'javascript',
      fileName: 'app.js',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(0);
  });

  it('should auto-heal broken syntax with stray tokens and format without popups', async () => {
    const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');

    // Code with stray trailing pipe '|' at EOF (as reported by user)
    const codeWithStray = `
function getStatus() {
  return "active";
}
|
`;
    const mockDoc = {
      getText: () => codeWithStray,
      languageId: 'javascript',
      fileName: 'broken.js',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    // Should heal and format successfully
    expect(edits.length).toBe(1);
    expect(edits[0].newText).toContain('getStatus');
    expect(edits[0].newText).toContain('active');
    expect(edits[0].newText).not.toContain('|');
    // Pop up warning should NEVER be shown!
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should auto-heal unclosed brackets and format without popups', async () => {
    const warnSpy = vi.spyOn(vscode.window, 'showWarningMessage');

    const unclosedCode = `
function calculateTotal(items) {
  const sum = items.reduce((acc, curr) => acc + curr, 0);
  return sum;
`;
    const mockDoc = {
      getText: () => unclosedCode,
      languageId: 'javascript',
      fileName: 'unclosed.js',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(1);
    expect(edits[0].newText).toContain('return sum;');
    expect(edits[0].newText.trim().endsWith('}')).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should skip formatting when file matches excludePatterns', async () => {
    const rawJs = 'const x = { a: 1 };';
    const mockDoc = {
      getText: () => rawJs,
      languageId: 'javascript',
      fileName: '/project/node_modules/pkg/index.js',
      positionAt: (idx: number) => new vscode.Position(0, idx),
    } as any;

    const edits = await formatter.provideDocumentFormattingEdits(
      mockDoc,
      { tabSize: 2, insertSpaces: true },
      {} as any
    );

    expect(edits.length).toBe(0);
  });

  it('should correctly detect ignored files via isPrettierIgnored', () => {
    expect(typeof formatter.isPrettierIgnored).toBe('function');
    // Non-existent or non-matching file returns false
    expect(formatter.isPrettierIgnored('')).toBe(false);
  });
});
