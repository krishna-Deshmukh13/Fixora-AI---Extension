# Fixora AI Developer Guide

This guide describes the internal architecture of Fixora AI and provides instructions for developers who want to extend its capabilities, add new AI providers, or add static analyzers.

---

## Architecture Design

Fixora AI follows a decoupled, modular design pattern:

```
src/
├── ai/                      # AI abstraction layer & providers
│   ├── aiManager.ts         # Coordinates API key retrieval, timeouts, and quota budgeting
│   ├── promptManager.ts     # Constructs structured prompts with strict JSON schemas
│   ├── responseParser.ts    # Zod schema validation & markdown extraction
│   └── providers/
│       ├── provider.ts      # AIProvider interface contract
│       └── geminiProvider.ts# Official @google/genai SDK integration
├── analyzers/               # Deterministic static analyzer adapters
│   ├── analyzerManager.ts   # Checks tool presence via safe process execution
│   └── languageAdapters/    # Adapters for ESLint, Ruff, Clang-Tidy, PHPStan, etc.
├── commands/                # VS Code command registrations
├── core/                    # Core business logic engines
│   ├── reviewEngine.ts      # Orchestrates single-file and snippet reviews
│   ├── workspaceReviewEngine.ts # Multi-file & Git working-tree analysis
│   ├── bugDetector.ts       # Deterministic regex heuristics fused with AI findings
│   ├── debuggerEngine.ts    # 7-question error explanation and stack trace parsing
│   ├── securityEngine.ts    # OWASP audit engine and safety disclaimers
│   └── performanceEngine.ts # Algorithmic and runtime bottleneck detection
├── diagnostics/             # Problems panel & CodeAction lightbulb integrations
├── fixes/                   # Diff provider & WorkspaceEdit application
├── history/                 # GlobalState persistence for audit history
├── providers/               # WebviewViewProvider for the sidebar dashboard
├── security/                # PrivacyManager & SecretDetector for client-side redaction
├── types/                   # Unified TypeScript interfaces
└── utils/                   # ProcessManager, FileUtils, Logger, Nonce
```

---

## How to Add a New AI Provider

Fixora AI is designed with an extensible `AIProvider` interface. To add a new provider (e.g. OpenAI or Anthropic):

1. **Implement `AIProvider` in `src/ai/providers/<providerName>Provider.ts`**:
   ```typescript
   import { AIProvider } from './provider';
   import { AIAnalysisOptions, ReviewResult, ErrorExplanationOptions, ErrorExplanation } from '../../types';

   export class CustomProvider implements AIProvider {
     public readonly name = 'Custom AI';
     public readonly id = 'custom';

     constructor(private apiKey: string, private model: string) {}

     public isConfigured(): boolean {
       return Boolean(this.apiKey && this.apiKey.length > 0);
     }

     public async reviewCode(options: AIAnalysisOptions): Promise<ReviewResult> {
       // Format request according to provider API specs
       // Validate response against RawReviewResponseSchema using ResponseParser
     }

     public async explainError(options: ErrorExplanationOptions): Promise<ErrorExplanation> {
       // Explain error and return typed ErrorExplanation
     }
   }
   ```

2. **Register the Provider in `src/ai/aiManager.ts`**:
   Add a factory switch based on the `fixora.provider` configuration setting.

---

## How to Add a New Static Analyzer

1. **Implement `AnalyzerAdapter` in `src/analyzers/languageAdapters/<adapterName>.ts`**:
   ```typescript
   import { AnalyzerAdapter } from '../analyzerManager';
   import { ProcessManager } from '../../utils/processManager';
   import { ReviewFinding } from '../../types';

   export class MyAnalyzerAdapter implements AnalyzerAdapter {
     public readonly name = 'MyAnalyzer';
     public readonly languageId = 'mylang';
     public readonly binaryName = 'myanalyzer';

     public async isAvailable(): Promise<boolean> {
       const res = await ProcessManager.execute(this.binaryName, ['--version']);
       return res.exitCode === 0;
     }

     public async analyze(filePath: string): Promise<ReviewFinding[]> {
       const res = await ProcessManager.execute(this.binaryName, ['--format=json', filePath]);
       // Parse stdout into ReviewFinding[]
     }

     public getInstallInstructions(): string {
       return 'Install MyAnalyzer via: npm install -g myanalyzer';
     }
   }
   ```

2. **Register the adapter in `AnalyzerManager.ts`**.

---

## Running and Adding Tests

Fixora AI uses **Vitest** for fast, reliable unit testing with a comprehensive VS Code API mock located at `test/mocks/vscode.ts`.

- Run all unit tests:
  ```powershell
  npm run test:unit
  ```
- Run tests in watch mode:
  ```powershell
  npm run test:watch
  ```
- Compile the TypeScript bundle:
  ```powershell
  npm run compile
  ```

---

## Local Debugging

1. Open the Fixora AI repository in Visual Studio Code.
2. Press `F5` (Run Extension).
3. A new **Extension Development Host** window will launch with Fixora AI loaded.
4. Set breakpoints in any `src/` file to inspect execution during commands.
