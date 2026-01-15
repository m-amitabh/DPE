import { execa } from 'execa';
import path from 'path';
import fs from 'fs/promises';
import log from 'electron-log';

export interface GitInfo {
  isGit: boolean;
  branch: string | null;
  lastCommitHash: string | null;
  remotes: Array<{
    name: string;
    url: string;
    provider?: 'github' | 'gitlab' | 'bitbucket';
    owner?: string;
    repo?: string;
  }>;
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(dirPath, '.git');
    const stat = await fs.stat(gitDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get git information for a repository
 */
export async function getGitInfo(dirPath: string, timeout = 10000): Promise<GitInfo> {
  const emptyInfo: GitInfo = {
    isGit: false,
    branch: null,
    lastCommitHash: null,
    remotes: []
  };

  try {
    // Check if it's a git repo
    if (!(await isGitRepo(dirPath))) {
      return emptyInfo;
    }

    const [branch, commit, remotes] = await Promise.all([
      getBranch(dirPath, timeout),
      getLastCommit(dirPath, timeout),
      getRemotes(dirPath, timeout)
    ]);

    return {
      isGit: true,
      branch,
      lastCommitHash: commit,
      remotes
    };
  } catch (error: any) {
    log.warn(`Failed to get git info for ${dirPath}:`, error.message);
    return emptyInfo;
  }
}

/**
 * Get current branch
 */
async function getBranch(dirPath: string, timeout: number): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['-C', dirPath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeout,
      reject: false
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get last commit hash
 */
async function getLastCommit(dirPath: string, timeout: number): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['-C', dirPath, 'rev-parse', 'HEAD'], {
      timeout,
      reject: false
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get all remotes with parsed provider info
 */
async function getRemotes(dirPath: string, timeout: number): Promise<GitInfo['remotes']> {
  try {
    const { stdout } = await execa('git', ['-C', dirPath, 'remote', '-v'], {
      timeout,
      reject: false
    });

    if (!stdout) {
      return [];
    }

    const remoteMap = new Map<string, string>();
    const lines = stdout.split('\n');

    // Parse remote lines (format: "origin\tgit@github.com:user/repo.git (fetch)")
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
      if (match) {
        const [, name, url] = match;
        remoteMap.set(name, url);
      }
    }

    const remotes: GitInfo['remotes'] = [];
    for (const [name, url] of remoteMap.entries()) {
      const parsed = parseRemoteURL(url);
      remotes.push({
        name,
        url,
        ...parsed
      });
    }

    return remotes;
  } catch {
    return [];
  }
}

/**
 * Parse remote URL to extract provider, owner, and repo
 */
export function parseRemoteURL(url: string): {
  provider?: 'github' | 'gitlab' | 'bitbucket';
  owner?: string;
  repo?: string;
} {
  // Match SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@([^:]+):([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    return {
      provider: getProvider(host),
      owner,
      repo: repo.replace(/\.git$/, '')
    };
  }

  // Match HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/([^/]+)\/(.+?)(\.git)?$/);
  if (httpsMatch) {
    const [, host, owner, repo] = httpsMatch;
    return {
      provider: getProvider(host),
      owner,
      repo: repo.replace(/\.git$/, '')
    };
  }

  return {};
}

/**
 * Determine provider from hostname
 */
function getProvider(host: string): 'github' | 'gitlab' | 'bitbucket' | undefined {
  const lower = host.toLowerCase();
  if (lower.includes('github')) return 'github';
  if (lower.includes('gitlab')) return 'gitlab';
  if (lower.includes('bitbucket')) return 'bitbucket';
  return undefined;
}

/**
 * Check if git is available
 */
export async function isGitAvailable(): Promise<boolean> {
  try {
    await execa('git', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
