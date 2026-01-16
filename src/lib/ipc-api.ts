import type { IPCResponse, Project, FileTreeNode } from './types';

// Extend Window interface with electronAPI
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
      ping: () => Promise<string>;
    };
  }
}

// IPC Channels
const CHANNELS = {
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_TOUCH_ALL: 'project:touchAll',
  PROJECT_REFRESH_FROM_FS: 'project:refreshModifiedFromFS',
  SCAN_START: 'scan:start',
  SCAN_STATUS: 'scan:status',
  SCAN_CANCEL: 'scan:cancel',
  FILE_TREE: 'file:tree',
  MARKDOWN_LIST: 'markdown:list',
  MARKDOWN_FETCH: 'markdown:fetch',
  GIT_LIST_BRANCHES: 'git:list-branches',
  GIT_LIST_COMMITS: 'git:list-commits',
  GIT_CHECKOUT: 'git:checkout',
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',
  README_LIST: 'readme:list',
  README_FETCH: 'readme:fetch',
} as const;

/**
 * Type-safe IPC API wrapper for renderer process
 */
export class IPCAPI {
  private requestCounter = 0;

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Invoke IPC method with timeout and error handling
   */
  private async invoke<T = any>(
    channel: string,
    params: any = {},
    timeout: number = 30000
  ): Promise<IPCResponse<T>> {
    const requestId = this.generateRequestId();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Race between IPC call and timeout
      const response = await Promise.race([
        window.electronAPI.invoke(channel, { ...params, requestId }),
        timeoutPromise
      ]);

      return response as IPCResponse<T>;
    } catch (error: any) {
      // Return error response
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'IPC call failed',
          details: error
        },
        requestId
      };
    }
  }

  // === Project APIs ===

  /**
   * List all projects with optional filters and pagination
   */
  async listProjects(params?: {
    query?: string;
    filters?: Record<string, any>;
    sort?: string;
    page?: number;
    pageSize?: number;
  }): Promise<IPCResponse<{ projects: Project[]; total: number; page: number }>> {
    return this.invoke(CHANNELS.PROJECT_LIST, params);
  }

  /**
   * Get single project by ID
   */
  async getProject(id: string): Promise<IPCResponse<{ project: Project }>> {
    return this.invoke(CHANNELS.PROJECT_GET, { id });
  }

  /**
   * Update project metadata
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<IPCResponse<{ project: Project }>> {
    return this.invoke(CHANNELS.PROJECT_UPDATE, { id, updates });
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<IPCResponse<{ deleted: boolean }>> {
    return this.invoke(CHANNELS.PROJECT_DELETE, { id });
  }

  /**
   * Touch (set) lastModifiedAt for all projects. Optionally pass timestamp.
   */
  async touchAllProjects(timestamp?: string): Promise<IPCResponse<{ touched: number }>> {
    return this.invoke(CHANNELS.PROJECT_TOUCH_ALL, { timestamp });
  }

  /**
   * Refresh lastModifiedAt for all projects by reading filesystem mtime
   */
  async refreshProjectsModifiedFromFs(): Promise<IPCResponse<{ refreshed: number }>> {
    return this.invoke(CHANNELS.PROJECT_REFRESH_FROM_FS, {});
  }

  // === Scan APIs ===

  /**
   * Start directory scan
   */
  async startScan(paths: Array<string | { path: string; includeAsProject?: boolean }>): Promise<IPCResponse<{ jobId: string }>> {
    return this.invoke(CHANNELS.SCAN_START, { paths });
  }

  /**
   * Get scan job status
   */
  async getScanStatus(jobId: string): Promise<IPCResponse<{
    progress: number;
    status: 'running' | 'complete' | 'error';
    errors?: string[];
  }>> {
    return this.invoke(CHANNELS.SCAN_STATUS, { jobId });
  }

  /**
   * Cancel running scan
   */
  async cancelScan(jobId: string): Promise<IPCResponse<{ cancelled: boolean }>> {
    return this.invoke(CHANNELS.SCAN_CANCEL, { jobId });
  }

  // === File System APIs ===

  /**
   * Get file tree for a project
   */
  async getFileTree(projectId: string, maxDepth: number = 3): Promise<IPCResponse<{ tree: FileTreeNode }>> {
    return this.invoke(CHANNELS.FILE_TREE, { projectId, maxDepth });
  }

  /**
   * List Markdown files in a project root
   */
  async listMarkdownFiles(projectId: string): Promise<IPCResponse<{ mdFiles: string[] }>> {
    return this.invoke(CHANNELS.MARKDOWN_LIST, { projectId });
  }

  /**
   * Fetch content of a Markdown file
   */
  async fetchMarkdown(projectId: string, filePath: string): Promise<IPCResponse<{ content: string; filePath: string }>> {
    return this.invoke(CHANNELS.MARKDOWN_FETCH, { projectId, filePath });
  }

  /**
   * List git branches for a project
   */
  async listBranches(projectId: string): Promise<IPCResponse<{ branches: string[] }>> {
    return this.invoke(CHANNELS.GIT_LIST_BRANCHES, { projectId });
  }

  /**
   * List recent commits for a project
   */
  async listRecentCommits(projectId: string, limit: number = 20): Promise<IPCResponse<{ commits: Array<any> }>> {
    return this.invoke(CHANNELS.GIT_LIST_COMMITS, { projectId, limit });
  }

  /**
   * Show native dialog to select a folder. Returns selected path or cancelled.
   */
  async selectFolder(defaultPath?: string): Promise<IPCResponse<{ path?: string }>> {
    return this.invoke(CHANNELS.DIALOG_SELECT_FOLDER, { defaultPath });
  }

  /**
   * Checkout a git branch for a project
   * @param force optional boolean to force checkout (passes through to main)
   */
  async checkoutBranch(projectId: string, branch: string, force?: boolean): Promise<IPCResponse<{ branch: string }>> {
    return this.invoke(CHANNELS.GIT_CHECKOUT, { projectId, branch, force });
  }

  // === Quick Actions ===

  /**
   * Open project in IDE
   */
  async openIDE(projectPath: string): Promise<IPCResponse<{ opened: boolean }>> {
    return this.invoke('action:open-ide', { projectPath });
  }

  /**
   * Open terminal in project directory
   */
  async openTerminal(projectPath: string): Promise<IPCResponse<{ opened: boolean }>> {
    return this.invoke('action:open-terminal', { projectPath });
  }

  /**
   * Open remote repository in browser
   */
  async openRemote(remoteUrl: string): Promise<IPCResponse<{ opened: boolean }>> {
    return this.invoke('action:open-remote', { remoteUrl });
  }

  /**
   * Export projects to a JSON file (shows save dialog)
   */
  async exportProjects(): Promise<IPCResponse<{ path: string }>> {
    return this.invoke('project:export');
  }

  /**
   * Import projects from a JSON file (shows open dialog)
   */
  async importProjects(options?: { mode?: 'replace' | 'merge'; onConflict?: 'overwrite' | 'skip' }): Promise<IPCResponse<{ imported: boolean; count?: number }>> {
    return this.invoke('project:import', options || {});
  }

  /**
   * Preview an import file (shows open dialog) and returns metadata (count and sample)
   */
  async previewImport(): Promise<IPCResponse<{ filePath: string; count: number; sample: Array<{id?: string; name?: string; path?: string; provider?: string}> }>> {
    return this.invoke('project:preview-import');
  }

  /**
   * Get stored settings
   */
  async getSettings(): Promise<IPCResponse<{ settings: any }>> {
    return this.invoke('settings:get');
  }

  /**
   * Persist settings
   */
  async setSettings(settings: any): Promise<IPCResponse<{ saved: boolean }>> {
    return this.invoke('settings:set', { settings });
  }

  /**
   * Clear local cache (projects) and notify renderers
   */
  async clearCache(): Promise<IPCResponse<{ cleared: boolean }>> {
    return this.invoke('cache:clear');
  }

  // === Event Listeners ===

  /**
   * Listen to scan progress events
   */
  onScanProgress(callback: (data: { jobId: string; discovered: number; processed: number }) => void): () => void {
    return window.electronAPI.on('scan:progress', callback);
  }

  /**
   * Listen to project update events
   */
  onProjectUpdated(callback: (data: { projectId: string; changes: Partial<Project> }) => void): () => void {
    return window.electronAPI.on('project:updated', callback);
  }

  /**
   * Listen to project deletion events
   */
  onProjectDeleted(callback: (data: { projectId: string }) => void): () => void {
    return window.electronAPI.on('project:deleted', callback);
  }

  /**
   * Listen to projects imported event
   */
  onProjectsImported(callback: (data: { imported: boolean; count?: number }) => void): () => void {
    return window.electronAPI.on('projects:imported', callback);
  }

  /**
   * Listen to projects touched event (bulk lastModifiedAt updates)
   */
  onProjectsTouched(callback: (data: { timestamp: string; touched: number }) => void): () => void {
    return window.electronAPI.on('projects:touched', callback);
  }

  /**
   * Listen to cache cleared events
   */
  onCacheCleared(callback: (data: { cleared: boolean }) => void): () => void {
    return window.electronAPI.on('cache:cleared', callback);
  }
}

// Singleton instance
export const ipcAPI = new IPCAPI();
