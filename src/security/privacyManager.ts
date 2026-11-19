import * as vscode from 'vscode';
import { FileUtils } from '../utils/fileUtils';
import { Logger } from '../utils/logger';

/**
 * Manages user privacy, credential redaction, workspace trust, and network transmission boundaries.
 */
export class PrivacyManager {
  private static instance: PrivacyManager;
  private static readonly CONSENT_KEY = 'fixora.aiConsentAcknowledged';
  private logger = Logger.getInstance();

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public static initialize(context: vscode.ExtensionContext): PrivacyManager {
    if (!PrivacyManager.instance) {
      PrivacyManager.instance = new PrivacyManager(context);
    }
    return PrivacyManager.instance;
  }

  public static getInstance(): PrivacyManager {
    if (!PrivacyManager.instance) {
      throw new Error('PrivacyManager must be initialized before use.');
    }
    return PrivacyManager.instance;
  }

  /**
   * Check if workspace is trusted by the user.
   * If untrusted, external static analyzer execution is blocked for security.
   */
  public isWorkspaceTrusted(): boolean {
    return vscode.workspace.isTrusted;
  }

  /**
   * Ensures the user has acknowledged the AI transmission privacy notice.
   */
  public async ensurePrivacyConsent(): Promise<boolean> {
    const acknowledged = this.context.globalState.get<boolean>(PrivacyManager.CONSENT_KEY, false);
    if (acknowledged) {
      return true;
    }

    const choice = await vscode.window.showInformationMessage(
      'Fixora AI Privacy Notice: Code reviews and error explanations send code snippets directly to Google Gemini API using your configured API key over secure HTTPS. No telemetry or training data is retained by Fixora AI.',
      'I Understand',
      'Learn More'
    );

    if (choice === 'Learn More') {
      vscode.commands.executeCommand(
        'vscode.open',
        vscode.Uri.parse('https://ai.google.dev/gemini-api/terms')
      );
      return false;
    }

    if (choice === 'I Understand') {
      await this.context.globalState.update(PrivacyManager.CONSENT_KEY, true);
      this.logger.info('User acknowledged privacy consent notice.');
      return true;
    }

    return false;
  }

  /**
   * Redacts sensitive API keys, tokens, and private keys from code before it leaves the machine.
   */
  public sanitizeCodeForTransmission(code: string): string {
    let sanitized = code;

    // 1. Redact Google API keys
    sanitized = sanitized.replace(/\bAIza[0-9A-Za-z-_]{35}\b/g, '[REDACTED_GOOGLE_API_KEY]');

    // 2. Redact AWS Access Keys
    sanitized = sanitized.replace(
      /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
      '[REDACTED_AWS_KEY]'
    );

    // 3. Redact GitHub Personal Access Tokens
    sanitized = sanitized.replace(
      /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
      '[REDACTED_GITHUB_PAT]'
    );

    // 4. Redact Private Key blocks
    sanitized = sanitized.replace(
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
      '[REDACTED_PRIVATE_KEY]'
    );

    // 5. Redact JWT tokens
    sanitized = sanitized.replace(
      /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
      '[REDACTED_JWT_TOKEN]'
    );

    return sanitized;
  }

  /**
   * Validates if a file is safe to transmit (blocks .env and private key files).
   */
  public isFileSafeForTransmission(filePath: string): boolean {
    const lower = filePath.toLowerCase();

    // Absolute block on .env files and private keys
    if (lower.includes('.env') || lower.endsWith('.pem') || lower.endsWith('.key') || lower.endsWith('.pfx')) {
      this.logger.warn(`Transmission blocked for sensitive file: ${filePath}`);
      return false;
    }

    // Check glob exclusions (node_modules, .git, etc.)
    return !FileUtils.isFileExcluded(filePath);
  }
}
