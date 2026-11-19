# Fixora AI User Guide

Welcome to **Fixora AI** — your AI-powered code reviewer, bug detector, and debugging assistant in Visual Studio Code.

---

## Table of Contents
1. [Sidebar Dashboard Walkthrough](#1-sidebar-dashboard-walkthrough)
2. [Code Review Modes](#2-code-review-modes)
3. [Understanding Findings & Severity Levels](#3-understanding-findings--severity-levels)
4. [Using AI Auto-Fix & Diff Preview](#4-using-ai-auto-fix--diff-preview)
5. [Explaining Errors & Stack Traces](#5-explaining-errors--stack-traces)
6. [Security & Performance Scans](#6-security--performance-scans)
7. [Learning Mode for Beginners](#7-learning-mode-for-beginners)
8. [Configuring Settings](#8-configuring-settings)

---

## 1. Sidebar Dashboard Walkthrough

Click the **Fixora AI** icon on the VS Code Activity Bar (left-hand sidebar).

The sidebar features three tabs:
- **Dashboard**: High-level issue counts (Critical, Warning, Info), quick review action buttons, and active status indicators.
- **Issues**: A list of all identified findings from the most recent scan. Clicking on any issue jumps directly to the file and line number in your editor.
- **History**: An archive of previous review runs with timestamps, issue counts, and run duration.

---

## 2. Code Review Modes

Fixora AI supports four convenient review scopes:

### Mode 1: Review Selected Code (`Ctrl + Shift + F1`)
Highlight lines of code in your editor, right-click, and select **Fixora AI: Review Selected Code**. Fixora AI maps snippet line numbers back to your file coordinates.

### Mode 2: Review Active File (`Ctrl + Shift + F2`)
Analyzes the entire open document. Identifies logical inconsistencies, unhandled exceptions, and dead code.

### Mode 3: Review Workspace (`Ctrl + Shift + F3`)
Scans multiple source code files across your open workspace folder (capped at 30 files per batch to prevent rate limiting). Excludes `.git`, `node_modules`, `dist`, and environment files automatically.

### Mode 4: Review Git Changes (`Ctrl + Shift + F4` / `Ctrl + Shift + F5`)
- **Review Git Changes (`Ctrl + Shift + F4`)**: Analyzes all uncommitted changes in your local working tree.
- **Review Staged Changes (`Ctrl + Shift + F5`)**: Audits files added to the Git staging index (`git add`) prior to creating a commit.

---

## 3. Understanding Findings & Severity Levels

Every issue reported by Fixora AI includes:
- **Severity Badge**:
  - `CRITICAL`: Security vulnerabilities, unhandled null pointers, infinite loop risks, crash-inducing syntax errors.
  - `WARNING`: Logic flaws, unawaited promises, loose equalities, potential edge-case errors.
  - `INFO`: Code readability, style consistency, minor performance tips.
- **Source Label**: Clearly labels whether the issue was identified by a local **Static Analyzer** (e.g. ESLint, Ruff) or **AI Provider** (Google Gemini).
- **Line & Column**: Precise location coordinates with jump-to-source navigation.
- **Why It Matters**: Concise explanation of the technical risk.
- **Suggested Solution**: Instructions on how to remediate the issue.

---

## 4. Using AI Auto-Fix & Diff Preview

When an issue has a suggested code fix:
1. Click the **Preview Fix** button on the issue card in the sidebar or select **Fix with Fixora AI** from the editor lightbulb menu (`Ctrl + .`).
2. Fixora AI opens a side-by-side **Diff Editor** comparing your original code on the left with the proposed fix on the right.
3. Review the changes. If satisfied, click **Apply Fix**.
4. The correction is applied cleanly via the VS Code `WorkspaceEdit` API, preserving surrounding indentation and comments.

---

## 5. Explaining Errors & Stack Traces

Encountering a confusing compiler error or runtime exception?

### From the Problems Panel (`Ctrl + Shift + F6`)
Place your cursor on any highlighted squiggly error line in your editor and press `Ctrl + Shift + F6`. Fixora AI answers:
1. What does this error mean?
2. Why did it happen?
3. Which line caused it?
4. What is the root cause?
5. How can I fix it?
6. Show corrected code.

### From Terminal Stack Traces (`Ctrl + Shift + F7`)
Highlight an error or stack trace in your integrated terminal, right-click, and select **Fixora AI: Explain Terminal Error**. Fixora AI parses the stack trace (Node, Python, Java, C++, PHP) and identifies the offending file and line.

---

## 6. Security & Performance Scans

- **Security Scan (`Ctrl + Shift + F8`)**: Audits your code for OWASP Top 10 risks including SQL injection, cross-site scripting (XSS), command injection, insecure deserialization, and exposed credentials.
- **Performance Review (`Ctrl + Shift + F9`)**: Flags expensive quadratic operations, unindexed SQL queries, and blocking synchronous file operations in Node.js event loops.

---

## 7. Learning Mode for Beginners

If you are a student or beginner developer:
1. Open the Command Palette (`Ctrl + Shift + P`).
2. Run **`Fixora AI: Toggle Learning Mode`**.
3. When enabled, Fixora AI formats explanations with pedagogical context, explaining fundamental programming concepts and principles rather than just returning brief technical summaries.

---

## 8. Configuring Settings

Access Fixora AI settings by navigating to `File > Preferences > Settings` and searching for `fixora`:
- `fixora.model`: Select between `gemini-2.5-flash` (fastest) and `gemini-2.5-pro` (deepest reasoning).
- `fixora.analysis.enableStaticAnalyzers`: Enable or disable local linter integration.
- `fixora.security.autoRedactSecrets`: Automatically scrub credentials from code before AI transmission.
