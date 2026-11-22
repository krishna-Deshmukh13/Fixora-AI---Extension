import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceHealthService } from '../../src/core/workspaceHealth';

describe('WorkspaceHealthService', () => {
  let service: WorkspaceHealthService;

  beforeEach(() => {
    service = WorkspaceHealthService.getInstance();
  });

  it('should initialize and compute a health report', async () => {
    const report = await service.computeHealthReport();

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(['Excellent', 'Good', 'Needs Attention', 'Critical Issues']).toContain(report.rating);
    expect(report.diagnostics).toBeDefined();
    expect(typeof report.diagnostics.errors).toBe('number');
    expect(typeof report.complexity.averageCC).toBe('number');
    expect(Array.isArray(report.complexity.hotspots)).toBe(true);
    expect(typeof report.security.totalVulnerabilities).toBe('number');
  });
});
