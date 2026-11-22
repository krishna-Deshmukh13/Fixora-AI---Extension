# Changelog

All notable changes to the "Fixora AI" (Revion) extension are documented in this file.

---

## [0.2.0] - 2026-11-22

### Major Architecture & Intelligence Rebuild (Revion Professional)

#### 1. Professional Brand & UI Rebuild
- **Revion Working Identity**: Modern, minimal vector geometry brand symbol optimized for Activity Bar and 512px Marketplace display.
- **VS Code Native Design System**: Rebuilt UI utilizing native theme variables (`--vscode-editor-background`, `--vscode-foreground`, etc.) eliminating generic templates.
- **Responsive Sidebar Architecture**: Cohesive tabbed layout separating Assistant Chat, Review Controls, Live Findings, and clickable History records.

#### 2. Advanced AI Developer Workflows
- **Context-Aware AI Chat**: Streaming chat panel with active editor snippet injection, surrounding line context, active Problems panel diagnostics, and `@file` mentions.
- **GitHub Pull Request Review**: Direct PR review inside VS Code with GitHub authentication, unified diff retrieval, inline review findings, and user-confirmed review comments.
- **Dependency Vulnerability Auditor**: Automated heuristic dependency scanner for `package.json` and `requirements.txt` detecting high-profile CVEs (Log4Shell, Prototype Pollution, SSRF, JWT RCE, Open Redirect).
- **Automated Unit Test Generator**: Framework-aware test synthesis (Vitest, Jest, Pytest, JUnit) with safe preview in untitled editors.
- **Workspace Health Dashboard**: Objective quality score (0–100) based on diagnostic distribution, Cyclomatic Complexity averages, and hotspot functions without fabricated trends.

#### 3. Core Engine Hardening & Performance
- **12-Language Real-Time Linter**: Expanded coverage to JS, TS, JSX, TSX, Python, Java, C, C++, HTML, CSS/SCSS/LESS, PHP, and SQL with debouncing and obsolete run cancellation.
- **Java Static Analysis Adapter**: Integrated javac / Checkstyle `-Xlint:all` compiler adapter.
- **Safe Patch Applicator**: Validates source code line content against finding snippet before applying edits; native `vscode.diff` visual comparison.
- **Prettier Formatter Enhancements**: Added `.prettierignore` detection and configurable `autoHealSyntax` setting guard.
- **Exponential Backoff**: Automatic retry for HTTP 429 rate limits against Google Gemini API with fallback to local Ollama.

#### 4. Quality & Compatibility
- **100% Backwards Compatible**: Preserved all 33 `fixora.*` command IDs, `fixora.*` settings, and `fixora.geminiApiKey` SecretStorage.
- **39 Test Suites / 199 Tests**: Expanded automated test suite with 100% pass rate in Vitest.
- **Optimized Packaging**: Excluded sourcemaps from release archive, reducing VSIX size to 3.67 MB.

---

## [0.1.0] - 2026-11-20

### Initial Official Release

#### 1. Native Live Editor Engines
- **Error Lens**: Displays errors, warnings, and hints directly at the end of code lines with gutter icons and status bar navigation (`Alt+E`, `Alt+F8`, `Shift+Alt+F8`).
- **Code Complexity Lens**: Renders cyclomatic complexity badges (`⚡ CC: X`) on the right side of function headers in real-time, accompanied by rich hover cards and offline 1-click refactoring actions (`Ctrl+.`).
- **Real-Time As-You-Type Linter**: Instant syntax and style checking across JavaScript, TypeScript, Python, HTML, and CSS modeled after ESLint and Stylelint, with automated Quick Fixes.
- **Prettier Formatter & Syntax Healer**: Built-in Prettier formatting engine paired with automatic silent healing of unclosed tags, missing brackets, and stray tokens on save/run.

#### 2. AI Code Review & Debugging
- **Multi-Scope Review**: Single-selection review, active file review, staged Git diff review, and full workspace audits.
- **AI Engine Support**: Native integration with Google Gemini (`gemini-2.5-flash`, `gemini-2.5-pro`) and offline local models via Ollama.
- **Heuristic Bug Detector**: Local detection of loose equalities, swallowed exceptions, unhandled promises, and infinite loop traps.
- **7-Question Error Explanations**: Deep explanations for runtime exceptions, compiler diagnostics, and terminal error traces with verified fix code.
- **Diff Preview & Safe Fixes**: Visual side-by-side diff previews before applying code modifications with atomic VS Code `WorkspaceEdit`.

#### 3. Security, Privacy & Compliance
- **Client-Side Secret Masking**: Automatic regex redaction of API tokens, database connection strings, private keys, and JWTs prior to AI queries.
- **OWASP Vulnerability Audit**: Automated scans for SQL injection, cross-site scripting (XSS), command injection, and insecure deserialization.
- **SecretStorage Integration**: Zero plaintext API key storage; keys reside securely inside the OS keychain.

#### 4. Streamlined Sidebar UI
- Redesigned clean single-view dashboard without cluttered tabs.
- Modern interactive toggle switches for Error Lens, Complexity Lens, Real-time Linter, and Prettier Formatter.
- Single-click action buttons for immediate document formatting, complexity auditing, security scanning, and Git pre-commit guard installation.
