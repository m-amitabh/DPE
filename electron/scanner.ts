import fs from 'fs/promises';
import path from 'path';
import { glob } from 'fast-glob';
import { randomUUID } from 'crypto';
import log from 'electron-log';
import { getGitInfo, isGitRepo } from './git-utils';
import type { Project } from '../src/lib/types';

export interface ScanPathConfigItem {
  path: string;
  includeAsProject?: boolean;
}

export interface ScanConfig {
  paths: Array<string | ScanPathConfigItem>;
  ignoredPatterns: string[];
  maxDepth: number;
  minSizeBytes: number;
}

export interface ScanProgress {
  discovered: number;
  processed: number;
  currentPath: string;
}

export interface ScanResult {
  projects: Project[];
  errors: Array<{ path: string; error: string }>;
  stats: {
    totalScanned: number;
    gitRepos: number;
    localProjects: number;
    duration: number;
  };
}

/**
 * Scanner class - discovers projects in specified directories
 */
export class Scanner {
  private cancelled = false;
  private onProgress?: (progress: ScanProgress) => void;
  private existingProjects: Map<string, Project> = new Map();

  constructor(private config: ScanConfig, existingProjects: Project[] = []) {
    // Build a map of existing projects by path for quick lookup
    for (const project of existingProjects) {
      this.existingProjects.set(project.path, project);
    }
    log.info(`Scanner initialized with ${existingProjects.length} existing projects`);
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: ScanProgress) => void): void {
    this.onProgress = callback;
  }

  /**
   * Cancel the scan
   */
  cancel(): void {
    this.cancelled = true;
    log.info('Scan cancelled');
  }

  /**
   * Run the scan
   */
  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    const projects: Project[] = [];
    const errors: Array<{ path: string; error: string }> = [];
    let discovered = 0;
    let processed = 0;

    log.info('Starting scan with paths:', this.config.paths);

    try {
      // Find all potential project directories
      const candidates = await this.findCandidates();
      discovered = candidates.length;

      log.info(`Found ${discovered} potential projects`);

      // Process each candidate
      for (const candidatePath of candidates) {
        if (this.cancelled) {
          log.info('Scan cancelled by user');
          break;
        }

        try {
          const project = await this.processCandidate(candidatePath);
          if (project) {
            projects.push(project);
          }
          processed++;

          // Report progress every 10 projects or on last item
          if (processed % 10 === 0 || processed === discovered) {
            this.reportProgress(discovered, processed, candidatePath);
          }
        } catch (error: any) {
          log.warn(`Failed to process ${candidatePath}:`, error.message);
          errors.push({
            path: candidatePath,
            error: error.message
          });
          processed++;
        }
      }

      const duration = Date.now() - startTime;
      const gitRepos = projects.filter(p => p.type === 'git').length;

      return {
        projects,
        errors,
        stats: {
          totalScanned: processed,
          gitRepos,
          localProjects: projects.length - gitRepos,
          duration
        }
      };
    } catch (error: any) {
      log.error('Scan failed:', error);
      throw error;
    }
  }

  /**
   * Find all candidate project directories
   */
  private async findCandidates(): Promise<string[]> {
    const candidates = new Set<string>();

    for (const scanPathEntry of this.config.paths) {
      const scanPath = typeof scanPathEntry === 'string' ? scanPathEntry : scanPathEntry.path;
      const includeAsProject = typeof scanPathEntry === 'string' ? false : !!scanPathEntry.includeAsProject;
      try {
        // Check if path exists
        await fs.access(scanPath);

        // Prefer discovering Git repositories only: find any .git directories recursively.
        // This keeps scans focused on actual git projects. Other project indicators (package.json, etc.)
        // are ignored during the automatic scan. Users can still add arbitrary folders manually.
        // If ignoredPatterns include .git entries, remove them for the purpose of finding .git directories
        const ignoreForGit = (this.config.ignoredPatterns || []).filter(p => !p.includes('.git'));
        const foundGitDirs = await glob('**/.git', {
          cwd: scanPath,
          onlyFiles: false,
          deep: this.config.maxDepth,
          ignore: ignoreForGit,
          absolute: true,
          followSymbolicLinks: false
        });

        for (const gitPath of foundGitDirs) {
          const projectDir = path.dirname(gitPath);
          candidates.add(projectDir);
        }

        const childProjectsFound = foundGitDirs.length > 0;

        // If the provided scanPath itself is a git repository, include it too
        // If the provided scanPath itself is a git repository, consider adding it
        // but only if there are no child projects inside this path, unless the
        // user explicitly requested `includeAsProject`.
        try {
          const gitStat = await fs.stat(path.join(scanPath, '.git'));
          if (gitStat && gitStat.isDirectory()) {
            if (includeAsProject || !childProjectsFound) {
              candidates.add(scanPath);
            }
          }
        } catch {}

        if (includeAsProject) {
          // User explicitly requested this path be treated as a project
          candidates.add(scanPath);
        }
        // NOTE: Previously we auto-included top-level non-git directories if
        // they contained README/language indicators. That caused folders like
        // a plain "demo" directory to be added even when the user did not
        // check "Include as project". To match user expectation, only
        // include the provided path when `includeAsProject` is true. Git
        // repositories are handled above and will still be included.
      } catch (error: any) {
        log.warn(`Failed to scan path ${scanPath}:`, error.message);
      }
    }

    return Array.from(candidates);
  }

  /**
   * Process a candidate directory into a Project
   */
  private async processCandidate(projectPath: string): Promise<Project | null> {
    try {
      // Get directory stats
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        return null;
      }

      // Check minimum size
      const size = await this.getDirectorySize(projectPath);
      if (size < this.config.minSizeBytes) {
        return null;
      }

      // Check if it's a git repo
      const isGit = await isGitRepo(projectPath);
      const gitInfo = isGit ? await getGitInfo(projectPath) : null;

      // Count files
      const fileCount = await this.countFiles(projectPath);

      // Find README files
      const readmeFiles = await this.findReadmeFiles(projectPath);

      // Detect primary language
      const language = await this.detectLanguage(projectPath);

      // Determine provider from git remotes
      const provider = gitInfo?.remotes[0]?.provider || null;

      // Check if we have an existing project at this path
      const existingProject = this.existingProjects.get(projectPath);
      
      const project: Project = {
        id: existingProject?.id || randomUUID(), // Reuse existing ID if available
        name: path.basename(projectPath),
        path: projectPath,
        type: isGit ? 'git' : 'local',
        tags: existingProject?.tags || [], // Preserve user-defined tags
        // Preserve user-defined importance; default to 0 (None) when not set
        importance: existingProject?.importance ?? 0,
        sizeBytes: size,
        createdAt: existingProject?.createdAt || stats.birthtime.toISOString(), // Preserve original creation time
        lastModifiedAt: stats.mtime.toISOString(),
        fileCount,
        provider,
        lastCommitHash: gitInfo?.lastCommitHash || null,
        branch: gitInfo?.branch || null,
        remotes: gitInfo?.remotes || [],
        readmeFiles,
        language,
        scanStatus: 'complete',
        lastScannedAt: new Date().toISOString(),
      };

      return project;
    } catch (error) {
      log.warn(`Failed to process candidate ${projectPath}:`, error);
      return null;
    }
  }

  /**
   * Get approximate directory size (up to 100MB worth of files)
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const files = await glob('**/*', {
        cwd: dirPath,
        onlyFiles: true,
        deep: 3, // Don't go too deep for size calculation
        ignore: this.config.ignoredPatterns,
        stats: true
      });

      let totalSize = 0;
      for (const file of files) {
        totalSize += (file.stats?.size || 0);
        if (totalSize > 100_000_000) break; // Cap at 100MB
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Count files in directory
   */
  private async countFiles(dirPath: string): Promise<number> {
    try {
      const files = await glob('**/*', {
        cwd: dirPath,
        onlyFiles: true,
        deep: 5,
        ignore: this.config.ignoredPatterns
      });
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Find README files
   */
  private async findReadmeFiles(dirPath: string): Promise<string[]> {
    try {
      const readmes = await glob('**/README*.{md,txt,rst}', {
        cwd: dirPath,
        onlyFiles: true,
        deep: 2,
        caseSensitiveMatch: false
      });
      return readmes;
    } catch {
      return [];
    }
  }

  /**
   * Detect primary programming language
   */
  private async detectLanguage(dirPath: string): Promise<string | undefined> {
    try {
      // Look for language-specific files
      const indicators: Record<string, string[]> = {
        typescript: ['tsconfig.json', 'package.json'],
        javascript: ['package.json', 'yarn.lock'],
        python: ['requirements.txt', 'setup.py', 'pyproject.toml'],
        rust: ['Cargo.toml'],
        go: ['go.mod', 'go.sum'],
        java: ['pom.xml', 'build.gradle'],
        ruby: ['Gemfile'],
        php: ['composer.json'],
        csharp: ['*.csproj', '*.sln'],
        swift: ['Package.swift'],
      };

      for (const [lang, patterns] of Object.entries(indicators)) {
        for (const pattern of patterns) {
          const found = await glob(pattern, {
            cwd: dirPath,
            deep: 1,
            caseSensitiveMatch: false
          });
          if (found.length > 0) {
            return lang;
          }
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Report progress
   */
  private reportProgress(discovered: number, processed: number, currentPath: string): void {
    if (this.onProgress) {
      this.onProgress({
        discovered,
        processed,
        currentPath
      });
    }
  }
}
