import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityEngine } from '../../src/core/securityEngine';
import * as vscode from 'vscode';

describe('SecurityEngine', () => {
  let mockAiManager: any;
  let mockSidebarProvider: any;
  let engine: SecurityEngine;

  beforeEach(() => {
    mockAiManager = {
      isConfigured: vi.fn().mockResolvedValue(true),
      reviewSecurity: vi.fn().mockResolvedValue({
        summary: 'AI Security Audit complete.',
        findings: [
          {
            id: 'ai-sec-1',
            title: 'Unauthenticated Admin Endpoint',
            severity: 'critical',
            category: 'security',
            filePath: 'src/admin.ts',
            line: 50,
            explanation: 'Missing auth middleware',
            whyItMatters: 'Public access to admin operations',
            suggestedSolution: 'Add requireAdmin middleware',
            confidence: 0.98,
            source: 'ai',
          },
        ],
        durationMs: 180,
        providerName: 'Google Gemini',
        modelName: 'gemini-2.5-flash',
      }),
    };

    mockSidebarProvider = {
      broadcastState: vi.fn(),
      displayReviewResult: vi.fn(),
      displayError: vi.fn(),
    };

    (SecurityEngine as any).instance = undefined;
    engine = SecurityEngine.initialize(mockAiManager, mockSidebarProvider);
  });

  describe('runDeterministicSecurityChecks', () => {
    it('should detect React dangerouslySetInnerHTML XSS', () => {
      const code = '<div dangerouslySetInnerHTML={{ __html: userBio }} />';
      const findings = engine.runDeterministicSecurityChecks(code, 'profile.tsx', 'typescriptreact');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('dangerouslySetInnerHTML');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect command injection in child_process calls', () => {
      const code = 'const res = child_process.exec(`ping ${ipAddress}`);';
      const findings = engine.runDeterministicSecurityChecks(code, 'network.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Command Injection');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect weak cryptographic hash functions (MD5)', () => {
      const code = 'const hash = crypto.createHash("md5").update(password).digest("hex");';
      const findings = engine.runDeterministicSecurityChecks(code, 'auth.js', 'javascript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Weak Cryptographic Hash (MD5/SHA-1)');
      expect(findings[0].severity).toBe('warning');
    });

    it('should detect Python pickle insecure deserialization', () => {
      const code = 'data = pickle.loads(raw_input_bytes)';
      const findings = engine.runDeterministicSecurityChecks(code, 'api.py', 'python');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('pickle.loads');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect SQL injection string interpolation', () => {
      const code = 'const q = `SELECT * FROM accounts WHERE user = ${username}`;';
      const findings = engine.runDeterministicSecurityChecks(code, 'db.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Potential SQL Injection');
      expect(findings[0].severity).toBe('critical');
    });
  });

  describe('auditDocument', () => {
    it('should run audit, merge findings, and attach security disclaimer', async () => {
      const mockDoc: any = {
        fileName: 'C:/project/src/auth.ts',
        uri: vscode.Uri.file('C:/project/src/auth.ts'),
        languageId: 'typescript',
        getText: () => 'const password = "HardcodedSecret1234!";',
        lineCount: 1,
      };

      const result = await engine.auditDocument(mockDoc);
      expect(result).toBeDefined();
      expect(result?.findings.length).toBeGreaterThanOrEqual(2); // Hardcoded secret + AI finding
      expect(result?.summary).toContain(SecurityEngine.SECURITY_DISCLAIMER);
      expect(mockSidebarProvider.displayReviewResult).toHaveBeenCalled();
    });
  });
});
