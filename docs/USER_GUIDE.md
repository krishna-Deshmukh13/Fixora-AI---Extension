# Revion User Guide

Welcome to **Revion** — your intelligent code review, error lens, and debugging assistant in Visual Studio Code.

---

## Table of Contents
1. [Sidebar & Navigation Walkthrough](#1-sidebar--navigation-walkthrough)
2. [First-Run Onboarding Experience](#2-first-run-onboarding-experience)
3. [Live In-Editor Engines](#3-live-in-editor-engines)
4. [Context-Aware AI Chat & Assistant](#4-context-aware-ai-chat--assistant)
5. [Code Review Modes & Audits](#5-code-review-modes--audits)
6. [GitHub Pull Request Review](#6-github-pull-request-review)
7. [Dependency Vulnerability Auditor](#7-dependency-vulnerability-auditor)
8. [Automated Unit Test Generator](#8-automated-unit-test-generator)
9. [Workspace Health Score Dashboard](#9-workspace-health-score-dashboard)
10. [Using AI Auto-Fix & Diff Preview](#10-using-ai-auto-fix--diff-preview)
11. [Explaining Errors & Stack Traces](#11-explaining-errors--stack-traces)
12. [Pre-Commit Guard & Reports](#12-pre-commit-guard--reports)
13. [Configuring Settings](#13-configuring-settings)

---

## 1. Sidebar & Navigation Walkthrough

Click the **Revion** Activity Bar icon (on the primary side bar).

The redesigned Revion interface features four dedicated workspace tabs:
- **Assistant**: Interactive AI chat assistant with active workspace awareness, selected code prefill, and clear chat controls.
- **Review**: Live editor feature switches (Error Lens, Complexity Lens, Linter, Formatter) and instant workflow trigger buttons.
- **Issues**: Inspector of all active findings from the current review, filterable by severity (All, Critical, Warnings, Hints) with 1-click jump-to-code and diff preview.
- **History**: Historical archive of review runs with duration, file count, and click-to-load inspection.

---

## 2. First-Run Onboarding Experience

When opening Revion for the first time without an API key:
1. An inline welcome onboarding card appears at the top of the Assistant tab.
2. Select your preferred provider: **Google Gemini** (recommended) or **Ollama** (offline local LLM).
3. Paste your Gemini API key (or click *Get Free Key* to open Google AI Studio).
4. Keys are stored safely in VS Code's encrypted `SecretStorage` (`fixora.geminiApiKey`) — never saved to plaintext settings.
5. Click **Run Sample Review** to immediately test and verify your connection on a live sample code snippet.

---

## 3. Live In-Editor Engines

Revion runs 4 high-speed offline engines inside your editor:
- **⚡ Error Lens**: Displays diagnostics inline at the end of the error line, with line background tinting and status bar navigation (`Alt + F8`).
- **🧠 Complexity Lens**: Computes Cyclomatic Complexity (CC) on function headers with color-coded ratings and 1-click refactoring (`Ctrl + .`).
- **🔍 Real-Time Linter**: Validates JavaScript, TypeScript, Python, HTML, and CSS as you type with zero network lag.
- **✨ Prettier Formatter**: Clean document and selection formatting with automatic syntax healing.

---

## 4. Context-Aware AI Chat & Assistant

Revion includes a dedicated streaming coding assistant in the sidebar:
- **Streaming Responses**: Live token streaming directly into chat bubbles.
- **Context Injection**: Automatically references your open file, selected code lines, and active VS Code Problems diagnostics.
- **`@file` References**: Type `@src/index.ts` or `@package.json` to attach specific workspace files directly into the prompt (up to 100 lines/10 KB).
- **Client-Side Secret Redaction**: All API keys, passwords, and tokens are scrubbed into `[REDACTED_SECRET]` locally before prompt transmission.
- **Follow-Up Quick Actions**: Click prompt chips for instant explanation, test generation, or complexity refactoring.

---

## 5. Code Review Modes & Audits

Revion supports comprehensive review scopes:

### Mode 1: Review Selected Code (`Ctrl + Alt + R`)
Highlight code in any active editor, right-click, and select **Revion: Review Selected Code**. Revion maps line coordinates back to your file.

### Mode 2: Review Active File
Analyzes the entire open document, identifying architectural issues, unhandled exceptions, and dead code.

### Mode 3: Review Workspace
Scans source files across your workspace (capped at 30-50 files per batch to prevent rate limiting). Excludes `.git`, `node_modules`, `dist`, and environment files automatically.

### Mode 4: Review Git Changes
Audits uncommitted changes or staged changes prior to committing to ensure pull-request readiness.

---

## 6. GitHub Pull Request Review

Review PRs directly inside VS Code:
1. Run **`Revion: Review GitHub Pull Request`** from the Command Palette (`Ctrl + Shift + P`).
2. Revion detects your GitHub repository remote from `git remote -v`.
3. Authenticates via your existing VS Code GitHub account session (`vscode.authentication.getSession`).
4. Enter the PR number to fetch the unified diff.
5. Findings are attached to the actual changed line positions in the diff.
6. **Safety First**: Review comments can be previewed locally and are posted to GitHub **only** after your explicit modal confirmation.

---

## 7. Dependency Vulnerability Auditor

Audit your project manifests for known CVE advisories:
1. Run **`Revion: Audit Dependencies for Vulnerabilities`**.
2. Scans `package.json` (npm) and `requirements.txt` (Python).
3. Cross-checks against curated CVE advisories (e.g., Log4Shell, Prototype Pollution, SSRF, JWT RCE, Open Redirects).
4. Provides evidence-backed remediation advice and minimum secure versions.
5. *Note: Automated scans do not replace comprehensive manual security audits or official CVE feeds.*

---

## 8. Automated Unit Test Generator

Generate production-grade unit tests for any function or file:
1. Highlight code in your editor.
2. Run **`Revion: Generate Unit Tests`** from the Command Palette.
3. Revion detects your project's test framework (Vitest, Jest, Pytest, JUnit).
4. Generates comprehensive tests covering happy paths, edge cases, and error conditions.
5. Safely opens the test in a new untitled VS Code editor for review with an option to save to conventional test directories (`test/unit/...`, `tests/...`).

---

## 9. Workspace Health Score Dashboard

Get an objective, grounded assessment of your codebase quality:
1. Run **`Revion: Workspace Health & Quality Audit`**.
2. Computes an objective score (0–100) based on:
   - Diagnostic severity distribution (Errors, Warnings, Hints)
   - Function Cyclomatic Complexity averages
   - Hotspot functions (CC > 10)
   - Dependency vulnerability counts
3. Explains how metrics are computed with zero fabricated quality scores.

---

## 5. Understanding Findings & Severity Levels

Every issue reported by Revion includes:
- **Severity Badge**:
  - `CRITICAL`: Security vulnerabilities, unhandled null pointers, infinite loops, breaking syntax errors.
  - `WARNING`: Logic flaws, unawaited promises, loose equalities, potential edge-case errors.
  - `INFO`: Code readability, style consistency, minor performance tips.
- **Category**: `security`, `bug`, `performance`, `complexity`, `style`.
- **Line & Column**: Precise coordinates with 1-click jump-to-source navigation.
- **Why It Matters**: Concise technical explanation of why the finding poses a risk.
- **Suggested Solution**: Concrete remediation steps.

---

## 6. Using AI Auto-Fix & Diff Preview

When an issue has a suggested code fix:
1. Click **Preview** on the issue card in the sidebar or select **Fix with Revion** from the editor lightbulb menu (`Ctrl + .`).
2. Revion opens a side-by-side **Diff Editor** comparing your original file with proposed changes.
3. Review the proposed diff. If satisfied, click **Apply Fix**.
4. The change is cleanly applied via the VS Code `WorkspaceEdit` API.

---

## 7. Explaining Errors & Stack Traces

Encountering a confusing compiler error or runtime exception?

### From the Problems Panel (`Ctrl + Alt + E`)
Place your cursor on any highlighted diagnostic line and press `Ctrl + Alt + E`. Revion answers:
1. What does this error mean?
2. Why did it happen?
3. Which line caused it?
4. What is the root cause?
5. How can I fix it?
6. Show corrected code.

### From Terminal Stack Traces
Run **`Revion: Explain Terminal Error`** from the Command Palette (`Ctrl + Shift + P`). Revion automatically inspects your clipboard for stack traces, pre-fills the input prompt, and generates a structured root-cause analysis.

---

## 8. Security & Code Health Audits

- **Security Audit (OWASP)**: Audits your code against OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, command injection, and exposed credentials).
- **Code Health Audit**: Combines local AST complexity analysis with duplicate code detection to flag maintainability bottlenecks.

---

## 9. Pre-Commit Guard & Reports

- **Install Pre-Commit Guard**: Installs a zero-dependency pre-commit hook into `.git/hooks/pre-commit` to prevent accidental commits containing API keys, AWS tokens, or private certificates.
- **Export HTML Report**: Generates a self-contained, offline HTML audit report with metrics cards and formatted findings.

---

## 10. Configuring Settings

Access Revion settings via `File > Preferences > Settings` (or the gear icon in Revion's header) and search for `fixora`:
- `fixora.model`: Active Gemini model (`gemini-2.0-flash` [default], `gemini-1.5-flash`, `gemini-1.5-pro`).
- `fixora.provider`: Switch between `gemini` and `ollama`.
- `fixora.ollama.model`: Selected local Ollama model (`codellama`, `deepseek-coder`, `llama3`).
- `fixora.enableErrorLens`: Toggle inline error lens decorations.
- `fixora.enableComplexityLens`: Toggle cyclomatic complexity badges.
- `fixora.enableRealtimeLinter`: Toggle live AST linter.
- `fixora.enablePrettierFormatter`: Toggle integrated code formatter.
