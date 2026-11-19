import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Dedicated output channel logger for Fixora AI.
 * Ensures credentials and sensitive tokens are automatically redacted.
 */
export class Logger {
  private static instance: Logger;
  private channel: vscode.OutputChannel;
  private readonly secretRegex = /(?:key|token|secret|password|auth|bearer)\s*[:=]\s*["']?([a-zA-Z0-9_\-]{8,})["']?/gi;

  private constructor() {
    this.channel = vscode.window.createOutputChannel('Fixora AI');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = this.redactSecrets(message);
    let output = `[${timestamp}] [${level}] ${sanitizedMessage}`;

    if (data !== undefined) {
      try {
        const serialized = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        output += `\n${this.redactSecrets(serialized)}`;
      } catch {
        output += `\n[Unserializable Data]`;
      }
    }

    this.channel.appendLine(output);
  }

  public debug(message: string, data?: unknown): void {
    this.log('DEBUG', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.log('INFO', message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.log('WARN', message, data);
  }

  public error(message: string, error?: unknown): void {
    this.log('ERROR', message, error);
  }

  public show(): void {
    this.channel.show();
  }

  public dispose(): void {
    this.channel.dispose();
  }

  /**
   * Redacts sensitive keys, tokens and credentials from log outputs.
   */
  private redactSecrets(text: string): string {
    return text.replace(this.secretRegex, (match, secret) => {
      const redacted = secret.slice(0, 3) + '...' + secret.slice(-3);
      return match.replace(secret, redacted);
    });
  }
}
