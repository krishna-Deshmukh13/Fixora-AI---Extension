# Fixora AI — All-in-One AI Code Reviewer, Error Lens, Formatter & Linter

<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Fixora AI Logo" />
</p>

<p align="center">
  <strong>Find Bugs. Understand Errors. Fix Code. Build Better.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=FixoraFoundation.fixora-ai"><img src="https://img.shields.io/badge/VS%20Code%20Marketplace-Fixora%20AI-007ACC.svg?style=for-the-badge&logo=visual-studio-code" alt="Visual Studio Marketplace" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=FixoraFoundation.fixora-ai"><img src="https://img.shields.io/badge/Status-Officially%20Published-brightgreen.svg?style=for-the-badge" alt="Published Status" /></a>
  <a href="https://github.com/krishna-Deshmukh13/Fixora-AI---Extension"><img src="https://img.shields.io/badge/Tests-162%20Passed-success.svg?style=for-the-badge" alt="Tests" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" /></a>
</p>

---

> ### 🚀 Available Now on the Visual Studio Code Marketplace!
> **Fixora AI is officially live and available for free to developers worldwide.**  
> Install directly inside VS Code by searching for **`Fixora AI`** in your Extensions panel (`Ctrl + Shift + X`), or run:
> ```bash
> code --install-extension FixoraFoundation.fixora-ai
> ```
> 👉 **[View Live on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=FixoraFoundation.fixora-ai)**

---

<p align="center">
  <img src="media/vscode-search-highlight.png" width="480" alt="Fixora AI in VS Code Extensions Marketplace" />
  <br>
  <em>Fixora AI live and discoverable in the official VS Code Marketplace search results.</em>
</p>

<p align="center">
  <img src="media/marketplace-live.png" width="800" alt="Fixora AI Published on Marketplace" />
  <br>
  <em>Official Publisher Analytics: Active on the Visual Studio Marketplace with 14 acquisitions.</em>
</p>

---

## 📌 Executive Summary

**Fixora AI** is a production-grade developer extension for Visual Studio Code authored from scratch by **Krishna Deshmukh**. It addresses the friction of juggling multiple heavy extensions (Error Lens, ESLint, Prettier, CodeMetrics, and AI assistants) by unifying them into a single, cohesive, high-performance developer tool.

Built with strict **TypeScript**, **VS Code Extension API**, and local AST parsing, Fixora AI features **4 offline core engines** that run with zero internet latency, combined with context-aware AI review powered by **Google Gemini** and local **Ollama** models.

---

## 🏗️ Architecture & Working Model

Fixora AI operates through a responsive event-driven pipeline that coordinates real-time editor events with static analysis and AI reasoning engines:

```mermaid
flowchart TD
    subgraph Editor ["Visual Studio Code Editor"]
        Doc[Active Document Events]
        Keystroke[As-You-Type Debouncer: 120ms]
        SaveEvent[On Save / Format Hook]
    end

    subgraph OfflineCores ["Offline Local Engines (100% Local, 0ms Latency)"]
        Linter[Real-Time Multi-Language Linter\nJS / TS / Python / HTML / CSS]
        Complexity[Complexity Lens Engine\nCyclomatic CC & AST Decision Metrics]
        ErrorLens[Native Error Lens Engine\nInline Decorations & Gutter Icons]
        Formatter[Prettier Formatter & Syntax Healer\nSilent Bracket & Tag Auto-Repair]
    end

    subgraph AICloud ["Context-Aware AI Layer"]
        SecretScrubber[Client-Side Privacy Scrubber\nAPI Keys / Secrets Masked]
        Gemini[Google Gemini API / Ollama Local\n2.5 Flash / 2.5 Pro]
        ExplainEngine[7-Question Root Cause Explainer]
    end

    subgraph Presentation ["Interactive VS Code Presentation Layer"]
        InlineDeco[Inline End-of-Line Diagnostic Lens]
        RightDeco[Right-Side Function CC Badges: ⚡ CC: X]
        Lightbulb[💡 QuickFix Actions: Ctrl + .]
        SidebarUI[Activity Bar Webview with Feature Toggles]
        DiffView[Side-by-Side Diff Preview]
    end

    Doc --> Keystroke
    Doc --> SaveEvent

    Keystroke --> Linter
    Keystroke --> Complexity
    SaveEvent --> Formatter

    Linter --> ErrorLens
    Complexity --> RightDeco
    Complexity --> Lightbulb
    Linter --> Lightbulb
    ErrorLens --> InlineDeco

    Doc -.->|User Triggers Review| SecretScrubber
    SecretScrubber --> Gemini
    Gemini --> ExplainEngine
    ExplainEngine --> SidebarUI
    ExplainEngine --> DiffView
```

---

## 🌟 The 4 Built-In Powerhouses

### 1. ⚡ Native Error Lens (Inline Diagnostics)
- **Inline Message Rendering**: Renders errors, warnings, and hints directly at the end of the problematic line as you write code.
- **Line Highlighting**: Subtly illuminates line backgrounds based on diagnostic severity (Critical Red, Warning Yellow, Info Blue).
- **Status Bar Navigator**: Displays real-time error counts in the status bar with rapid navigation shortcuts:
  - `Alt + F8`: Jump to next error in file
  - `Shift + Alt + F8`: Jump to previous error in file
  - `Alt + E`: Toggle inline error lens on/off

### 2. 🧠 Code Complexity Lens & 1-Click Offline Refactoring
- **Right-Side Metrics Badges**: Automatically measures cyclomatic complexity (CC) and displays a color-coded rating on the right side of every function declaration:
  - `⚡ CC: 1-5 (Clean)` — Green
  - `⚡ CC: 6-10 (Moderate)` — Yellow
  - `⚡ CC: >10 (High Complexity)` — Red
- **Interactive Hover Cards**: Hovering reveals decision branch points, maintainability index, and a low-complexity alternative.
- **Instant Offline Refactoring (`Ctrl + .`)**: Press `Ctrl + .` on any complex function to select:
  > `💡 Fixora AI: Replace with low-complexity alternative code (Offline Refactor: CC 14 ➔ 2)`  
  Replaces nested condition ladders with early exit guard clauses and $O(1)$ dictionary lookup tables completely offline.

### 3. 🔍 Real-Time Multi-Language Linter (As-You-Type)
Validates code on the fly without waiting for external server responses:
- **JavaScript & TypeScript**: Catches loose equalities (`eqeqeq`), obsolete `var` declarations (`no-var`), `debugger;` statements, `console.log` in production, condition assignment traps `if (x = 5)`, and unbalanced braces.
- **Python**: Catches missing colons `:` after statements, PEP 8 comparisons (`is None` vs `== None`, `== True`), and bare `except:` clauses.
- **HTML**: Detects missing `alt` attributes on `<img>` tags, deprecated HTML5 tags (`<center>`, `<font>`, `<marquee>`), unclosed tags, and mismatched closing tags.
- **CSS / SCSS**: Catches missing semicolons, unnecessary zero units (`0px` $\rightarrow$ `0`), missing dimension units on non-zero lengths (`width: 200;`), and duplicate properties.
- **1-Click QuickFixes**: Every detected lint issue provides an automated quick fix via the VS Code lightbulb.

### 4. ✨ Prettier Formatter & Silent Syntax Auto-Healer
- **Integrated Prettier**: Native opinionated formatting for JS, TS, HTML, CSS, JSON, Markdown, and YAML.
- **Silent Syntax Healer**: Automatically auto-repairs missing braces, unclosed JSX/HTML tags, and trailing stray syntax upon save or run without interrupting the developer with modal error popups.

---

## 🤖 Context-Aware AI Review & Debugging

When you need high-level architectural insight, Fixora AI taps into **Google Gemini** or local **Ollama**:
- **Selection & File Review**: Deep code audits highlighting security flaws, memory leaks, and performance bottlenecks.
- **OWASP Security Audit**: Scans for SQL injection, Cross-Site Scripting (XSS), command injection, and insecure deserialization.
- **7-Question Error Explanations**: Answers *What happened?*, *Why did it happen?*, *Where is it?*, *What is the root cause?*, and *How do I fix it?* with verified copyable code.
- **Atomic Diff Previews**: Inspect side-by-side visual diffs before applying any change. Fixes are applied cleanly through VS Code's `WorkspaceEdit` with zero full-file overwrites.
- **100% Client-Side Secret Redaction**: All API keys, passwords, and tokens are scrubbed locally into `[REDACTED_SECRET]` before hitting the network.

---

## 🎛️ Interactive Sidebar Dashboard

The activity bar panel provides a clean, distraction-free control center:

```
┌──────────────────────────────────────────────┐
│  Fixora AI                                   │
│  Find Bugs. Understand Errors. Fix Code.     │
├──────────────────────────────────────────────┤
│  Live Editor Features                        │
│  ⚡ Error Lens               [ ON  |  OFF ]   │
│  🧠 Code Complexity Lens     [ ON  |  OFF ]   │
│  🔍 Real-time Linter         [ ON  |  OFF ]   │
│  ✨ Prettier Formatter       [ ON  |  OFF ]   │
│                                              │
│  [ Format Document ]   [ Complexity Audit ]  │
├──────────────────────────────────────────────┤
│  AI Actions & Security                       │
│  • Review Selected Code                      │
│  • Review Current File                       │
│  • Security Scan (OWASP Top 10)              │
│  • Review Workspace                          │
│  • Review Git Changes                        │
│  • Install Git Pre-Commit Guard              │
│  • Export HTML Audit Report                  │
└──────────────────────────────────────────────┘
```

---

## ⌨️ Command & Shortcut Reference

| Command | Identifier | Shortcut |
| :--- | :--- | :--- |
| **Review Selected Code** | `fixora.reviewSelection` | `Ctrl+Alt+R` (`Cmd+Alt+R`) |
| **Explain Selected Error** | `fixora.explainError` | `Ctrl+Alt+E` (`Cmd+Alt+E`) |
| **Toggle Error Lens** | `fixora.toggleInlineDiagnostics` | `Alt+E` |
| **Jump to Next Diagnostic** | `fixora.nextDiagnostic` | `Alt+F8` |
| **Jump to Previous Diagnostic** | `fixora.previousDiagnostic` | `Shift+Alt+F8` |
| **Format Document** | `fixora.formatDocument` | `Shift+Alt+F` |
| **Format Selection** | `fixora.formatSelection` | `Ctrl+K Ctrl+F` |
| **Toggle Complexity Lens** | `fixora.toggleComplexityLens` | — |
| **Toggle Real-time Linter** | `fixora.toggleLinter` | — |
| **Toggle Prettier Formatter** | `fixora.toggleFormatter` | — |
| **Security Audit** | `fixora.securityScan` | — |
| **Review Active File** | `fixora.reviewFile` | — |
| **Review Workspace** | `fixora.reviewWorkspace` | — |
| **Review Git Changes** | `fixora.reviewGit` | — |
| **Export HTML Report** | `fixora.exportReport` | — |
| **Install Pre-Commit Hook** | `fixora.installGitHook` | — |

---

## 🧪 Rigorous Quality & Verification

Fixora AI has been built and tested with industry-standard test-driven engineering:
- **30 Comprehensive Test Suites**
- **162 Passing Unit Tests** with 100% pass rate
- **Zero-Dependency VSIX Packaging**: Bundled via Esbuild into an ultra-lean 1.58 MB binary.

To run the test suite locally:
```bash
npm install
npm run compile
npm run test:unit
```

---

## 👨‍💻 Developer & Author

- **Author**: Krishna Deshmukh
- **Publisher**: `FixoraFoundation` (Marketplace: `Fixora.foundation`)
- **Email**: [krishnadeshmukh721@gmail.com](mailto:krishnadeshmukh721@gmail.com)
- **LinkedIn**: [https://www.linkedin.com/in/krishnadeshmukh13](https://www.linkedin.com/in/krishnadeshmukh13)
- **Repository**: [https://github.com/krishna-Deshmukh13/Fixora-AI---Extension](https://github.com/krishna-Deshmukh13/Fixora-AI---Extension)

---

## 📄 License

Fixora AI is open-source software licensed under the [MIT License](LICENSE).
