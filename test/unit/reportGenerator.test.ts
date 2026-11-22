import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { ReportGenerator } from '../../src/reports/reportGenerator';
import { ReviewResult } from '../../src/types';

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
}));

describe('ReportGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
    vi.spyOn(vscode.env, 'openExternal').mockResolvedValue(true as any);
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);
    vi.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined as any);
  });

  it('should generate standalone HTML audit report with metrics and escaped findings', async () => {
    const mockResult: ReviewResult = {
      summary: 'Found 1 critical bug & <injection> attempt',
      findings: [
        {
          id: 'test-1',
          title: 'Dangerous SQL <script>alert(1)</script>',
          severity: 'critical',
          category: 'security',
          filePath: 'db.ts',
          line: 45,
          explanation: 'Potential SQL injection via "rawInput" & parameter mismatch',
          whyItMatters: 'Arbitrary DB read',
          suggestedSolution: 'Use parameterized queries',
          suggestedFix: 'db.query("SELECT * FROM users WHERE id = ?", [id])',
          confidence: 0.99,
          source: 'static',
        },
      ],
      durationMs: 120,
      filesAnalyzed: ['db.ts'],
      providerName: 'Fixora AI Offline Suite',
      modelName: 'Security Analyzer',
      timestamp: '2026-11-20T00:00:00Z',
      totalIssues: 1,
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
    };

    const outputPath = await ReportGenerator.exportHtmlReport(mockResult);
    expect(outputPath).toBeTruthy();
    expect(fs.writeFileSync).toHaveBeenCalled();

    const [writtenFile, writtenContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(writtenFile.toString()).toContain('fixora-report-');
    expect(writtenFile.toString()).toContain('.html');

    const html = writtenContent as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Revion Code Quality Audit Report');
    expect(html).toContain('Dangerous SQL &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;rawInput&quot; &amp; parameter mismatch');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('FixoraFoundation');

    expect(vscode.env.openExternal).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Audit report saved')
    );
  });
});
