export const Uri = {
  file: (f: string) => ({ fsPath: f, path: f, scheme: 'file', toString: () => f }),
  parse: (s: string) => ({ fsPath: s, path: s, scheme: 'file', toString: () => s }),
  joinPath: (base: any, ...parts: string[]) => {
    const joined = [base.fsPath || base.path, ...parts].join('/');
    return { fsPath: joined, path: joined, scheme: 'file', toString: () => joined };
  },
};

export class CodeAction {
  public command?: any;
  public edit?: WorkspaceEdit;
  public isPreferred?: boolean;
  public diagnostics?: Diagnostic[];
  constructor(public title: string, public kind?: CodeActionKind) {}
}

export class CodeActionKind {
  public static readonly QuickFix = new CodeActionKind('quickfix');
  public static readonly Refactor = new CodeActionKind('refactor');
  public static readonly RefactorRewrite = new CodeActionKind('refactor.rewrite');
  constructor(public readonly value: string) {}
}

export enum DecorationRangeBehavior {
  OpenOpen = 0,
  ClosedClosed = 1,
  OpenClosed = 2,
  ClosedOpen = 3,
}

export class EventEmitter<T = any> {
  private listeners: Array<(e: T) => any> = [];
  public event = (listener: (e: T) => any) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  public fire(data: T): void {
    this.listeners.forEach((l) => l(data));
  }
  public dispose(): void {
    this.listeners = [];
  }
}

export class WorkspaceEdit {
  public entries: Array<{ uri: any; range: Range; newText: string }> = [];
  public replace(uri: any, range: Range, newText: string): void {
    this.entries.push({ uri, range, newText });
  }
}

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;
  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(start: Position, end: Position);
  constructor(arg1: any, arg2: any, arg3?: any, arg4?: any) {
    if (typeof arg1 === 'number') {
      this.start = new Position(arg1, arg2);
      this.end = new Position(arg3, arg4);
    } else {
      this.start = arg1;
      this.end = arg2;
    }
  }
}

export class Selection extends Range {
  constructor(anchor: Position, active: Position) {
    super(anchor, active);
  }
  get anchor(): Position {
    return this.start;
  }
  get active(): Position {
    return this.end;
  }
  get isEmpty(): boolean {
    return this.start.line === this.end.line && this.start.character === this.end.character;
  }
}

export class TextEdit {
  constructor(public range: Range, public newText: string) {}
  public static replace(range: Range, newText: string): TextEdit {
    return new TextEdit(range, newText);
  }
}

export class MarkdownString {
  public value: string = '';
  public isTrusted: boolean = false;
  constructor(value: string = '') {
    this.value = value;
  }
  public appendMarkdown(val: string): this {
    this.value += val;
    return this;
  }
  public appendCodeblock(code: string, language?: string): this {
    this.value += `\n\`\`\`${language || ''}\n${code}\n\`\`\`\n`;
    return this;
  }
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum OverviewRulerLane {
  Left = 1,
  Center = 2,
  Right = 4,
  Full = 7,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Diagnostic {
  public code?: string | number | { value: string | number; target: any };
  public source?: string;
  constructor(public range: Range, public message: string, public severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export const window = {
  createOutputChannel: (name: string) => ({
    name,
    append: () => {},
    appendLine: () => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  createTextEditorDecorationType: (_options: any) => ({
    dispose: () => {},
    key: 'mock-decoration',
  }),
  createStatusBarItem: (_alignment?: any, _priority?: number) => ({
    text: '',
    tooltip: '',
    command: '',
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async (..._args: any[]) => {},
  showWarningMessage: async (..._args: any[]) => {},
  showErrorMessage: async (..._args: any[]) => {},
  setStatusBarMessage: (_msg: string, _timeout?: number) => ({ dispose: () => {} }),
  showInputBox: async () => undefined,
  showQuickPick: async () => undefined,
  activeTextEditor: undefined,
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
  withProgress: async (_options: any, task: (progress: any, token: any) => Promise<any>) => {
    const progress = { report: () => {} };
    const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
    return await task(progress, token);
  },
};

export const workspace = {
  getConfiguration: () => ({
    get: (key: string, defaultValue: any) => defaultValue,
    update: async () => {},
  }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
  onDidOpenTextDocument: () => ({ dispose: () => {} }),
  workspaceFolders: [] as any[],
  findFiles: async (..._args: any[]) => [] as any[],
  openTextDocument: async () => ({}),
  applyEdit: async () => true,
};

export const commands = {
  registerCommand: (id: string, callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
  executeCommand: async () => {},
};

export const languages = {
  createDiagnosticCollection: (name: string) => ({
    name,
    set: () => {},
    delete: () => {},
    clear: () => {},
    dispose: () => {},
    get: () => [],
    forEach: () => {},
  }),
  getDiagnostics: () => [],
  onDidChangeDiagnostics: () => ({ dispose: () => {} }),
  registerCodeActionsProvider: () => ({ dispose: () => {} }),
  registerDocumentFormattingEditProvider: () => ({ dispose: () => {} }),
  registerDocumentRangeFormattingEditProvider: () => ({ dispose: () => {} }),
};

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export const env = {
  openExternal: async (_uri: any) => true,
  clipboard: {
    writeText: async (_text: string) => {},
    readText: async () => '',
  },
};

export const TextEditorRevealType = {
  Default: 0,
  InCenter: 1,
  InCenterIfOutsideViewport: 2,
  AtTop: 3,
};
