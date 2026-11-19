import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BugDetector } from '../../src/core/bugDetector';
import { ReviewFinding } from '../../src/types';

describe('BugDetector', () => {
  let mockAiManager: any;
  let detector: BugDetector;

  beforeEach(() => {
    mockAiManager = {
      isConfigured: vi.fn().mockResolvedValue(true),
      reviewCode: vi.fn().mockResolvedValue({
        summary: 'AI detected 1 bug',
        findings: [
          {
            id: 'ai-bug-1',
            title: 'Null pointer dereference',
            severity: 'critical',
            category: 'bug',
            filePath: 'src/main.ts',
            line: 42,
            explanation: 'Object is null',
            whyItMatters: 'Runtime crash',
            suggestedSolution: 'Add null guard',
            confidence: 0.95,
            source: 'ai',
          },
        ],
      }),
    };

    (BugDetector as any).instance = undefined;
    detector = BugDetector.initialize(mockAiManager);
  });

  describe('runDeterministicBugChecks', () => {
    it('should detect empty catch blocks (silently swallowed exceptions)', () => {
      const code = `
try {
  doRiskyOperation();
} catch (error) {}
      `;
      const findings = detector.runDeterministicBugChecks(code, 'app.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toBe('Silently Swallowed Exception');
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].line).toBe(4);
    });

    it('should detect loose equality type coercion in JavaScript/TypeScript', () => {
      const code = `
const status = "0";
if (status == false) {
  console.log("Coerced!");
}
      `;
      const findings = detector.runDeterministicBugChecks(code, 'app.js', 'javascript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Loose Equality Coercion');
      expect(findings[0].severity).toBe('info');
      expect(findings[0].suggestedFix).toContain('status === false');
    });

    it('should detect unawaited network calls', () => {
      const code = `
function loadData() {
  fetch("https://api.example.com/data");
  console.log("Fired request");
}
      `;
      const findings = detector.runDeterministicBugChecks(code, 'api.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toBe('Unawaited Async Promise');
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].line).toBe(3);
    });

    it('should detect Python mutable default arguments', () => {
      const pythonCode = `
def add_user(user_id, active_users=[]):
    active_users.append(user_id)
    return active_users
      `;
      const findings = detector.runDeterministicBugChecks(pythonCode, 'users.py', 'python');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toBe('Mutable Default Argument');
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].line).toBe(2);
    });

    it('should detect infinite loop risks with constant true conditions and no break', () => {
      const infiniteLoopCode = `
function runLoop() {
  while (true) {
    doWork();
  }
}
      `;
      const findings = detector.runDeterministicBugChecks(infiniteLoopCode, 'worker.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toBe('Potential Infinite Loop');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect accidental assignment in if condition', () => {
      const code = 'if (user = null) { return false; }';
      const findings = detector.runDeterministicBugChecks(code, 'app.ts', 'typescript');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Accidental Assignment in Condition');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect catastrophic SQL DELETE or UPDATE without WHERE clause', () => {
      const sql = 'DELETE FROM users;';
      const findings = detector.runDeterministicBugChecks(sql, 'cleanup.sql', 'sql');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Catastrophic SQL Query');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect Python bare except statement', () => {
      const pyCode = `
try:
    risky()
except:
    pass
      `;
      const findings = detector.runDeterministicBugChecks(pyCode, 'handler.py', 'python');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Bare "except:" Statement');
      expect(findings[0].severity).toBe('warning');
    });

    it('should detect HTML img tag without alt attribute', () => {
      const html = '<img src="logo.png" width="100">';
      const findings = detector.runDeterministicBugChecks(html, 'index.html', 'html');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Missing Image "alt" Attribute');
      expect(findings[0].severity).toBe('warning');
    });

    it('should detect Java String comparison with ==', () => {
      const java = 'if (status == "ACTIVE") { proceed(); }';
      const findings = detector.runDeterministicBugChecks(java, 'User.java', 'java');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('String Reference Comparison with "=="');
      expect(findings[0].severity).toBe('critical');
    });

    it('should detect C/C++ unsafe buffer overflow functions', () => {
      const cCode = 'void read() { gets(buffer); }';
      const findings = detector.runDeterministicBugChecks(cCode, 'main.c', 'c');

      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Unsafe Function Call');
      expect(findings[0].severity).toBe('critical');
    });
  });

  describe('mergeAndDeduplicate', () => {
    it('should merge findings on the same line into a combined finding with maximum confidence', () => {
      const staticFindings: ReviewFinding[] = [
        {
          id: 'static-1',
          title: 'Empty catch block',
          severity: 'warning',
          category: 'bug',
          filePath: 'test.ts',
          line: 10,
          explanation: 'Silent error',
          whyItMatters: '',
          suggestedSolution: '',
          confidence: 0.9,
          source: 'static',
        },
      ];

      const aiFindings: ReviewFinding[] = [
        {
          id: 'ai-1',
          title: 'Missing exception logging',
          severity: 'warning',
          category: 'bug',
          filePath: 'test.ts',
          line: 10,
          explanation: 'Exception discarded',
          whyItMatters: '',
          suggestedSolution: 'Log error',
          suggestedFix: 'catch (err) { logger.error(err); }',
          confidence: 0.95,
          source: 'ai',
        },
      ];

      const merged = detector.mergeAndDeduplicate(staticFindings, aiFindings);

      expect(merged.length).toBe(1);
      expect(merged[0].source).toBe('combined');
      expect(merged[0].confidence).toBe(1.0);
      expect(merged[0].suggestedFix).toBe('catch (err) { logger.error(err); }');
    });

    it('should sort critical issues first, followed by warnings, then line numbers', () => {
      const mixed: ReviewFinding[] = [
        {
          id: '1',
          title: 'Info issue',
          severity: 'info',
          category: 'bug',
          filePath: 'test.ts',
          line: 5,
          explanation: '',
          whyItMatters: '',
          suggestedSolution: '',
          confidence: 0.8,
          source: 'static',
        },
        {
          id: '2',
          title: 'Critical issue',
          severity: 'critical',
          category: 'bug',
          filePath: 'test.ts',
          line: 20,
          explanation: '',
          whyItMatters: '',
          suggestedSolution: '',
          confidence: 0.99,
          source: 'static',
        },
        {
          id: '3',
          title: 'Warning issue',
          severity: 'warning',
          category: 'bug',
          filePath: 'test.ts',
          line: 2,
          explanation: '',
          whyItMatters: '',
          suggestedSolution: '',
          confidence: 0.9,
          source: 'static',
        },
      ];

      const sorted = detector.mergeAndDeduplicate(mixed, []);
      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('warning');
      expect(sorted[2].severity).toBe('info');
    });
  });
});
