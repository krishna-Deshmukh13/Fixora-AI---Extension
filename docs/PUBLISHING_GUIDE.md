# Fixora AI: Official VS Code Marketplace Publishing Guide

This guide provides end-to-end instructions for publishing **Fixora AI** to the official Visual Studio Code Marketplace so developers globally can discover and install it directly via `Ctrl + Shift + X`.

---

## Prerequisites

1. A **Microsoft Account** or **GitHub Account**.
2. **Node.js** (v20 or higher) and **npm** installed.
3. The VS Code Extension CLI tool (`@vscode/vsce`):
   ```powershell
   npm install -g @vscode/vsce
   ```

---

## Step 1: Create a Visual Studio Marketplace Publisher

1. Go to the [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Sign in with your Microsoft account.
3. Click **Create Publisher**.
4. Fill in the required details:
   - **Publisher ID**: `FixoraFoundation` (must match the `"publisher"` field in `package.json`).
   - **Display Name**: `Fixora.foundation` (this is what appears under the icon in VS Code!).
   - **Support Email**: `krishnadeshmukh721@gmail.com`.
5. Click **Create**.

---

## Step 2: Generate an Azure DevOps Personal Access Token (PAT)

A Personal Access Token (PAT) is required by `vsce` to authenticate with the Marketplace API:

1. Visit [Azure DevOps](https://dev.azure.com/).
2. In the top-right corner, click your user profile icon and select **Personal access tokens**.
3. Click **+ New Token**.
4. Configure token settings:
   - **Name**: `VS Code Marketplace - Fixora AI`.
   - **Organization**: Select **All accessible organizations**.
   - **Expiration**: 90 days (or 1 year).
   - **Scopes**: Click **Show all scopes** at the bottom, scroll down to **Marketplace**, and check:
     - **Acquire**
     - **Manage**
5. Click **Create**.
6. **IMPORTANT**: Copy the generated Personal Access Token string and save it securely. You will not be able to view it again.

---

## Step 3: Log In to the Publisher via VSCE

Open your terminal and authenticate `vsce` with your publisher name and PAT:

```powershell
vsce login FixoraFoundation
```

When prompted:
```text
Personal Access Token for publisher 'FixoraFoundation': [PASTE_YOUR_AZURE_DEVOPS_PAT_HERE]
```

You will see:
```text
The Personal Access Token verification succeeded for the publisher 'FixoraFoundation'.
```

---

## Step 4: Verify the VSIX Package Locally

Before publishing publicly, verify that the production package builds cleanly:

```powershell
cd C:\Users\krish\.gemini\antigravity\scratch\fixora-ai
npm run package
```

Ensure the package generation completes with zero errors:
```text
DONE Packaged: fixora-ai-0.1.0.vsix
```

You can test installing the generated `.vsix` into your local VS Code by running:
```powershell
code --install-extension fixora-ai-0.1.0.vsix
```

---

## Step 5: Publish Fixora AI to the Marketplace

Publish the package directly to the marketplace using `vsce`:

```powershell
vsce publish
```

VSCE will:
1. Run the `vscode:prepublish` script (`esbuild --production`).
2. Package the extension with required metadata and icon assets.
3. Upload the package to the official Visual Studio Marketplace.

You will see:
```text
Publishing fixora-ai@0.1.0...
Your extension will be live in a few minutes.
```

---

## Step 6: Verify the Public Listing

1. Wait approximately 5 to 10 minutes for Microsoft's automated security verification and CDN indexing to finish.
2. Visit your public marketplace page:
   `https://marketplace.visualstudio.com/items?itemName=fixora-ai.fixora-ai`
3. Verify that:
   - The logo and banners render properly.
   - The README, feature documentation, and badges display correctly.
   - The categories and tags are present.

---

## Step 7: Test Installation from Within VS Code

Now verify the experience for end users anywhere in the world:

1. Open **Visual Studio Code**.
2. Press `Ctrl + Shift + X`.
3. Search for **`Fixora AI`**.
4. The extension will appear in the search results.
5. Click **Install**.
6. Press `Ctrl + Shift + P` -> **`Fixora AI: Configure Gemini API Key`**.
7. Start using Fixora AI!

---

## Managing Future Updates (Semantic Versioning)

When releasing bug fixes or new features:

- **Patch release** (e.g. `0.1.0` -> `0.1.1`):
  ```powershell
  vsce publish patch
  ```
- **Minor feature release** (e.g. `0.1.0` -> `0.2.0`):
  ```powershell
  vsce publish minor
  ```
- **Major release** (e.g. `0.1.0` -> `1.0.0`):
  ```powershell
  vsce publish major
  ```

`vsce` automatically updates `package.json`, creates a git tag, and uploads the new version to the Marketplace.
