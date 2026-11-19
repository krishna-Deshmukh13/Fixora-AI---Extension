import * as vscode from 'vscode';
import { AIManager } from '../ai/aiManager';
import { SidebarProvider } from '../providers/sidebarProvider';
import { DiagnosticManager } from '../diagnostics/diagnosticManager';
import { LanguageDetector } from '../utils/languageDetector';
import { FileUtils } from '../utils/fileUtils';
import { SecretDetector } from '../security/secretDetector';
import { ReviewFinding, ReviewResult } from '../types';
import { Logger } from '../utils/logger';

/**
 * Dedicated security engine coordinating secret detection, deterministic OWASP pattern matching,
 * and contextual AI vulnerability review.
 */
export class SecurityEngine {
  private static instance: SecurityEngine;
  private logger = Logger.getInstance();

  public static readonly SECURITY_DISCLAIMER =
    'Notice: Automated Fixora AI security scans identify common high-risk vulnerabilities and credentials. It does not replace a manual penetration test or formal compliance audit.';

  private constructor(
    private readonly aiManager: AIManager,
    private readonly sidebarProvider: SidebarProvider
  ) {}

  public static initialize(aiManager: AIManager, sidebarProvider: SidebarProvider): SecurityEngine {
    if (!SecurityEngine.instance) {
      SecurityEngine.instance = new SecurityEngine(aiManager, sidebarProvider);
    }
    return SecurityEngine.instance;
  }

  public static getInstance(): SecurityEngine {
    if (!SecurityEngine.instance) {
      throw new Error('SecurityEngine must be initialized before use.');
    }
    return SecurityEngine.instance;
  }

  /**
   * Conducts an in-depth security scan on the provided document.
   */
  public async auditDocument(document: vscode.TextDocument): Promise<ReviewResult | null> {
    const filePath = document.fileName;

    if (FileUtils.isFileExcluded(filePath)) {
      vscode.window.showInformationMessage('Fixora AI: File is excluded from security scans by configuration.');
      return null;
    }

    const code = document.getText();
    if (!code || code.trim().length === 0) {
      vscode.window.showWarningMessage('Fixora AI: Document is empty.');
      return null;
    }

    const langInfo = LanguageDetector.detect(filePath, document.languageId, code);
    this.logger.info(`Starting dedicated security audit on ${filePath} (${langInfo.name})`);

    const isConfigured = await this.aiManager.isConfigured();
    if (!isConfigured) {
      const action = await vscode.window.showWarningMessage(
        'Fixora AI requires a Gemini API Key for deep security vulnerability audits.',
        'Configure API Key'
      );
      if (action === 'Configure API Key') {
        await vscode.commands.executeCommand('fixora.configureApiKey');
      }
      return null;
    }

    const config = vscode.workspace.getConfiguration('fixora');
    const learningMode = config.get<boolean>('enableLearningMode', false);

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fixora AI: Security Audit (${document.fileName.split(/[\\/]/).pop()})`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ message: 'Scanning for OWASP vulnerabilities and exposed secrets...' });
        this.sidebarProvider.broadcastState(true, 'Auditing code security...');

        try {
          // 1. Run local deterministic secret detection
          const secretFindings = SecretDetector.scan(code, filePath);

          // 2. Run local deterministic OWASP vulnerability rules
          const staticOwaspFindings = this.runDeterministicSecurityChecks(code, filePath, langInfo.id);
          const localFindings = [...secretFindings, ...staticOwaspFindings];

          // 3. Run AI deep security review with fallback to local findings
          let mergedFindings: ReviewFinding[];
          let summaryMessage: string;
          let durationMs = 0;
          let providerName = 'Google Gemini';
          let modelName = 'gemini-1.5-flash';

          try {
            const aiResult = await this.aiManager.reviewSecurity(
              {
                code,
                filePath,
                languageId: langInfo.id,
                learningMode,
              },
              token
            );
            mergedFindings = this.mergeSecurityFindings(localFindings, aiResult.findings);
            summaryMessage = aiResult.summary;
            durationMs = aiResult.durationMs;
            providerName = aiResult.providerName;
            modelName = aiResult.modelName;
          } catch (aiErr: any) {
            if (token.isCancellationRequested) {
              throw aiErr;
            }
            this.logger.warn(`AI security scan failed (${aiErr?.message || aiErr}). Falling back to local security rules.`);
            if (localFindings.length > 0) {
              mergedFindings = localFindings;
              summaryMessage = `Local security engine detected ${localFindings.length} issue(s). Note: AI scan unavailable: ${aiErr?.message || 'Check network'}.`;
              providerName = 'Fixora Security Scanner';
              modelName = 'Deterministic Scanner';
            } else {
              throw aiErr;
            }
          }

          const criticalCount = mergedFindings.filter((f) => f.severity === 'critical').length;
          const warningCount = mergedFindings.filter((f) => f.severity === 'warning').length;
          const infoCount = mergedFindings.filter((f) => f.severity === 'info' || f.severity === 'hint').length;

          const result: ReviewResult = {
            summary: `${summaryMessage}\n\n${SecurityEngine.SECURITY_DISCLAIMER}`,
            findings: mergedFindings,
            durationMs,
            filesAnalyzed: [filePath],
            providerName,
            modelName,
            timestamp: new Date().toISOString(),
            totalIssues: mergedFindings.length,
            criticalCount,
            warningCount,
            infoCount,
          };

          // 5. Publish findings to sidebar and Problems panel
          this.sidebarProvider.displayReviewResult(result);
          DiagnosticManager.getInstance().publishFindings(document.uri, result.findings);

          const summaryText =
            result.totalIssues === 0
              ? 'No security vulnerabilities detected!'
              : `Found ${result.totalIssues} security issue${result.totalIssues > 1 ? 's' : ''} (${criticalCount} critical, ${warningCount} warnings).`;

          vscode.window.showInformationMessage(`Fixora AI: Security scan finished. ${summaryText}`);
          return result;
        } catch (err: any) {
          if (token.isCancellationRequested) {
            this.sidebarProvider.broadcastState(false);
            return null;
          }

          const msg = err?.message || 'Security scan failed.';
          this.sidebarProvider.displayError(msg);
          vscode.window.showErrorMessage(`Fixora AI: ${msg}`);
          return null;
        }
      }
    );
  }

  /**
   * Deterministic checks for classic OWASP vulnerability patterns.
   */
  public runDeterministicSecurityChecks(
    code: string,
    filePath: string,
    languageId: string
  ): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const lines = code.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNumber = i + 1;

      // 1. Cross-Site Scripting (XSS) via dangerouslySetInnerHTML or unescaped innerHTML
      if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
        if (/dangerouslySetInnerHTML\s*=\s*\{/.test(lineText)) {
          findings.push({
            id: `sec-xss-dangerously-${lineNumber}`,
            title: 'Potential XSS: dangerouslySetInnerHTML',
            severity: 'critical',
            category: 'security',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('dangerouslySetInnerHTML') + 1,
            explanation: 'Rendering unescaped HTML directly bypasses React XSS protections, enabling script injection.',
            whyItMatters: 'Allows attackers to execute malicious JavaScript in victims’ browsers (session hijacking, cookie theft).',
            suggestedSolution: 'Sanitize content with DOMPurify before rendering, or prefer safe text elements.',
            confidence: 0.95,
            source: 'static',
            conceptName: 'Cross-Site Scripting (XSS)',
          });
        }

        if (/\.innerHTML\s*=\s*(?!['"`]<)/.test(lineText)) {
          findings.push({
            id: `sec-xss-innerhtml-${lineNumber}`,
            title: 'Direct DOM XSS: innerHTML Assignment',
            severity: 'critical',
            category: 'security',
            filePath,
            line: lineNumber,
            column: lineText.indexOf('innerHTML') + 1,
            explanation: 'Direct assignment of dynamic values to innerHTML can execute arbitrary scripts.',
            whyItMatters: 'Enables stored or reflected Cross-Site Scripting (XSS).',
            suggestedSolution: 'Use textContent or a secure sanitization library instead of innerHTML.',
            confidence: 0.92,
            source: 'static',
            conceptName: 'DOM-based XSS',
          });
        }
      }

      // 2. Command Injection (child_process.exec with interpolation)
      if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
        if (/child_process\.(?:exec|execSync)\s*\(\s*`[^`]*\$\{/.test(lineText) || /exec\s*\([^)]*\+/.test(lineText)) {
          findings.push({
            id: `sec-cmd-injection-${lineNumber}`,
            title: 'Potential Command Injection',
            severity: 'critical',
            category: 'security',
            filePath,
            line: lineNumber,
            column: lineText.search(/exec(?:Sync)?/) + 1,
            explanation: 'Executing system commands with concatenated or interpolated variables allows command injection.',
            whyItMatters: 'Allows attackers to execute arbitrary system binaries on the hosting machine.',
            suggestedSolution: 'Use child_process.spawn with an array of arguments, avoiding shell construction.',
            confidence: 0.95,
            source: 'static',
            conceptName: 'Command Injection Prevention',
          });
        }
      }

      // 3. Broken Cryptography (MD5 or SHA1 for password/integrity)
      if (/(?:crypto\.createHash\s*\(\s*['"](md5|sha1)['"]\)|hashlib\.(md5|sha1)\s*\()/i.test(lineText)) {
        findings.push({
          id: `sec-weak-crypto-${lineNumber}`,
          title: 'Weak Cryptographic Hash (MD5/SHA-1)',
          severity: 'warning',
          category: 'security',
          filePath,
          line: lineNumber,
          column: 1,
          explanation: 'MD5 and SHA-1 suffer from known collision vulnerabilities and are cryptographically broken.',
          whyItMatters: 'Vulnerable to hash collisions, pre-image attacks, and rainbow table cracking.',
          suggestedSolution: 'Use SHA-256 (SHA-2), SHA-3, or password-specific algorithms (bcrypt, Argon2).',
          confidence: 0.98,
          source: 'static',
          conceptName: 'Cryptographic Hash Functions',
        });
      }

      // 4. Insecure Deserialization (Python pickle, PHP unserialize)
      if (languageId === 'python' && /\bpickle\.loads\s*\(/.test(lineText)) {
        findings.push({
          id: `sec-py-pickle-${lineNumber}`,
          title: 'Insecure Deserialization: pickle.loads',
          severity: 'critical',
          category: 'security',
          filePath,
          line: lineNumber,
          column: lineText.indexOf('pickle.loads') + 1,
          explanation: 'Deserializing untrusted data with pickle can execute arbitrary Python bytecode (__reduce__).',
          whyItMatters: 'Direct Remote Code Execution (RCE) on the server.',
          suggestedSolution: 'Use safe serialization formats such as JSON or Protocol Buffers.',
          confidence: 0.98,
          source: 'static',
          conceptName: 'Insecure Deserialization',
        });
      }

      // 5. Dynamic SQL string concatenation
      if (/SELECT\s+.*FROM\s+.*WHERE\s+.*(?:=|LIKE)\s*['"]?\s*\+\s*\w+|SELECT\s+.*WHERE\s+.*=\s*\$\{\w+\}/i.test(lineText)) {
        findings.push({
          id: `sec-sqli-${lineNumber}`,
          title: 'Potential SQL Injection',
          severity: 'critical',
          category: 'security',
          filePath,
          line: lineNumber,
          column: lineText.search(/SELECT/i) + 1,
          explanation: 'User-controlled variables concatenated directly into SQL query string.',
          whyItMatters: 'Allows attackers to manipulate query logic, dump database contents, or bypass authentication.',
          suggestedSolution: 'Use parameterized queries or prepared statements with bind parameters.',
          confidence: 0.95,
          source: 'static',
          conceptName: 'SQL Injection Prevention',
        });
      }
    }

    return findings;
  }

  private mergeSecurityFindings(
    staticFindings: ReviewFinding[],
    aiFindings: ReviewFinding[]
  ): ReviewFinding[] {
    const merged: ReviewFinding[] = [...staticFindings];
    const coveredLines = new Set(staticFindings.map((f) => f.line));

    for (const aiFinding of aiFindings) {
      if (coveredLines.has(aiFinding.line)) {
        const existing = merged.find((f) => f.line === aiFinding.line);
        if (existing) {
          existing.source = 'combined';
          existing.confidence = 1.0;
        }
      } else {
        merged.push({ ...aiFinding, category: 'security' });
        coveredLines.add(aiFinding.line);
      }
    }

    return merged.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return a.line - b.line;
    });
  }
}
