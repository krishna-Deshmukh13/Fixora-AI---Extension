import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';

export interface DependencyVulnerability {
  packageName: string;
  currentVersion: string;
  manifestFile: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  advisoryId: string;
  description: string;
  fixedVersion: string;
  recommendation: string;
}

export interface DependencyAuditResult {
  totalDependencies: number;
  vulnerabilities: DependencyVulnerability[];
  manifestsScanned: string[];
  disclaimer: string;
  timestamp: string;
}

interface KnownAdvisory {
  packagePattern: RegExp | string;
  affectedVersionCheck: (version: string) => boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  advisoryId: string;
  description: string;
  fixedVersion: string;
  recommendation: string;
}

/**
 * Scans workspace dependencies against known high-risk vulnerability advisories.
 */
export class DependencyAuditor {
  private static instance: DependencyAuditor;
  private logger = Logger.getInstance();

  private static readonly KNOWN_ADVISORIES: KnownAdvisory[] = [
    {
      packagePattern: /^event-stream$/i,
      affectedVersionCheck: (v) => v.includes('3.3.6'),
      severity: 'critical',
      advisoryId: 'CVE-2018-3721',
      description: 'Malicious backdoor injected via flatmap-stream dependency targeting Bitcoin wallets.',
      fixedVersion: '>= 4.0.0 or remove package',
      recommendation: 'Remove event-stream or upgrade to 4.0.0+ immediately.',
    },
    {
      packagePattern: /^lodash$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '4.17.21');
      },
      severity: 'high',
      advisoryId: 'CVE-2021-23337',
      description: 'Command injection and Prototype Pollution via template function.',
      fixedVersion: '4.17.21',
      recommendation: 'Upgrade lodash to 4.17.21 or later.',
    },
    {
      packagePattern: /^axios$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '0.21.1');
      },
      severity: 'medium',
      advisoryId: 'CVE-2020-28168',
      description: 'Server-Side Request Forgery (SSRF) bypass via insecure followRedirects.',
      fixedVersion: '0.21.1',
      recommendation: 'Upgrade axios to 0.21.1 or later.',
    },
    {
      packagePattern: /^express$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '4.19.2');
      },
      severity: 'high',
      advisoryId: 'CVE-2024-29041',
      description: 'Open redirect and IP address spoofing in req.ip handling.',
      fixedVersion: '4.19.2',
      recommendation: 'Upgrade express to 4.19.2 or later.',
    },
    {
      packagePattern: /^jsonwebtoken$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '9.0.0');
      },
      severity: 'critical',
      advisoryId: 'CVE-2022-23529',
      description: 'Insecure key verification leading to Remote Code Execution via poisoned key objects.',
      fixedVersion: '9.0.0',
      recommendation: 'Upgrade jsonwebtoken to version 9.0.0 or higher.',
    },
    {
      packagePattern: /^minimist$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '1.2.6');
      },
      severity: 'high',
      advisoryId: 'CVE-2021-44906',
      description: 'Prototype pollution via ill-formed command line arguments.',
      fixedVersion: '1.2.6',
      recommendation: 'Upgrade minimist to 1.2.6 or later.',
    },
    {
      packagePattern: /log4j-core/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '2.17.1');
      },
      severity: 'critical',
      advisoryId: 'CVE-2021-44228',
      description: 'Log4Shell JNDI Lookup Remote Code Execution vulnerability.',
      fixedVersion: '2.17.1',
      recommendation: 'Upgrade log4j-core to 2.17.1 or higher immediately.',
    },
    {
      packagePattern: /^requests$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '2.31.0');
      },
      severity: 'medium',
      advisoryId: 'CVE-2023-32681',
      description: 'Unintended leak of Proxy-Authorization headers on cross-origin redirects.',
      fixedVersion: '2.31.0',
      recommendation: 'Upgrade Python requests to 2.31.0 or higher.',
    },
    {
      packagePattern: /^urllib3$/i,
      affectedVersionCheck: (v) => {
        const clean = v.replace(/[^0-9.]/g, '');
        return this.isVersionLowerThan(clean, '2.0.7');
      },
      severity: 'medium',
      advisoryId: 'CVE-2023-45803',
      description: 'Cookie and authorization header leakage on redirect downgrade.',
      fixedVersion: '2.0.7',
      recommendation: 'Upgrade urllib3 to 2.0.7 or later.',
    },
  ];

  public static getInstance(): DependencyAuditor {
    if (!DependencyAuditor.instance) {
      DependencyAuditor.instance = new DependencyAuditor();
    }
    return DependencyAuditor.instance;
  }

  /**
   * Simple semver comparison helper: returns true if v1 < v2.
   */
  private static isVersionLowerThan(v1: string, v2: string): boolean {
    if (!v1) return false;
    const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 < p2) return true;
      if (p1 > p2) return false;
    }
    return false;
  }

  /**
   * Scans all known package manifests in workspace folders.
   */
  public async auditWorkspace(): Promise<DependencyAuditResult> {
    const folders = vscode.workspace.workspaceFolders || [];
    const vulnerabilities: DependencyVulnerability[] = [];
    const manifestsScanned: string[] = [];
    let totalDependencies = 0;

    for (const folder of folders) {
      const root = folder.uri.fsPath;

      // 1. package.json
      const pkgPath = path.join(root, 'package.json');
      if (fs.existsSync(pkgPath)) {
        manifestsScanned.push(pkgPath);
        const { deps, vulns } = this.auditPackageJson(pkgPath);
        totalDependencies += deps;
        vulnerabilities.push(...vulns);
      }

      // 2. requirements.txt
      const reqPath = path.join(root, 'requirements.txt');
      if (fs.existsSync(reqPath)) {
        manifestsScanned.push(reqPath);
        const { deps, vulns } = this.auditRequirementsTxt(reqPath);
        totalDependencies += deps;
        vulnerabilities.push(...vulns);
      }
    }

    return {
      totalDependencies,
      vulnerabilities,
      manifestsScanned,
      disclaimer: `Automated heuristic vulnerability audit by ${BRANDING.PRODUCT_NAME}. Does not replace comprehensive manual security audits or official CVE feeds.`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Audits a package.json file.
   */
  public auditPackageJson(filePath: string): { deps: number; vulns: DependencyVulnerability[] } {
    const vulns: DependencyVulnerability[] = [];
    let depsCount = 0;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const pkg = JSON.parse(content);
      const allDeps: Record<string, string> = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      depsCount = Object.keys(allDeps).length;

      for (const [name, rawVersion] of Object.entries(allDeps)) {
        for (const advisory of DependencyAuditor.KNOWN_ADVISORIES) {
          const matches =
            typeof advisory.packagePattern === 'string'
              ? name.toLowerCase() === advisory.packagePattern.toLowerCase()
              : advisory.packagePattern.test(name);

          if (matches && advisory.affectedVersionCheck(rawVersion)) {
            vulns.push({
              packageName: name,
              currentVersion: rawVersion,
              manifestFile: filePath,
              severity: advisory.severity,
              advisoryId: advisory.advisoryId,
              description: advisory.description,
              fixedVersion: advisory.fixedVersion,
              recommendation: advisory.recommendation,
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to parse ${filePath}: ${err?.message}`);
    }

    return { deps: depsCount, vulns };
  }

  /**
   * Audits a requirements.txt file.
   */
  public auditRequirementsTxt(filePath: string): { deps: number; vulns: DependencyVulnerability[] } {
    const vulns: DependencyVulnerability[] = [];
    let depsCount = 0;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      depsCount = lines.length;

      for (const line of lines) {
        // e.g. requests==2.20.0 or flask>=1.0.0
        const match = line.match(/^([a-zA-Z0-9_\-]+)(?:[=><~^]+)(.+)$/);
        if (match) {
          const name = match[1];
          const rawVersion = match[2];

          for (const advisory of DependencyAuditor.KNOWN_ADVISORIES) {
            const matches =
              typeof advisory.packagePattern === 'string'
                ? name.toLowerCase() === advisory.packagePattern.toLowerCase()
                : advisory.packagePattern.test(name);

            if (matches && advisory.affectedVersionCheck(rawVersion)) {
              vulns.push({
                packageName: name,
                currentVersion: rawVersion,
                manifestFile: filePath,
                severity: advisory.severity,
                advisoryId: advisory.advisoryId,
                description: advisory.description,
                fixedVersion: advisory.fixedVersion,
                recommendation: advisory.recommendation,
              });
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to parse ${filePath}: ${err?.message}`);
    }

    return { deps: depsCount, vulns };
  }
}
