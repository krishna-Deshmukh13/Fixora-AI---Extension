import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyManager } from '../../src/security/privacyManager';
import * as vscode from 'vscode';

describe('PrivacyManager', () => {
  let mockContext: any;
  let globalStateStore: Record<string, any>;

  beforeEach(() => {
    globalStateStore = {};
    mockContext = {
      globalState: {
        get: vi.fn((key: string, defaultVal: any) => globalStateStore[key] ?? defaultVal),
        update: vi.fn(async (key: string, val: any) => {
          globalStateStore[key] = val;
        }),
      },
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
      },
    };

    // Re-initialize singleton instance
    (PrivacyManager as any).instance = undefined;
  });

  it('should initialize and return singleton instance', () => {
    const manager = PrivacyManager.initialize(mockContext);
    expect(manager).toBeDefined();
    expect(PrivacyManager.getInstance()).toBe(manager);
  });

  it('should redact sensitive credentials from code before transmission', () => {
    const manager = PrivacyManager.initialize(mockContext);

    const dirtyCode = `
      const googleKey = "AIzaSyD-1234567890abcdefghijklmnopqrstu";
      const awsKey = "AKIAIOSFODNN7EXAMPLE";
      const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
      const jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const keyPem = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y123456789abcdef
-----END RSA PRIVATE KEY-----\`;
    `;

    const sanitized = manager.sanitizeCodeForTransmission(dirtyCode);

    expect(sanitized).not.toContain('AIzaSyD-1234567890abcdefghijklmnopqrstu');
    expect(sanitized).toContain('[REDACTED_GOOGLE_API_KEY]');

    expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(sanitized).toContain('[REDACTED_AWS_KEY]');

    expect(sanitized).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(sanitized).toContain('[REDACTED_GITHUB_PAT]');

    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).toContain('[REDACTED_JWT_TOKEN]');

    expect(sanitized).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(sanitized).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('should block unsafe files such as .env, .pem, and .key from transmission', () => {
    const manager = PrivacyManager.initialize(mockContext);

    expect(manager.isFileSafeForTransmission('/project/.env')).toBe(false);
    expect(manager.isFileSafeForTransmission('/project/.env.local')).toBe(false);
    expect(manager.isFileSafeForTransmission('/project/certs/server.key')).toBe(false);
    expect(manager.isFileSafeForTransmission('/project/certs/cert.pem')).toBe(false);
    expect(manager.isFileSafeForTransmission('/project/node_modules/pkg/index.js')).toBe(false);

    expect(manager.isFileSafeForTransmission('/project/src/index.ts')).toBe(true);
    expect(manager.isFileSafeForTransmission('/project/app/main.py')).toBe(true);
  });

  it('should return true immediately if privacy consent was previously acknowledged', async () => {
    globalStateStore['fixora.aiConsentAcknowledged'] = true;
    const manager = PrivacyManager.initialize(mockContext);

    const consent = await manager.ensurePrivacyConsent();
    expect(consent).toBe(true);
  });

  it('should prompt user and store consent when user clicks I Understand', async () => {
    const manager = PrivacyManager.initialize(mockContext);
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('I Understand' as any);

    const consent = await manager.ensurePrivacyConsent();
    expect(consent).toBe(true);
    expect(globalStateStore['fixora.aiConsentAcknowledged']).toBe(true);
  });
});
