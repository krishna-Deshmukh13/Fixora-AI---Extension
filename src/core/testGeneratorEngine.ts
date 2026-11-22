import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIManager } from '../ai/aiManager';
import { PromptManager } from '../ai/promptManager';
import { ResponseParser } from '../ai/responseParser';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';

export interface GeneratedTestResult {
  framework: string;
  testCode: string;
  testFilePath: string;
  dependenciesNeeded: string[];
  testCasesSummary: string[];
}

/**
 * AI-powered unit test generator with framework detection and safe previewing.
 */
export class TestGeneratorEngine {
  private static instance: TestGeneratorEngine;
  private logger = Logger.getInstance();

  private constructor(private readonly aiManager: AIManager) {}

  public static initialize(aiManager: AIManager): TestGeneratorEngine {
    if (!TestGeneratorEngine.instance) {
      TestGeneratorEngine.instance = new TestGeneratorEngine(aiManager);
    }
    return TestGeneratorEngine.instance;
  }

  public static getInstance(): TestGeneratorEngine {
    if (!TestGeneratorEngine.instance) {
      throw new Error('TestGeneratorEngine must be initialized before use.');
    }
    return TestGeneratorEngine.instance;
  }

  /**
   * Detects active test runner / framework from workspace configuration.
   */
  public detectTestFramework(filePath: string, languageId: string): string {
    const folders = vscode.workspace.workspaceFolders;
    const root = folders && folders.length > 0 ? folders[0].uri.fsPath : '';

    if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
      if (root) {
        if (
          fs.existsSync(path.join(root, 'vitest.config.ts')) ||
          fs.existsSync(path.join(root, 'vitest.config.js'))
        ) {
          return 'vitest';
        }
        if (
          fs.existsSync(path.join(root, 'jest.config.js')) ||
          fs.existsSync(path.join(root, 'jest.config.ts'))
        ) {
          return 'jest';
        }
        const pkgPath = path.join(root, 'package.json');
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps.vitest) return 'vitest';
            if (deps.jest) return 'jest';
            if (deps.mocha) return 'mocha';
          } catch {
            // ignore
          }
        }
      }
      return 'vitest';
    }

    if (languageId === 'python') {
      if (root && (fs.existsSync(path.join(root, 'pytest.ini')) || fs.existsSync(path.join(root, 'setup.cfg')))) {
        return 'pytest';
      }
      return 'pytest';
    }

    if (languageId === 'java') {
      return 'junit5';
    }

    return 'default';
  }

  /**
   * Generates comprehensive unit tests for given source code.
   */
  public async generateTests(
    code: string,
    filePath: string,
    languageId: string,
    cancellationToken?: vscode.CancellationToken
  ): Promise<GeneratedTestResult> {
    const framework = this.detectTestFramework(filePath, languageId);
    const prompt = PromptManager.buildTestGenerationPrompt(code, filePath, languageId, framework);

    const isConfigured = await this.aiManager.isConfigured();
    if (!isConfigured) {
      throw new Error(`${BRANDING.PRODUCT_NAME} requires an active AI provider to generate unit tests.`);
    }

    this.logger.info(`Generating ${framework} unit tests for ${filePath}`);

    let rawOutput = '';
    await this.aiManager.streamChat(
      prompt,
      (chunk) => {
        rawOutput += chunk;
      },
      PromptManager.getSystemInstruction(false),
      cancellationToken
    );

    try {
      const jsonStr = ResponseParser.extractJson(rawOutput);
      const parsed = JSON.parse(jsonStr);

      return {
        framework: parsed.framework || framework,
        testCode: parsed.testCode || rawOutput,
        testFilePath: parsed.testFilePath || this.suggestTestFilePath(filePath),
        dependenciesNeeded: Array.isArray(parsed.dependenciesNeeded) ? parsed.dependenciesNeeded : [],
        testCasesSummary: Array.isArray(parsed.testCasesSummary) ? parsed.testCasesSummary : [],
      };
    } catch {
      // Graceful fallback if model output is raw test code
      return {
        framework,
        testCode: rawOutput.replace(/```[a-z]*\n?/gi, ''),
        testFilePath: this.suggestTestFilePath(filePath),
        dependenciesNeeded: [],
        testCasesSummary: ['Automated test suite'],
      };
    }
  }

  /**
   * Derives a conventional test file path based on source file.
   */
  public suggestTestFilePath(srcPath: string): string {
    const ext = path.extname(srcPath);
    const base = path.basename(srcPath, ext);
    const dir = path.dirname(srcPath);

    let res: string;
    if (ext === '.py') {
      res = path.join(dir, `test_${base}.py`);
    } else if (ext === '.java') {
      res = path.join(dir, `${base}Test.java`);
    } else {
      res = path.join(dir, `${base}.test${ext}`);
    }
    return res.replace(/\\/g, '/');
  }

  /**
   * Safely opens generated test code in a new untitled editor tab for user review.
   */
  public async previewInEditor(testResult: GeneratedTestResult, languageId: string): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({
      content: testResult.testCode,
      language: languageId,
    });
    await vscode.window.showTextDocument(doc, { preview: true });
    vscode.window.showInformationMessage(
      `${BRANDING.PRODUCT_NAME}: Generated ${testResult.framework} test preview (${testResult.testCasesSummary.length} test cases).`
    );
  }

  /**
   * Safely saves generated test file after explicit user confirmation.
   */
  public async saveTestFile(testResult: GeneratedTestResult, targetPath?: string): Promise<boolean> {
    const dest = targetPath || testResult.testFilePath;
    const confirm = await vscode.window.showInformationMessage(
      `Save generated tests to "${dest}"?`,
      { modal: true },
      'Save File'
    );

    if (confirm !== 'Save File') {
      return false;
    }

    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(dest, testResult.testCode, 'utf8');
    vscode.window.showInformationMessage(`${BRANDING.PRODUCT_NAME}: Test file saved to "${dest}".`);
    return true;
  }
}
