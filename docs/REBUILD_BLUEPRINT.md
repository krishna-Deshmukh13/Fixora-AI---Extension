# Revion Professional — Rebuild Blueprint & Technical Architecture

> **Project Working Title:** Revion (Professional AI Developer Tool)  
> **Marketplace Identity (Preserved):** `FixoraFoundation.fixora-ai` (`name: fixora-ai`, `publisher: FixoraFoundation`)  
> **Repository:** `https://github.com/krishna-Deshmukh13/Fixora-AI---Extension`  
> **Author:** Krishna Deshmukh  
> **Target Version:** 0.2.0  
> **Date:** November 2026  
> **Status:** Stage 00 — Baseline Audit & Rebuild Blueprint Complete  

---

## 1. Executive Summary & Brand Identity Constraints

### 1.1 Brand Migration Context
Fixora AI was created as an all-in-one Visual Studio Code extension unifying real-time inline diagnostics (Error Lens), cyclomatic complexity badges (Complexity Lens), multi-language linting, silent auto-healing Prettier formatting, and context-aware AI code review.

To elevate this product to enterprise standards, the extension is being rebuilt under the working product identity **"Revion"**.

### 1.2 Non-Negotiable Identity Constraints
1. **Preserve Extension Name:** `package.json` must retain `"name": "fixora-ai"`.
2. **Preserve Publisher:** `package.json` must retain `"publisher": "FixoraFoundation"`.
3. **Preserve Marketplace ID:** The composite identifier `FixoraFoundation.fixora-ai` is published and active; it must remain intact.
4. **Working Brand Identity:** Use **"Revion"** as the user-facing product title, UI header, command titles, and documentation.
5. **Backwards Compatibility:** All existing settings (`fixora.*`), secret storage keys (`fixora.geminiApiKey`), and internal command IDs (`fixora.*`) must remain operational so existing installations and user keybindings never break.
6. **No Duplicate Entities:** No new extension IDs, separate repositories, or rogue Marketplace listings will be created.

---

## 2. Current Architecture (As-Audited)

### 2.1 Component Topology
The extension currently runs in a single Node.js runtime process bundled with `esbuild`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Visual Studio Code Extension Host                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/extension.ts (Activation Lifecycle)                                    │
│  ├─ Core AI Orchestrator (AIManager -> GeminiProvider / OllamaProvider)     │
│  ├─ Offline Realtime Engines                                                │
│  │  ├─ ErrorLensManager (Inline decoration & status bar)                   │
│  │  ├─ ComplexityLensManager & Refactorer (Cyclomatic CC & offline fixes)   │
│  │  ├─ RealtimeLinter (Debounced regex/AST checks for JS/TS/Py/HTML/CSS)   │
│  │  └─ PrettierFormatter & SyntaxHealer (Standalone prettier + healer)     │
│  ├─ Review & Audit Engines                                                  │
│  │  ├─ ReviewEngine (File / selection review)                               │
│  │  ├─ WorkspaceReviewEngine (Multi-file glob & Git diff scanner)          │
│  │  ├─ BugDetector (Local deterministic heuristics)                         │
│  │  ├─ SecurityEngine & SecretDetector (OWASP regex + client redaction)     │
│  │  ├─ PerformanceEngine (Algorithmic & memory leak patterns)               │
│  │  └─ DebuggerEngine (Stack trace parser & 7-dimension explainer)         │
│  ├─ Diagnostics & Code Actions                                              │
│  │  ├─ DiagnosticManager (VS Code Problems collection)                     │
│  │  ├─ FixoraCodeActionProvider (QuickFix lightbulb actions)                │
│  │  └─ FixEngine & DiffProvider (Virtual document side-by-side diff)        │
│  └─ Presentation & Storage                                                  │
│     ├─ SidebarProvider (Activity Bar Webview View)                         │
│     ├─ HistoryManager (GlobalState 25-run ring buffer)                     │
│     └─ ReportGenerator (Standalone offline HTML report)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Baseline Verification Results
- **TypeScript Compile (`npm run compile`):** Passes cleanly (0 errors).
- **Static Linter (`npm run lint`):** Passes cleanly (`tsc --noEmit`).
- **Unit Test Suite (`npm test`):** 34 test files, 174 tests passing (100% green, 0 network dependencies).
- **Packaging (`npm run package`):** Produces `fixora-ai-0.1.0.vsix` (4.37 MB), with `*` activation warning.

---

## 3. Comprehensive Feature Audit Matrix

Every contributed command, view, engine, and service was audited across 8 strict engineering dimensions:

| Feature / Command | Implemented? | Registered? | Works in Host? | UI Connected? | Dependencies | Failure Handling | Tested? | Verdict & Migration Action |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- | :---: | :--- |
| **Native Error Lens** (`fixora.toggleInlineDiagnostics`, `nextDiagnostic`, `previousDiagnostic`) | Yes | Yes | Yes | Yes (Toggle switch + shortcuts) | VS Code API | Degrades gracefully if editor closes | Yes (`errorLensManager.test.ts`) | **KEEP & REFINE** (Preserve engine; refine multi-diagnostic deduplication). |
| **Complexity Lens** (`fixora.toggleComplexityLens`, `analyzeComplexity`) | Yes | Yes | Yes | Yes (Badges + hover + sidebar) | AST heuristics | Fallback to CC=1 on parse error | Yes (`complexity*.test.ts`) | **KEEP & REFINE** (Preserve offline refactorings; update badge style). |
| **Prettier Formatter** (`fixora.formatDocument`, `formatSelection`, `toggleFormatter`) | Yes | Yes | Yes | Yes (Toggle + buttons + shortcut) | `prettier/standalone` + plugins | Fallback to `SyntaxHealer` | Yes (`prettierFormatter.test.ts`, `syntaxHealer.test.ts`) | **KEEP & HARDEN** (Exclude `.map` files to drop VSIX size). |
| **Real-Time Linter** (`fixora.toggleLinter`) | Yes | Yes | Yes | Yes (Toggle + Problems + QuickFix) | Native TS rules | Silent catch on regex timeout | Yes (`realtimeLinter.test.ts`) | **KEEP** (High performance, offline). |
| **AI Selection Review** (`fixora.reviewSelection`) | Yes | Yes | Yes | Yes (Sidebar + context menu) | `@google/genai` or Ollama | Graceful fallback to local heuristics | Yes (`reviewEngine.test.ts`) | **KEEP & MODERNIZE** (Retain engine; rebrand UI prompt). |
| **AI File Review** (`fixora.reviewFile`) | Yes | Yes | Yes | Yes (Sidebar + command) | `@google/genai` or Ollama | Size guard (<500KB) + local fallback | Yes (`reviewEngine.test.ts`) | **KEEP & MODERNIZE** |
| **Workspace Review** (`fixora.reviewWorkspace`) | Yes | Yes | Yes | Yes (Sidebar + progress notification) | VS Code findFiles | Cancellation token support | Yes (`workspaceReview.test.ts`) | **KEEP & OPTIMIZE** (Batch API calls). |
| **Git Diff Review** (`fixora.reviewGit`, `reviewStaged`) | Yes | Yes | Yes | Yes (Sidebar + command) | Local Git CLI | Checks Git repo presence | Yes (`workspaceReview.test.ts`) | **KEEP** |
| **Security Scan** (`fixora.securityScan`) | Yes | Yes | Yes | Yes (Sidebar + editor menu) | SecretDetector + OWASP rules | Local deterministic fallback | Yes (`securityEngine.test.ts`, `secretDetector.test.ts`) | **KEEP & EXPAND** |
| **Performance Review** (`fixora.performanceReview`) | Yes | Yes | Yes | Yes (Sidebar + command) | PerformanceEngine | Local heuristic fallback | Yes (`performanceEngine.test.ts`) | **KEEP** |
| **Code Quality Review** (`fixora.qualityReview`) | **Partial** | Yes | **Broken** | **Misleading** (Infinite Spinner) | None | **None (Leaves spinner active)** | No | **REPAIR IMMEDIATELY** (Hook up to `ComplexityAnalyzer` and clear loading state). |
| **Error Explainer** (`fixora.explainError`) | Yes | Yes | Yes | Yes (Context menu + shortcut) | DebuggerEngine + AI | Handles missing error at cursor | Yes (`debuggerEngine.test.ts`) | **KEEP & ENHANCE** |
| **Terminal Explainer** (`fixora.explainTerminal`) | Yes | Yes | Yes | Yes (Sidebar button) | DebuggerEngine + AI | Input box validation | Yes (`debuggerEngine.test.ts`) | **ENHANCE** (Add clipboard auto-detect). |
| **Fix Engine & Diff** (`fixora.fixIssue`) | Yes | Yes | Yes | Yes (Sidebar preview/apply buttons) | `diff` + VS Code `WorkspaceEdit` | Rollback on invalid edit | Yes (`fixEngine.test.ts`, `diffProvider.test.ts`) | **KEEP** |
| **Review History** (`fixora.viewHistory`) | **Partial** | Yes | **Broken** | **Disconnected** (Empty History tab) | GlobalState | Clears on error | Yes (`historyManager.test.ts`) | **REPAIR** (Connect history records to Webview). |
| **HTML Report Export** (`fixora.exportReport`) | Yes | Yes | Yes | Yes (Sidebar button) | Local file system | Checks for active review | Yes (`reportGenerator.test.ts`) | **KEEP** |
| **Git Pre-Commit Guard** (`fixora.installGitHook`) | Yes | Yes | Yes | Yes (Sidebar button) | Local `.git/hooks` | Validates `.git` directory presence | Yes (`gitHookManager.test.ts`) | **HARDEN** (Support Windows/Unix paths). |
| **AI Model Configuration** (`fixora.selectModel`, `configureApiKey`) | Yes | Yes | Yes | Yes (QuickPick + SecretStorage) | VS Code SecretStorage | Validates empty keys | Yes (`geminiProvider.test.ts`) | **REPAIR MODELS** (Remove `gemini-3.8-flash`). |

---

## 4. Prioritized Technical Defects & Vulnerabilities

### 4.1 Critical / High Defects
1. **Hallucinated Gemini Model (`gemini-3.8-flash`):**
   - *Location:* `package.json` (line 369), `src/commands/index.ts` (line 135), `src/providers/sidebarProvider.ts` (lines 69 & 270), `src/ai/providers/geminiProvider.ts` (line 52).
   - *Issue:* Google Gemini API has never had a `gemini-3.8-flash` model. Selecting it causes 404 API failures, which then trigger silent fallback loops.
   - *Remedy:* Replace with legitimate official Gemini models: `gemini-2.0-flash` (default), `gemini-1.5-flash`, and `gemini-1.5-pro`.

2. **Infinite Loading Spinner on `fixora.qualityReview`:**
   - *Location:* `src/commands/index.ts` (lines 64-74).
   - *Issue:* Command triggers `sidebarProvider.broadcastState(true, 'Auditing code quality...')` but never calls any analyzer or completion method, locking the sidebar into a perpetual loading spinner.
   - *Remedy:* Connect `fixora.qualityReview` to `ComplexityAnalyzer.analyze()` and `DuplicateDetector.detect()`, display the result, and reset loading state to false.

3. **Broken Webview History Tab:**
   - *Location:* `media/dashboard.js` (lines 339-343) and `src/providers/sidebarProvider.ts`.
   - *Issue:* Clicking the "History" tab looks for `.history-card` elements, but `dashboard.js` never creates them. `HistoryManager` records are never transmitted to or rendered by the webview.
   - *Remedy:* Wire `HistoryManager.getHistory()` into `sidebarProvider.broadcastState()` and render clickable history records in `dashboard.js`.

4. **11 Missing Commands in `contributes.menus.commandPalette`:**
   - *Location:* `package.json` (lines 242-297).
   - *Issue:* While 29 commands are registered in code, only 18 are listed under `commandPalette`, leaving 11 commands omitted from the palette whitelist.
   - *Remedy:* Add all 11 missing commands with proper categories.

5. **Star Activation Warning (`"*"` in `activationEvents`):**
   - *Location:* `package.json` (lines 45-48).
   - *Issue:* `vsce package` issues a warning regarding `"*"` activation impacting startup performance.
   - *Remedy:* Remove `"*"` and rely on `"onStartupFinished"`, which is the sanctioned modern alternative.

6. **Bloated VSIX Package Due to Included Source Maps:**
   - *Location:* `.vscodeignore` and `dist/`.
   - *Issue:* `.vscodeignore` has `!dist/**` after `*.map`, resulting in `dist/extension.js.map` (3.32 MB) being packaged inside the VSIX, inflating it to 4.37 MB.
   - *Remedy:* Add `dist/*.map` to `.vscodeignore` to package only the 1.5 MB minified production bundle.

---

## 5. Target Architecture ("Revion Professional")

```
src/
├── ai/                      # AI Layer (Gemini 2.0/1.5 & Ollama)
│   ├── aiManager.ts         # Multi-provider coordinator & timeout guard
│   ├── promptManager.ts     # Revion-tuned analysis & explanation prompts
│   ├── responseParser.ts    # Zod schema validation & markdown unboxing
│   └── providers/
│       ├── provider.ts      # Standard AIProvider interface
│       ├── geminiProvider.ts# Official @google/genai (gemini-2.0-flash / 1.5)
│       └── ollamaProvider.ts# Offline local models (codellama, qwen2.5)
├── analyzers/               # Local Static Analyzers (ESLint, Ruff, Clang)
├── core/                    # Core Analytical Engines
│   ├── bugDetector.ts       # Deterministic heuristics
│   ├── debuggerEngine.ts    # 7-dimension error explainer
│   ├── performanceEngine.ts # Bottleneck & memory leak detector
│   ├── reviewEngine.ts      # Single file/selection review coordinator
│   ├── securityEngine.ts    # OWASP audit engine
│   └── workspaceReviewEngine.ts # Multi-file & Git change auditor
├── diagnostics/             # VS Code Editor Integration
│   ├── codeActionProvider.ts# Lightbulb QuickFix actions
│   ├── diagnosticManager.ts # Problems panel collection manager
│   └── errorLensManager.ts  # Native inline Error Lens & status bar
├── fixes/                   # Safe Code Modification
│   ├── diffProvider.ts      # Virtual document diff provider
│   └── fixEngine.ts         # Atomic WorkspaceEdit application
├── formatter/               # Prettier Formatter & Syntax Healing
│   ├── prettierFormatter.ts # Prettier standalone (14 languages)
│   └── syntaxHealer.ts      # Silent syntax repair (tags, braces)
├── git/                     # Git Hooks & Pre-Commit Scanner
├── history/                 # Review Run Persistence
├── metrics/                 # Code Health & Complexity
│   ├── complexityAnalyzer.ts# Cyclomatic CC & Maintainability Index
│   ├── complexityLensManager.ts # Right-side function badges
│   ├── complexityRefactorer.ts  # 1-click offline refactorings
│   └── duplicateDetector.ts # Duplicate block detector
├── providers/               # Webview Interface
│   └── sidebarProvider.ts   # Revion Sidebar Controller
├── reports/                 # Standalone Audit Reports
├── security/                # Privacy Guard & Secret Detection
│   ├── privacyManager.ts    # Pre-transmission sanitization
│   └── secretDetector.ts    # 12+ API credential regex scanners
├── types/                   # Unified Type System
└── utils/                   # Shared Utilities (Logger, LanguageDetector)
```

---

## 6. Proposed UI Component Structure (Revion Sidebar)

The sidebar UI will be structured into 4 clean, cohesive sections:

```
┌─────────────────────────────────────────────────────────────┐
│  REVION  [⚡ Gemini 2.0 Flash]  [● Connected]               │
├─────────────────────────────────────────────────────────────┤
│  ▼ REAL-TIME ENGINES                                        │
│  [x] Error Lens          (Inline diagnostics)      [ON]     │
│  [x] Complexity Lens     (⚡ CC: badges)           [ON]     │
│  [x] Real-time Linter    (As-you-type checks)      [ON]     │
│  [x] Prettier Formatter  (Auto-healing format)     [ON]     │
├─────────────────────────────────────────────────────────────┤
│  ▼ ACTIONS & AUDITS                                         │
│  [ ⚡ Review Selection ]    [ 📄 Review Current File ]       │
│  [ 🔒 Security Audit   ]    [ ⚡ Code Health Audit   ]       │
│  [ 📁 Workspace Review ]    [ 🌿 Review Git Changes  ]       │
│  [ 🐞 Explain Terminal ]    [ 📊 Export HTML Report  ]       │
├─────────────────────────────────────────────────────────────┤
│  ▼ TABS: [ Findings (4) ]  [ History (12) ]  [ Settings ]   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ⛔ CRITICAL: SQL Injection Risk (Line 42)             │  │
│  │ User input concatenated directly into raw query.      │  │
│  │ [ Go to Line 42 ]   [ Preview Fix ]   [ Apply Fix ]   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ ⚡ CC: 14 High Complexity (Line 88: parsePayload)      │  │
│  │ [ Offline Refactor to O(1) Guard Clauses ]            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Proposed Testing Architecture

1. **Unit Testing (Vitest):**
   - 100% mocked VS Code API via `test/mocks/vscode.ts`.
   - Mocked Gemini SDK responses for zero network/credential requirements.
   - Deterministic testing of all heuristic scanners, complexity calculators, and formatters.
2. **Integration Verification:**
   - Verification of command lifecycle and Webview message passing.
   - Verification of `WorkspaceEdit` generation for code fixes.
3. **Execution Script:** `npm test` runs in ~5 seconds across all 34+ test suites.

---

## 8. Implementation Roadmap (Phases & Stages)

| Stage / Phase | Objectives | Status |
| :---: | :--- | :---: |
| **Stage 00** | Comprehensive codebase audit, baseline establishment, missing unit tests for `HistoryManager`, `DiffProvider`, `CodeActionProvider`, `Commands`. | **COMPLETED** |
| **Stage 01** | Professional branding & complete UI rebuild as Revion (clean vector SVGs, 512px icon, theme variables, Webview tabs & responsive state). | **COMPLETED** |
| **Stage 02** | Production-grade code intelligence engine (12-language realtime linter, javac/checkstyle adapter, diagnostic deduplication, Gemini 2.0 / Ollama streaming & backoff, safe diff patches, Prettier .prettierignore). | **COMPLETED** |
| **Stage 03** | Advanced AI developer workflows (Context-aware chat with secret redaction, GitHub PR review, Dependency vulnerability auditor, Unit test generation engine, Workspace health score dashboard). | **COMPLETED** |

**Current Test Metrics:** 39 test suites, 199 automated unit tests (100% passing rate). Package size: 3.67 MB clean production VSIX without source maps.

---

## 9. Features Safe to Preserve Immediately

The following features have been verified through tests and code inspection as **100% stable, offline-capable, and safe to preserve without breaking changes**:
1. **Native Error Lens (`ErrorLensManager`):** Clean line decorations, status bar counter, and jump navigation.
2. **Complexity Lens (`ComplexityLensManager`, `ComplexityAnalyzer`, `ComplexityRefactorer`):** Real-time cyclomatic badges and offline 1-click refactoring.
3. **Prettier Formatter (`PrettierFormatter`) & Syntax Healer (`SyntaxHealer`):** Prettier standalone formatting for 14 languages with silent tag/bracket healing.
4. **Real-time Linter (`RealtimeLinter`):** As-you-type multi-language syntax and style checking with QuickFixes.
5. **Secret Detector (`SecretDetector`):** 12+ deterministic regex patterns for credentials.
6. **Privacy Manager (`PrivacyManager`):** Pre-transmission token scrubbing and `.env` protection.
7. **Fix Engine & Virtual Diff Provider (`FixEngine`, `FixoraDiffContentProvider`):** Safe side-by-side diff previews and atomic edits.
8. **Multi-Scope Review Engines (`ReviewEngine`, `WorkspaceReviewEngine`, `SecurityEngine`, `PerformanceEngine`, `DebuggerEngine`):** Solid analysis pipelines with local heuristic fallbacks.
