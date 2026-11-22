import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubPrReviewer } from '../../src/git/githubPrReviewer';

describe('GitHubPrReviewer', () => {
  let mockAiManager: any;
  let reviewer: GitHubPrReviewer;

  beforeEach(() => {
    (GitHubPrReviewer as any).instance = undefined;
    mockAiManager = {
      reviewCode: vi.fn().mockResolvedValue({
        summary: 'PR looks good with minor suggestions',
        findings: [],
        totalIssues: 0,
      }),
    };
    reviewer = GitHubPrReviewer.initialize(mockAiManager);
  });

  it('should parse HTTPS git remote URLs', () => {
    const parsed = reviewer.parseGitHubUrl('https://github.com/krishna-Deshmukh13/Fixora-AI---Extension.git');
    expect(parsed).toEqual({
      owner: 'krishna-Deshmukh13',
      repo: 'Fixora-AI---Extension',
    });
  });

  it('should parse SSH git remote URLs', () => {
    const parsed = reviewer.parseGitHubUrl('git@github.com:facebook/react.git');
    expect(parsed).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('should return null for non-GitHub or invalid URLs', () => {
    expect(reviewer.parseGitHubUrl('')).toBeNull();
    expect(reviewer.parseGitHubUrl('https://gitlab.com/user/repo.git')).toBeNull();
  });

  it('should retrieve auth token via vscode authentication session', async () => {
    const token = await reviewer.getAuthToken();
    expect(token).toBe('ghp_mock_token_123');
  });
});
