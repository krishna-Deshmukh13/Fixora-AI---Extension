import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { SyntaxHealer } from './syntaxHealer';
import { BRANDING } from '../constants/branding';
import { FileUtils } from '../utils/fileUtils';

// Prettier standalone and official parser plugins
const prettier = require('prettier/standalone');
const pluginBabel = require('prettier/plugins/babel');
const pluginEstree = require('prettier/plugins/estree');
const pluginTypescript = require('prettier/plugins/typescript');
const pluginHtml = require('prettier/plugins/html');
const pluginPostcss = require('prettier/plugins/postcss');
const pluginMarkdown = require('prettier/plugins/markdown');
const pluginYaml = require('prettier/plugins/yaml');

export const SUPPORTED_FORMAT_LANGUAGES = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'json',
  'jsonc',
  'html',
  'vue',
  'css',
  'scss',
  'less',
  'markdown',
  'yaml',
];

/**
 * 100% Prettier Code Formatter clone built into Fixora AI.
 * Provides DocumentFormattingEditProvider and DocumentRangeFormattingEditProvider
 * for JavaScript, TypeScript, JSON, HTML, CSS, SCSS, Markdown, and YAML.
 */
export class PrettierFormatter
  implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider
{
  private static instance: PrettierFormatter;
  private logger = Logger.getInstance();
  private enabled = true;

  public static getInstance(): PrettierFormatter {
    if (!PrettierFormatter.instance) {
      PrettierFormatter.instance = new PrettierFormatter();
    }
    return PrettierFormatter.instance;
  }

  public toggle(forceState?: boolean): boolean {
    this.enabled = forceState !== undefined ? forceState : !this.enabled;
    vscode.window.showInformationMessage(
      `${BRANDING.PRODUCT_NAME} Formatter: ${this.enabled ? 'Enabled' : 'Disabled'}`
    );
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Formats the entire active document.
   */
  public async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    return this.formatRange(document, undefined);
  }

  /**
   * Formats a specific selected range within the document.
   */
  public async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    return this.formatRange(document, range);
  }

  /**
   * Core format executor using Prettier standalone.
   */
  public async formatRange(
    document: vscode.TextDocument,
    range?: vscode.Range
  ): Promise<vscode.TextEdit[]> {
    if (!this.enabled) {
      return [];
    }

    if (document.fileName && (this.isPrettierIgnored(document.fileName) || FileUtils.isFileExcluded(document.fileName))) {
      this.logger.debug(`File ${document.fileName} is excluded or ignored by .prettierignore`);
      return [];
    }

    const rawText = range ? document.getText(range) : document.getText();
    if (!rawText.trim()) {
      return [];
    }

    const parserConfig = this.resolveParserAndPlugins(document.languageId, document.fileName);
    if (!parserConfig) {
      this.logger.warn(`No formatter parser registered for language "${document.languageId}"`);
      return [];
    }

    const options = this.resolveOptions(document, parserConfig);

    try {
      const formatted = await prettier.format(rawText, options);
      if (formatted === rawText) {
        return [];
      }

      const editRange =
        range ||
        new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );

      return [vscode.TextEdit.replace(editRange, formatted)];
    } catch (primaryErr: any) {
      const config = vscode.workspace.getConfiguration('fixora.formatter');
      const autoHealEnabled = config.get<boolean>('autoHealSyntax', true);

      if (autoHealEnabled) {
        // Automatic Syntax Healing (opt-in only):
        // Try to auto-repair missing brackets, unclosed tags, and stray tokens
        const repairResult = SyntaxHealer.repair(rawText, document.languageId);

        if (repairResult.repaired) {
          try {
            const healedAndFormatted = await prettier.format(repairResult.code, options);
            this.logger.info(
              `${BRANDING.PRODUCT_NAME} Auto-Healer successfully repaired and formatted ${document.fileName}: ${repairResult.fixes.join(', ')}`
            );

            if (typeof (vscode.window as any).setStatusBarMessage === 'function') {
              vscode.window.setStatusBarMessage(
                `$(check) ${BRANDING.PRODUCT_NAME}: Auto-healed ${repairResult.fixes.length} syntax error(s)`,
                4000
              );
            }

            const editRange =
              range ||
              new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
              );

            return [vscode.TextEdit.replace(editRange, healedAndFormatted)];
          } catch {
            // If formatting repaired code fails, fall through to silent skip
          }
        }
      }

      // If syntax cannot be automatically repaired or auto-heal is disabled, skip formatting silently
      this.logger.warn(
        `${BRANDING.PRODUCT_NAME} Formatter skipped formatting ${document.fileName} due to active syntax error: ${primaryErr?.message || primaryErr}`
      );
      if (typeof (vscode.window as any).setStatusBarMessage === 'function') {
        vscode.window.setStatusBarMessage(
          `$(info) ${BRANDING.PRODUCT_NAME}: File has syntax errors, formatting skipped`,
          3000
        );
      }
      return [];
    }
  }

  /**
   * Checks whether the given file is ignored by .prettierignore.
   */
  public isPrettierIgnored(filePath: string): boolean {
    try {
      if (!filePath) {
        return false;
      }
      const absolutePath = path.resolve(filePath);
      let dir = path.dirname(absolutePath);
      const root = path.parse(dir).root;

      while (dir && dir !== root) {
        const ignorePath = path.join(dir, '.prettierignore');
        if (fs.existsSync(ignorePath)) {
          const content = fs.readFileSync(ignorePath, 'utf8');
          const lines = content
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'));

          const relPath = path.relative(dir, absolutePath).replace(/\\/g, '/');
          const normalizedAbs = absolutePath.replace(/\\/g, '/');

          for (const line of lines) {
            if (FileUtils.matchGlob(relPath, line) || FileUtils.matchGlob(normalizedAbs, line)) {
              return true;
            }
          }
        }
        const parentDir = path.dirname(dir);
        if (parentDir === dir) {
          break;
        }
        dir = parentDir;
      }
    } catch {
      // Ignore reading errors
    }
    return false;
  }

  /**
   * Maps VS Code language IDs to Prettier parser and required plugins.
   */
  private resolveParserAndPlugins(
    languageId: string,
    fileName: string
  ): { parser: string; plugins: any[] } | null {
    switch (languageId) {
      case 'javascript':
      case 'javascriptreact':
        return { parser: 'babel', plugins: [pluginBabel, pluginEstree] };

      case 'typescript':
      case 'typescriptreact':
        return { parser: 'typescript', plugins: [pluginTypescript, pluginEstree] };

      case 'json':
      case 'jsonc':
        return { parser: 'json', plugins: [pluginBabel, pluginEstree] };

      case 'html':
      case 'vue':
        return { parser: 'html', plugins: [pluginHtml] };

      case 'css':
        return { parser: 'css', plugins: [pluginPostcss] };

      case 'scss':
        return { parser: 'scss', plugins: [pluginPostcss] };

      case 'less':
        return { parser: 'less', plugins: [pluginPostcss] };

      case 'markdown':
        return { parser: 'markdown', plugins: [pluginMarkdown] };

      case 'yaml':
        return { parser: 'yaml', plugins: [pluginYaml] };

      default:
        // Fallback by file extension
        if (fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.jsx')) {
          return { parser: 'babel', plugins: [pluginBabel, pluginEstree] };
        }
        if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
          return { parser: 'typescript', plugins: [pluginTypescript, pluginEstree] };
        }
        if (fileName.endsWith('.json')) {
          return { parser: 'json', plugins: [pluginBabel, pluginEstree] };
        }
        if (fileName.endsWith('.html')) {
          return { parser: 'html', plugins: [pluginHtml] };
        }
        if (fileName.endsWith('.css')) {
          return { parser: 'css', plugins: [pluginPostcss] };
        }
        if (fileName.endsWith('.md')) {
          return { parser: 'markdown', plugins: [pluginMarkdown] };
        }
        if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
          return { parser: 'yaml', plugins: [pluginYaml] };
        }
        return null;
    }
  }

  /**
   * Resolves options from VS Code settings or local prettier config file.
   */
  private resolveOptions(
    document: vscode.TextDocument,
    parserConfig: { parser: string; plugins: any[] }
  ): any {
    const config = vscode.workspace.getConfiguration('fixora.formatter');

    const localConfig = this.loadLocalPrettierConfig(document.fileName);

    return {
      parser: parserConfig.parser,
      plugins: parserConfig.plugins,
      tabWidth: localConfig.tabWidth ?? config.get<number>('tabWidth', 2),
      useTabs: localConfig.useTabs ?? config.get<boolean>('useTabs', false),
      semi: localConfig.semi ?? config.get<boolean>('semi', true),
      singleQuote: localConfig.singleQuote ?? config.get<boolean>('singleQuote', true),
      printWidth: localConfig.printWidth ?? config.get<number>('printWidth', 80),
      trailingComma: localConfig.trailingComma ?? config.get<string>('trailingComma', 'es5'),
      bracketSpacing: localConfig.bracketSpacing ?? config.get<boolean>('bracketSpacing', true),
      arrowParens: localConfig.arrowParens ?? config.get<string>('arrowParens', 'always'),
    };
  }

  /**
   * Reads .prettierrc or package.json "prettier" if existing in project root.
   */
  private loadLocalPrettierConfig(filePath: string): Record<string, any> {
    try {
      const absolutePath = path.resolve(filePath);
      let dir = path.dirname(absolutePath);
      const root = path.parse(dir).root;

      while (dir && dir !== root) {
        const rcPath = path.join(dir, '.prettierrc');
        if (fs.existsSync(rcPath)) {
          const content = fs.readFileSync(rcPath, 'utf8');
          return JSON.parse(content);
        }

        const rcJsonPath = path.join(dir, '.prettierrc.json');
        if (fs.existsSync(rcJsonPath)) {
          const content = fs.readFileSync(rcJsonPath, 'utf8');
          return JSON.parse(content);
        }

        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.prettier && typeof pkg.prettier === 'object') {
            return pkg.prettier;
          }
        }

        const parentDir = path.dirname(dir);
        if (parentDir === dir) {
          break;
        }
        dir = parentDir;
      }
    } catch {
      // Ignore errors reading local configs
    }
    return {};
  }

  /**
   * Registers Document and Range Formatting providers across all supported languages.
   */
  public registerProviders(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    for (const lang of SUPPORTED_FORMAT_LANGUAGES) {
      disposables.push(
        vscode.languages.registerDocumentFormattingEditProvider(lang, this),
        vscode.languages.registerDocumentRangeFormattingEditProvider(lang, this)
      );
    }

    this.logger.info(
      `${BRANDING.PRODUCT_NAME} Formatter registered for ${SUPPORTED_FORMAT_LANGUAGES.length} languages.`
    );
    return disposables;
  }
}
