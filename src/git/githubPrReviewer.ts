import * as vscode from 'vscode';
import { ProcessManager } from '../utils/processManager';
import { AIManager } from '../ai/aiManager';
import { ReviewResult } from '../types';
import { Logger } from '../utils/logger';
import { BRANDING } from '../constants/branding';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  author: string;
  url: string;
  headBranch: string;
  baseBranch: string;
  updatedAt: string;
}

/**
 * Reviews GitHub Pull Requests with AI analysis and diff inspection.
 */
export class GitHubPrReviewer {
  private static instance: GitHubPrReviewer;
  private logger = Logger.getInstance();

  private constructor(private readonly aiManager: AIManager) {}

  public static initialize(aiManager: AIManager): GitHubPrReviewer {
    if (!GitHubPrReviewer.instance) {
      GitHubPrReviewer.instance = new GitHubPrReviewer(aiManager);
    }
    return GitHubPrReviewer.instance;
  }

  public static getInstance(): GitHubPrReviewer {
    if (!GitHubPrReviewer.instance) {
      throw new Error('GitHubPrReviewer must be initialized before use.');
    }
    return GitHubPrReviewer.instance;
  }

  /**
   * Detects owner and repo name from git remote origin.
   */
  public async detectRepository(): Promise<GitHubRepoInfo | null> {
    try {
      const result = await ProcessManager.execute('git', ['remote', 'get-url', 'origin']);
      if (result.exitCode !== 0 || !result.stdout) {
        return null;
      }

      const remoteUrl = result.stdout.trim();
      return this.parseGitHubUrl(remoteUrl);
    } catch (err: any) {
      this.logger.warn(`Failed to detect git repository: ${err?.message}`);
      return null;
    }
  }

  /**
   * Parses git remote URL into owner and repository name.
   */
  public parseGitHubUrl(url: string): GitHubRepoInfo | null {
    if (!url) {
      return null;
    }

    // SSH: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/i);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return null;
  }

  /**
   * Retrieves active VS Code GitHub session token or prompts user.
   */
  public async getAuthToken(createIfNone: boolean = false): Promise<string | null> {
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], {
        createIfNone,
      });
      return session?.accessToken || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches open pull requests for target repository.
   */
  public async fetchPullRequests(
    owner: string,
    repo: string,
    token?: string
  ): Promise<PullRequestSummary[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=20`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': `${BRANDING.PRODUCT_NAME}-VSCode-Extension`,
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
    }

    const prs: any = await response.json();
    return prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || 'unknown',
      url: pr.html_url,
      headBranch: pr.head?.ref || '',
      baseBranch: pr.base?.ref || '',
      updatedAt: pr.updated_at,
    }));
  }

  /**
   * Fetches the unified diff of a pull request.
   */
  public async fetchPullRequestDiff(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
  ): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.diff',
      'User-Agent': `${BRANDING.PRODUCT_NAME}-VSCode-Extension`,
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch PR diff (${response.status}): ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Reviews a pull request by analyzing its diff with Revion AI.
   */
  public async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string,
    cancellationToken?: vscode.CancellationToken
  ): Promise<ReviewResult> {
    const diff = await this.fetchPullRequestDiff(owner, repo, prNumber, token);
    if (!diff.trim()) {
      throw new Error(`Pull Request #${prNumber} has an empty diff.`);
    }

    return await this.aiManager.reviewCode(
      {
        code: diff,
        filePath: `PR-${prNumber}.diff`,
        languageId: 'diff',
      },
      cancellationToken
    );
  }

  /**
   * Safely posts a comment to the PR after user confirmation.
   */
  public async postReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    commentBody: string,
    token: string
  ): Promise<boolean> {
    const confirmation = await vscode.window.showInformationMessage(
      `Post ${BRANDING.PRODUCT_NAME} review comment to PR #${prNumber} on ${owner}/${repo}?`,
      { modal: true },
      'Post Comment'
    );

    if (confirmation !== 'Post Comment') {
      return false;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`,
        'User-Agent': `${BRANDING.PRODUCT_NAME}-VSCode-Extension`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: commentBody }),
    });

    if (!response.ok) {
      throw new Error(`Failed to post comment to PR (${response.status}): ${response.statusText}`);
    }

    vscode.window.showInformationMessage(
      `${BRANDING.PRODUCT_NAME}: Review comment successfully posted to PR #${prNumber}.`
    );
    return true;
  }
}
