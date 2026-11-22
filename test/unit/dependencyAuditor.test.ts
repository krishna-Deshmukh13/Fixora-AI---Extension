import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DependencyAuditor } from '../../src/security/dependencyAuditor';

describe('DependencyAuditor', () => {
  let auditor: DependencyAuditor;
  let tmpDir: string;

  beforeEach(() => {
    auditor = DependencyAuditor.getInstance();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-audit-test-'));
  });

  it('should detect known vulnerable npm packages in package.json', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    const mockPkg = {
      name: 'vulnerable-app',
      dependencies: {
        'lodash': '4.17.15', // Vulnerable to CVE-2021-23337 (< 4.17.21)
        'axios': '0.19.0',   // Vulnerable to CVE-2020-28168 (< 0.21.1)
        'express': '4.18.0', // Vulnerable to CVE-2024-29041 (< 4.19.2)
        'clean-package': '1.0.0', // Safe
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(mockPkg, null, 2), 'utf8');

    const result = auditor.auditPackageJson(pkgPath);
    expect(result.deps).toBe(4);
    expect(result.vulns.length).toBe(3);

    const lodashVuln = result.vulns.find((v) => v.packageName === 'lodash');
    expect(lodashVuln).toBeDefined();
    expect(lodashVuln?.advisoryId).toBe('CVE-2021-23337');
    expect(lodashVuln?.severity).toBe('high');
  });

  it('should detect known vulnerable Python packages in requirements.txt', () => {
    const reqPath = path.join(tmpDir, 'requirements.txt');
    const content = `
requests==2.20.0
urllib3==1.26.5
flask>=2.0.0
`;
    fs.writeFileSync(reqPath, content, 'utf8');

    const result = auditor.auditRequirementsTxt(reqPath);
    expect(result.deps).toBe(3);
    expect(result.vulns.length).toBe(2);

    const requestsVuln = result.vulns.find((v) => v.packageName === 'requests');
    expect(requestsVuln).toBeDefined();
    expect(requestsVuln?.advisoryId).toBe('CVE-2023-32681');
  });

  it('should return empty vulnerabilities when all dependencies are safe', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    const mockPkg = {
      name: 'secure-app',
      dependencies: {
        'lodash': '4.17.21',
        'axios': '1.7.0',
        'express': '4.20.0',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(mockPkg, null, 2), 'utf8');

    const result = auditor.auditPackageJson(pkgPath);
    expect(result.vulns.length).toBe(0);
  });
});
