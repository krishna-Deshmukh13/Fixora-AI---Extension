# Revion Installation Guide (Fixora AI)

This guide walks you through installing and configuring **Revion** (Marketplace ID: `FixoraFoundation.fixora-ai`) on Visual Studio Code.

---

## Installation Methods

### Method 1: Install from the VS Code Marketplace (Recommended for Users)

1. Open **Visual Studio Code**.
2. Open the Extensions panel by pressing `Ctrl + Shift + X` (or `Cmd + Shift + X` on macOS).
3. In the search bar at the top, type **`Revion`** or **`Fixora AI`**.
4. Click the **Install** button on the Revion extension card.
5. Once installation finishes, you will see the Revion brand icon appear in the Activity Bar on the left side of your editor.

---

### Method 2: Install from Offline VSIX Package

If you have downloaded the production `.vsix` file:

#### Option A: Using the VS Code GUI
1. Open Visual Studio Code.
2. Press `Ctrl + Shift + X` to open the Extensions view.
3. Click the **`...`** (Views and More Actions) menu in the top right corner of the Extensions panel.
4. Select **Install from VSIX...**.
5. Browse and select the `.vsix` file.
6. Click **Install**.

#### Option B: Using the Command Line
Open your terminal (PowerShell, Command Prompt, or bash) and run:
```bash
code --install-extension fixora-ai-0.2.0.vsix
```

---

## Configuring Your AI Provider

### Option 1: Google Gemini API (Recommended)
1. **Obtain your Free API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Sign in with your Google account.
   - Click **Create API Key** and copy the generated key string (starts with `AIza...`).

2. **Store Key in Revion**:
   - Open Visual Studio Code.
   - Press `Ctrl + Shift + P` to open the Command Palette.
   - Type and select: **`Revion: Configure Gemini API Key`**.
   - Paste your API key into the prompt and press `Enter`.
   - *Security Note: Your API key is stored securely in your operating system's keychain using VS Code's `SecretStorage` API.*

### Option 2: Local Ollama (100% Offline)
1. Install [Ollama](https://ollama.com) on your system.
2. Pull a coding model:
   ```bash
   ollama run codellama
   ```
3. In Revion's sidebar or settings, switch provider to **Ollama**. No API key or internet access required.

---

## Verifying Your Installation

1. Open any source code file (such as a `.js`, `.ts`, `.py`, or `.java` file).
2. Highlight a small function.
3. Right-click and choose **Fixora AI: Review Selected Code** (Shortcut: `Ctrl + Shift + F1`).
4. Click on the Fixora AI icon in the Activity Bar to view the interactive dashboard.
5. If the scan completes and displays metrics, your setup is complete and fully operational!
