# Revion (Fixora AI): Privacy & Security Disclosure

**Revion** is committed to uncompromising user privacy and data security. This document details how source code and credentials are handled by the extension.

---

## 1. What Information Leaves Your Computer?

Revion only transmits code when you explicitly trigger an action (e.g., clicking **Review Selected Code**, **Review Current File**, **Security Scan**, sending an **Assistant Chat** message, or **Explain Error**).

### Exactly What Is Transmitted:
- **Code Snippet / Selected Text**: The active file or selected block of code you requested to review.
- **File Metadata**: The file extension and detected language identifier (e.g. `typescript`, `python`) to tune AI analysis prompts.
- **Error Messages**: Compiler errors, diagnostic logs, or terminal stack traces you highlight or paste for explanation.

### What Is NEVER Transmitted:
- **Environment & Secret Files**: Files matching `.env*`, `.pem`, `.key`, and `.pfx` are strictly excluded from transmission by default.
- **Build & Dependency Artifacts**: `node_modules/`, `.git/`, `dist/`, `build/`, `vendor/`, `venv/`, and lockfiles are never scanned or uploaded.
- **Unselected Files**: Revion never silently uploads your entire repository in the background.
- **Telemetry & Tracking**: Revion collects **zero** behavioral telemetry, tracking cookies, or diagnostic pings.

---

## 2. Which Provider Receives Your Code?

- **Google Gemini API**: Transmissions are sent via secure HTTPS encrypted channels directly to the official Google Gemini API (`generativelanguage.googleapis.com`) using the official `@google/genai` SDK.
- **Local Ollama (100% Offline)**: When using Ollama, zero requests leave your machine. Prompts are processed locally on your hardware.
- **Direct Client-to-API Architecture**: Revion does not proxy your requests through any intermediate third-party servers. Your local VS Code instance connects directly to Google AI Studio.
- **Data Training**: According to Google's API Terms for paid or enterprise tiers, API prompt content is not used to train Google's models. For more details, consult the [Google Gemini API Terms of Service](https://ai.google.dev/gemini-api/terms).

---

## 3. How Are API Credentials Stored?

- **VS Code SecretStorage**: Your Google Gemini API Key is stored exclusively in VS Code's encrypted `SecretStorage` (`context.secrets`), which leverages operating system keychains:
  - **Windows**: Windows Credential Manager (DPAPI)
  - **macOS**: Apple Keychain
  - **Linux**: Secret Service API / GNOME Keyring
- **Never In Plaintext**: Your key is never written to `settings.json`, workspace folders, log files, or environment variables.

---

## 4. Automatic Client-Side Credential Redaction

Before any code payload is transmitted to the AI provider, Revion's `PrivacyManager` performs local regex redaction. If hardcoded credentials (such as AWS keys `AKIA...`, Google keys `AIza...`, GitHub tokens `ghp_...`, or private RSA keys) exist in the code snippet, they are replaced with `[REDACTED_SECRET]` placeholders on your machine, ensuring secrets are never broadcast over the network.

---

## 5. Offline & Pure Local Operation

You can use Revion in complete offline or privacy-hardened mode without configuring an AI key:
- Local deterministic heuristic bug detection executes entirely on your CPU.
- Local static analyzers (Checkstyle/javac, ESLint, Ruff, Clang-Tidy, PHPStan, HTMLHint, Stylelint, SQLFluff) run locally as sandboxed processes.
- Native Error Lens, Complexity Lens, and Prettier Formatter run 100% locally.
- Switching provider to **Ollama** runs LLMs locally on your own GPU/CPU.
