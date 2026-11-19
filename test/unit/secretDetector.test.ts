import { describe, it, expect } from 'vitest';
import { SecretDetector } from '../../src/security/secretDetector';

describe('SecretDetector', () => {
  it('should detect exposed Google API keys', () => {
    // 39-character official Google API Key format
    const code = 'const gKey = "AIzaSyD1234567890abcdefghijklmnopqrstuv";';
    const findings = SecretDetector.scan(code, 'app.ts');

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('Google API Key');
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].category).toBe('security');
  });

  it('should detect exposed AWS Access Keys', () => {
    const code = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
    const findings = SecretDetector.scan(code, 'aws.js');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('AWS Access Key ID');
    expect(findings[0].severity).toBe('critical');
  });

  it('should detect exposed GitHub Personal Access Tokens', () => {
    const code = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
    const findings = SecretDetector.scan(code, 'git.ts');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('GitHub Personal Access Token');
  });

  it('should detect embedded private cryptographic keys', () => {
    const code = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y...
-----END RSA PRIVATE KEY-----
    `;
    const findings = SecretDetector.scan(code, 'cert.pem');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Private Cryptographic Key');
    expect(findings[0].severity).toBe('critical');
  });

  it('should detect hardcoded password assignments', () => {
    const code = 'const db_password = "SuperSecretPassword123!";';
    const findings = SecretDetector.scan(code, 'config.ts');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Hardcoded Secret / Password');
  });

  it('should ignore harmless placeholders in documentation', () => {
    const code = 'const key = "AIzaSy..."; // your-api-key here';
    const findings = SecretDetector.scan(code, 'README.md');

    expect(findings.length).toBe(0);
  });

  it('should detect live Stripe secret keys', () => {
    const mockStripe = ['sk', 'live', '51Abcdefghijklmnopqrstuvxyz123'].join('_');
    const code = `const stripeKey = "${mockStripe}";`;
    const findings = SecretDetector.scan(code, 'billing.ts');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Stripe Live Secret Key');
    expect(findings[0].severity).toBe('critical');
  });

  it('should detect OpenAI secret keys', () => {
    const mockOpenAi = ['sk', 'proj', 'abcde1234567890fghijklmnoprstuvwx123456'].join('-');
    const code = `const openAiToken = "${mockOpenAi}";`;
    const findings = SecretDetector.scan(code, 'ai.ts');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('OpenAI API Key');
    expect(findings[0].severity).toBe('critical');
  });

  it('should detect Database connection URIs with embedded passwords', () => {
    const code = 'const uri = "postgres://admin:SuperSecretPass123@prod-db.internal:5432/mydb";';
    const findings = SecretDetector.scan(code, 'db.ts');

    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Database Connection String with Password');
    expect(findings[0].severity).toBe('critical');
  });

  it('should detect Twilio, SendGrid, and Discord tokens', () => {
    const twilioMock = 'AC' + '1234567890abcdef1234567890abcdef';
    const sendGridMock = 'SG.' + '1234567890abcdefghijk1.1234567890abcdefghijklmnopqrstuvwxyz1234567';
    const discordMock = 'Nzg5NDU2' + 'MTIzNDU2Nzg5MDEy.Xyz12A.Abcdef1234567890abcdefghijklm';
    const code = `
      const twilioSid = "${twilioMock}";
      const sendGridKey = "${sendGridMock}";
      const discordToken = "${discordMock}";
    `;
    const findings = SecretDetector.scan(code, 'services.ts');

    expect(findings.length).toBe(3);
    const titles = findings.map((f) => f.title);
    expect(titles.some((t) => t.includes('Twilio'))).toBe(true);
    expect(titles.some((t) => t.includes('SendGrid'))).toBe(true);
    expect(titles.some((t) => t.includes('Discord'))).toBe(true);
  });
});
