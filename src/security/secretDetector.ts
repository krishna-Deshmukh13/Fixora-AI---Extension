import { ReviewFinding } from '../types';

export interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: 'critical' | 'warning';
  explanation: string;
}

/**
 * Deterministic scanner that detects hardcoded API credentials, cryptographic keys, and tokens.
 */
export class SecretDetector {
  private static readonly PATTERNS: SecretPattern[] = [
    {
      name: 'Google API Key',
      regex: /\bAIza[0-9A-Za-z-_]{35}\b/,
      severity: 'critical',
      explanation: 'Hardcoded Google API key detected. Exposed keys allow unauthorized API usage and billing abuse.',
    },
    {
      name: 'AWS Access Key ID',
      regex: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/,
      severity: 'critical',
      explanation: 'Hardcoded AWS Access Key ID detected. Attackers can leverage AWS keys to access cloud infrastructure.',
    },
    {
      name: 'GitHub Personal Access Token',
      regex: /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/,
      severity: 'critical',
      explanation: 'Exposed GitHub Personal Access Token. Can lead to source code tampering and repository compromise.',
    },
    {
      name: 'Private Cryptographic Key',
      regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
      severity: 'critical',
      explanation: 'Unencrypted private cryptographic key embedded in source code. Compromises transport or signature security.',
    },
    {
      name: 'Slack Webhook / Token',
      regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9a-zA-Z_]{8}\/B[0-9a-zA-Z_]{8}\/[0-9a-zA-Z_]{24}|xox[baprs]-[0-9a-zA-Z]{10,48}/,
      severity: 'critical',
      explanation: 'Slack webhook URL or bot token exposed. Allows unauthorized channel messaging and eavesdropping.',
    },
    {
      name: 'Hardcoded Secret / Password Assignment',
      regex: /(?:password|passwd|pwd|api_key|apikey|secret_key|client_secret|auth_token)\s*[:=]\s*["']([^"']{8,})["']/i,
      severity: 'critical',
      explanation: 'Hardcoded credential assigned directly in code. Secrets must be stored in environment variables or key vaults.',
    },
    {
      name: 'Stripe Live Secret Key',
      regex: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24,}\b/,
      severity: 'critical',
      explanation: 'Live Stripe Secret API Key exposed. Allows unauthorized charge creation, refund manipulation, and customer financial data exposure.',
    },
    {
      name: 'OpenAI API Key',
      regex: /\bsk-(?:proj-|live-)?[a-zA-Z0-9_-]{32,}\b/,
      severity: 'critical',
      explanation: 'Exposed OpenAI API Key. Leads to quota exhaustion and unauthorized model access billed to your account.',
    },
    {
      name: 'Database Connection String with Password',
      regex: /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s'"]+:([^@\s'"]+)@[^/\s'"]+/i,
      severity: 'critical',
      explanation: 'Database connection URI contains embedded plaintext credentials. Exposes production database directly to unauthorized access.',
    },
    {
      name: 'Twilio Account Credentials',
      regex: /\bAC[a-zA-Z0-9]{32}\b/,
      severity: 'critical',
      explanation: 'Twilio Account SID detected. May allow unauthorized SMS/voice dispatches and toll fraud.',
    },
    {
      name: 'SendGrid API Key',
      regex: /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/,
      severity: 'critical',
      explanation: 'SendGrid email API key exposed. Attackers can hijack email infrastructure for phishing or spam.',
    },
    {
      name: 'Discord Bot Token',
      regex: /\b[MN][A-Za-z\d]{23,26}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,38}\b/,
      severity: 'critical',
      explanation: 'Discord Bot Token exposed. Allows full takeover of bot permissions in Discord servers.',
    },
    {
      name: 'JSON Web Token (JWT)',
      regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
      severity: 'warning',
      explanation: 'Hardcoded JWT authorization token detected. Tokens should be dynamically acquired at runtime.',
    },
  ];

  /**
   * Scans text for exposed credentials and returns ReviewFindings.
   */
  public static scan(code: string, filePath: string): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = code.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNumber = i + 1;

      // Skip comment documentation lines that mention example keys
      if (lineText.includes('AIzaSy...') || lineText.includes('your-api-key') || lineText.includes('example')) {
        continue;
      }

      for (const pattern of this.PATTERNS) {
        const match = lineText.match(pattern.regex);
        if (match) {
          const col = (match.index || 0) + 1;
          findings.push({
            id: `secret-${Date.now()}-${findings.length + 1}`,
            title: `Exposed Credential: ${pattern.name}`,
            severity: pattern.severity,
            category: 'security',
            filePath,
            line: lineNumber,
            column: col,
            explanation: pattern.explanation,
            whyItMatters: 'Committed secrets can be harvested by malicious actors from version control and build logs.',
            suggestedSolution: 'Immediately revoke the credential, replace with environment variable (e.g. process.env.API_KEY), and rotate the secret.',
            confidence: 0.99,
            source: 'static',
            conceptName: 'Secret Management & Defense-in-Depth',
          });
        }
      }
    }

    return findings;
  }
}
