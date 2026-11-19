# Changelog

All notable changes to the "Fixora AI" extension are documented in this file.

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
