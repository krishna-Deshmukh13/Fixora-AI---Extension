import * as vscode from 'vscode';

/**
 * Provides virtual document content for side-by-side diff previews.
 */
export class FixoraDiffContentProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = 'fixora-diff';
  private static instance: FixoraDiffContentProvider;

  private contents = new Map<string, string>();
  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  public static getInstance(): FixoraDiffContentProvider {
    if (!FixoraDiffContentProvider.instance) {
      FixoraDiffContentProvider.instance = new FixoraDiffContentProvider();
    }
    return FixoraDiffContentProvider.instance;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) || '';
  }

  public setContent(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this.onDidChangeEmitter.fire(uri);
  }

  public clearContent(uri: vscode.Uri): void {
    this.contents.delete(uri.toString());
  }
}
