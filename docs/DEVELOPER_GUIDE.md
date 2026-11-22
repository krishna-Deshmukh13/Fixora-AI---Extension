# Revion Developer & Architecture Guide

This guide describes the internal architecture of **Revion** and provides instructions for developers who want to extend its capabilities, add AI providers, or add static analyzers.

---

## Architectural Principles & Identity Constraints

1. **Brand Identity Separation**:
   - The user-facing identity is **Revion** ("Revion — Intelligent Code Review & Debugging").
   - For 100% marketplace and installation backwards compatibility, internal IDs (`package.json` `name`: `"fixora-ai"`, `publisher`: `"FixoraFoundation"`, configuration root `"fixora.*"`, commands `"fixora.*"`, and `SecretStorage` keys) are strictly preserved.
   - All branding strings are centralized in `src/constants/branding.ts`.

2. **Zero-Latency Offline-First**:
   - Diagnostics, linters, complexity metrics, and formatters must execute offline with zero network latency.
   - AI calls are strictly opt-in and triggered explicitly by the developer.

3. **Privacy by Design**:
   - Code sent to remote LLMs must pass through client-side redaction (`src/security/secretDetector.ts` and `src/security/privacyManager.ts`).

---

## Codebase Directory Structure

```
src/
├── ai/                      # AI abstraction layer & providers
│   ├── aiManager.ts         # Coordinates API key retrieval, timeouts, and quota budgeting
│   ├── promptManager.ts     # Constructs structured prompts with strict JSON schemas
│   ├── responseParser.ts    # Schema validation & JSON markdown extraction
│   └── providers/
│       ├── provider.ts      # AIProvider interface contract
│       ├── geminiProvider.ts# Official @google/genai SDK integration (Gemini 2.0 Flash)
│       └── ollamaProvider.ts# Offline local Ollama HTTP client
├── analyzers/               # Deterministic static analyzer adapters
│   ├── analyzerManager.ts   # Checks tool presence via safe process execution
│   └── languageAdapters/    # Adapters for ESLint, Ruff, Clang-Tidy, PHPStan
├── commands/                # 29 registered VS Code commands
├── constants/
│   └── branding.ts          # Central Revion brand and configuration constants
├── core/                    # Core business logic engines
│   ├── reviewEngine.ts      # Orchestrates single-file and snippet reviews
│   ├── workspaceReviewEngine.ts # Multi-file & Git working-tree analysis
│   ├── bugDetector.ts       # Deterministic regex heuristics fused with AI findings
│   ├── debuggerEngine.ts    # 7-question error explanation and stack trace parsing
│   ├── securityEngine.ts    # OWASP audit engine and safety disclaimers
│   └── performanceEngine.ts # Algorithmic and runtime bottleneck detection
├── diagnostics/             # Problems panel, ErrorLens, & CodeAction lightbulb integrations
├── fixes/                   # Virtual diff provider & WorkspaceEdit application
├── formatter/               # Prettier formatter and silent syntax auto-healer
├── git/                     # Git diff inspection & pre-commit hook guard
├── history/                 # GlobalState persistence for audit history
├── linter/                  # Real-time multi-language AST linter (JS/TS/Python/HTML/CSS)
├── metrics/                 # Cyclomatic complexity analyzer and complexity lens
├── providers/               # WebviewViewProvider for the sidebar control center
├── reports/                 # Standalone offline HTML report generator
├── security/                # PrivacyManager & SecretDetector for client-side redaction
├── types/                   # Unified TypeScript interfaces & webview message contracts
└── utils/                   # ProcessManager, FileUtils, Logger, Nonce, LanguageDetector
```

---

## How to Add a New AI Provider

Revion is designed with an extensible `AIProvider` interface. To add a new provider:

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
     }

     public async explainError(options: ErrorExplanationOptions): Promise<ErrorExplanation> {
       // Explain error and return typed ErrorExplanation
     }
   }
   ```

2. **Register the Provider in `src/ai/aiManager.ts`**:
   Add a factory case based on the `fixora.provider` configuration setting.

---

## Running and Adding Tests

Revion uses **Vitest** with 34 test suites and 174 passing unit tests:

- **Run all unit tests**:
  ```bash
  npm test
  ```
- **Run tests in watch mode**:
  ```bash
  npm run test:watch
  ```
- **Type-check and compile**:
  ```bash
  npm run compile
  ```
- **Package VSIX**:
  ```bash
  npm run package
  ```

---

## Local Extension Development Host Debugging

1. Open the repository root in Visual Studio Code.
2. Press `F5` (**Run Extension**).
3. An **Extension Development Host** launches with Revion loaded in the Activity Bar.
4. Set breakpoints anywhere in `src/` to step through live command execution and webview message handling.
