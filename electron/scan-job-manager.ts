import { randomUUID } from 'crypto';
import log from 'electron-log';
import { Scanner, type ScanConfig, type ScanProgress, type ScanResult } from './scanner';
import { getStore } from './json-store';
import { getSearchIndex } from './search-index';

export interface ScanJob {
  id: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  progress: ScanProgress;
  result?: ScanResult;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Manages scan jobs - only one scan can run at a time
 */
export class ScanJobManager {
  private currentJob: ScanJob | null = null;
  private scanner: Scanner | null = null;
  private progressCallbacks: Set<(jobId: string, progress: ScanProgress) => void> = new Set();

  /**
   * Start a new scan
   */
  async startScan(config: ScanConfig): Promise<string> {
    // Cancel any existing scan
    if (this.currentJob && this.currentJob.status === 'running') {
      this.cancelScan(this.currentJob.id);
    }

    const jobId = randomUUID();
    log.info(`Starting scan job ${jobId}`);

    // Get existing projects from store to preserve IDs and user metadata
    const store = getStore();
    const existingProjects = await store.getAllProjects();
    log.info(`Cache state before scan: ${existingProjects.length} projects`);

    this.currentJob = {
      id: jobId,
      status: 'running',
      progress: {
        discovered: 0,
        processed: 0,
        currentPath: ''
      },
      startedAt: Date.now()
    };

    // Create scanner with existing projects
    this.scanner = new Scanner(config, existingProjects);
    this.scanner.setProgressCallback((progress) => {
      if (this.currentJob && this.currentJob.id === jobId) {
        this.currentJob.progress = progress;
        this.notifyProgress(jobId, progress);
      }
    });

    // Run scan in background
    this.runScan(jobId, this.scanner).catch((error) => {
      log.error(`Scan job ${jobId} failed:`, error);
    });

    return jobId;
  }

  /**
   * Run the scan and handle results
   */
  private async runScan(jobId: string, scanner: Scanner): Promise<void> {
    try {
      const result = await scanner.scan();
      
      if (!this.currentJob || this.currentJob.id !== jobId) {
        return; // Job was cancelled
      }

      // Store discovered projects
      const store = getStore();
      log.info(`Scan completed: ${result.projects.length} projects found`);
      
      for (const project of result.projects) {
        await store.upsertProject(project);
      }

      // Flush to disk
      await store.flush();

      // Rebuild search index
      const allProjects = await store.getAllProjects();
      log.info(`Cache state after scan: ${allProjects.length} projects`);
      
      const searchIndex = getSearchIndex();
      searchIndex.buildIndex(allProjects);

      this.currentJob.status = 'complete';
      this.currentJob.result = result;
      this.currentJob.completedAt = Date.now();

      log.info(`Scan job ${jobId} completed: ${result.projects.length} projects found`);
    } catch (error: any) {
      if (!this.currentJob || this.currentJob.id !== jobId) {
        return;
      }

      this.currentJob.status = 'error';
      this.currentJob.error = error.message;
      this.currentJob.completedAt = Date.now();

      log.error(`Scan job ${jobId} error:`, error);
    }
  }

  /**
   * Cancel a scan
   */
  cancelScan(jobId: string): boolean {
    if (!this.currentJob || this.currentJob.id !== jobId) {
      return false;
    }

    if (this.currentJob.status !== 'running') {
      return false;
    }

    if (this.scanner) {
      this.scanner.cancel();
    }

    this.currentJob.status = 'cancelled';
    this.currentJob.completedAt = Date.now();

    log.info(`Scan job ${jobId} cancelled`);
    return true;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ScanJob | null {
    if (this.currentJob && this.currentJob.id === jobId) {
      return { ...this.currentJob };
    }
    return null;
  }

  /**
   * Register progress callback
   */
  onProgress(callback: (jobId: string, progress: ScanProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Notify all progress callbacks
   */
  private notifyProgress(jobId: string, progress: ScanProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(jobId, progress);
      } catch (error) {
        log.error('Progress callback error:', error);
      }
    }
  }
}

// Singleton instance
let managerInstance: ScanJobManager | null = null;

export function getScanJobManager(): ScanJobManager {
  if (!managerInstance) {
    managerInstance = new ScanJobManager();
  }
  return managerInstance;
}
