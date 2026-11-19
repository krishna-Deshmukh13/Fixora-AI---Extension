# Fixora AI Installation Guide

This guide walks you through installing and configuring **Fixora AI** on Visual Studio Code.

---

## Installation Methods

### Method 1: Install from the VS Code Marketplace (Recommended for Users)

1. Open **Visual Studio Code**.
2. Open the Extensions panel by pressing `Ctrl + Shift + X` (or `Cmd + Shift + X` on macOS).
3. In the search bar at the top, type **`Fixora AI`**.
4. In the search results, click the **Install** button on the Fixora AI extension card.
5. Once installation finishes, you will see the Fixora AI icon appear in the Activity Bar on the left side of your editor.

---

### Method 2: Install from Offline VSIX Package

If you have downloaded the `fixora-ai-0.1.0.vsix` file:

#### Option A: Using the VS Code GUI
1. Open Visual Studio Code.
2. Press `Ctrl + Shift + X` to open the Extensions view.
3. Click the **`...`** (Views and More Actions) menu in the top right corner of the Extensions panel.
4. Select **Install from VSIX...**.
5. Browse and select `fixora-ai-0.1.0.vsix`.
6. Click **Install**.

#### Option B: Using the Command Line
Open your terminal (PowerShell, Command Prompt, or bash) and run:
```powershell
code --install-extension path/to/fixora-ai-0.1.0.vsix
```

---

## Configuring Your Google Gemini API Key

Fixora AI uses Google Gemini to review code, detect bugs, and explain errors. Setting up your API key takes under 2 minutes:

1. **Obtain your Free API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Sign in with your Google account.
   - Click **Create API Key** and copy the generated key string (it starts with `AIza...`).

2. **Store Key in Fixora AI**:
   - Open Visual Studio Code.
   - Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS) to open the Command Palette.
   - Type and select: **`Fixora AI: Configure Gemini API Key`**.
   - Paste your API key into the prompt and press `Enter`.

> **Security Note**: Your API key is stored securely in your operating system's credential manager using VS Code's `SecretStorage` API. It is never logged, exposed to untrusted code, or committed to source control.

---

## Verifying Your Installation

1. Open any source code file (such as a `.js`, `.ts`, `.py`, or `.java` file).
2. Highlight a small function.
3. Right-click and choose **Fixora AI: Review Selected Code** (Shortcut: `Ctrl + Shift + F1`).
4. Click on the Fixora AI icon in the Activity Bar to view the interactive dashboard.
5. If the scan completes and displays metrics, your setup is complete and fully operational!
