import * as vscode from 'vscode';
import { StaticAnalyzer } from './staticAnalyzer';
import { ESLintAnalyzer } from './languageAdapters/eslint';
import { RuffAnalyzer } from './languageAdapters/ruff';
import { ClangTidyAnalyzer } from './languageAdapters/clangTidy';
import { PHPStanAnalyzer } from './languageAdapters/phpstan';
import { HTMLHintAnalyzer } from './languageAdapters/htmlhint';
import { StylelintAnalyzer } from './languageAdapters/stylelint';
import { SQLFluffAnalyzer } from './languageAdapters/sqlfluff';
import { CheckstyleAnalyzer } from './languageAdapters/checkstyle';
import { ReviewFinding } from '../types';
import { Logger } from '../utils/logger';

export interface AnalyzerStatus {
  id: string;
  name: string;
  isAvailable: boolean;
  installInstructions: string;
}

/**
 * Manages detection, execution, and normalization of local static analyzers.
 * Strictly adheres to rule: Never pretend an analyzer is available if it is not installed.
 */
export class AnalyzerManager {
  private static instance: AnalyzerManager;
  private analyzers: Map<string, StaticAnalyzer> = new Map();
  private logger = Logger.getInstance();

  private constructor() {
    this.registerAnalyzer(new ESLintAnalyzer());
    this.registerAnalyzer(new RuffAnalyzer());
    this.registerAnalyzer(new ClangTidyAnalyzer());
    this.registerAnalyzer(new PHPStanAnalyzer());
    this.registerAnalyzer(new HTMLHintAnalyzer());
    this.registerAnalyzer(new StylelintAnalyzer());
    this.registerAnalyzer(new SQLFluffAnalyzer());
    this.registerAnalyzer(new CheckstyleAnalyzer());
  }

  public static getInstance(): AnalyzerManager {
    if (!AnalyzerManager.instance) {
      AnalyzerManager.instance = new AnalyzerManager();
    }
    return AnalyzerManager.instance;
  }

  public registerAnalyzer(analyzer: StaticAnalyzer): void {
    this.analyzers.set(analyzer.id, analyzer);
  }

  /**
   * Finds the best static analyzer for a given language ID.
   */
  public getAnalyzerForLanguage(languageId: string): StaticAnalyzer | undefined {
    const lang = languageId.toLowerCase();
    for (const analyzer of this.analyzers.values()) {
      if (analyzer.supportedLanguages.includes(lang)) {
        return analyzer;
      }
    }
    return undefined;
  }

  /**
   * Run static analysis if analyzer is available and enabled in user settings.
   */
  public async runStaticAnalysis(
    filePath: string,
    code: string,
    languageId: string
  ): Promise<ReviewFinding[]> {
    const config = vscode.workspace.getConfiguration('fixora');
    const isEnabled = config.get<boolean>('enableStaticAnalyzers', true);

    if (!isEnabled) {
      this.logger.info('Static analysis disabled in user settings.');
      return [];
    }

    const analyzer = this.getAnalyzerForLanguage(languageId);
    if (!analyzer) {
      this.logger.info(`No static analyzer registered for language: ${languageId}`);
      return [];
    }

    const available = await analyzer.isAvailable();
    if (!available) {
      this.logger.info(
        `Analyzer "${analyzer.name}" is not installed on system. Falling back to AI-only review. Install guidance: ${analyzer.getInstallationInstructions()}`
      );
      return [];
    }

    this.logger.info(`Running ${analyzer.name} on ${filePath}...`);
    try {
      const findings = await analyzer.runAnalysis(filePath, code);
      this.logger.info(`${analyzer.name} reported ${findings.length} findings.`);
      return findings;
    } catch (err: any) {
      this.logger.warn(`Failed running ${analyzer.name}: ${err?.message || err}`);
      return [];
    }
  }

  /**
   * Returns availability status for all known analyzers.
   */
  public async getAnalyzerStatuses(): Promise<AnalyzerStatus[]> {
    const statuses: AnalyzerStatus[] = [];
    for (const analyzer of this.analyzers.values()) {
      const isAvailable = await analyzer.isAvailable();
      statuses.push({
        id: analyzer.id,
        name: analyzer.name,
        isAvailable,
        installInstructions: analyzer.getInstallationInstructions(),
      });
    }
    return statuses;
  }
}
