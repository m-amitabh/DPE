 
import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import * as fs from 'fs/promises';
import { glob } from 'fast-glob';
import * as path from 'path';
import { getStore } from './json-store';
import { getScanJobManager } from './scan-job-manager';
import { getSearchIndex } from './search-index';
import type { IPCResponse, Project } from '../src/lib/types';

/**
 * Initialize all IPC handlers
 */
export function setupIPCHandlers() {
  const store = getStore();

  // Helper to create response
  function createResponse<T>(
    success: boolean,
    data?: T,
    error?: IPCResponse['error'],
    requestId: string = ''
  ): IPCResponse<T> {
    return { success, data, error, requestId };
  }

  // === Project Handlers ===

  // Touch lastModifiedAt for all projects (set to provided timestamp or now)
  ipcMain.handle('project:touchAll', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const timestamp = params?.timestamp || new Date().toISOString();
      const allProjects = await store.getAllProjects();
      let touched = 0;

      for (const p of allProjects) {
        try {
          await store.updateProject(p.id, { lastModifiedAt: timestamp });
          touched++;
        } catch (e) {
          log.warn(`Failed to touch project ${p.id}:`, (e as any)?.message || e);
        }
      }

      // Notify renderers once (they can reload as needed)
      const allWindows = BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        win.webContents.send('projects:touched', { timestamp, touched });
      }

      return createResponse(true, { touched }, undefined, requestId);
    } catch (error: any) {
      log.error('Error touching all projects:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

  // Refresh lastModifiedAt for all projects by reading filesystem mtime
  ipcMain.handle('project:refreshModifiedFromFS', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const allProjects = await store.getAllProjects();
      let refreshed = 0;

      for (const p of allProjects) {
        if (!p.path) continue;
        try {
          // Compute the latest mtime across files in the project directory.
          // Directory mtime may not reflect updates to file contents, so walk files
          // (limited depth) and pick the most recent mtime.
          let latest: Date | null = null;
          try {
            const files = await glob('**/*', {
              cwd: p.path,
              onlyFiles: true,
              deep: 6,
              ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
              stats: true
            });

            for (const f of files) {
              const fstat = (f as any).stats;
              if (fstat && fstat.mtime) {
                const m = new Date(fstat.mtime);
                if (!latest || m.getTime() > latest.getTime()) {
                  latest = m;
                }
              }
            }
          } catch (e) {
            // glob may fail on some paths; ignore and fallback to dir stat
            latest = null;
          }

          if (!latest) {
            const stats = await fs.stat(p.path);
            latest = stats.mtime;
          }

          const mtime = latest.toISOString();
          if (p.lastModifiedAt !== mtime) {
            await store.updateProject(p.id, { lastModifiedAt: mtime });
            refreshed++;
          }
        } catch (e) {
          log.warn(`Failed to stat/update project ${p.id} (${p.path}):`, (e as any)?.message || e);
        }
      }

      const allWindows = BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        win.webContents.send('projects:refreshed', { refreshed });
      }

      return createResponse(true, { refreshed }, undefined, requestId);
    } catch (error: any) {
      log.error('Error refreshing projects from FS:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

  ipcMain.handle('project:list', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const searchIndex = getSearchIndex();
      const { query, filters, sort, page, pageSize } = params || {};
      // Normalize sort parameter: accept either a string like '-lastModifiedAt' or an object
      let sortObj: { by: string; order: 'asc' | 'desc' } | undefined;
      if (typeof sort === 'string' && sort.length > 0) {
        if (sort.startsWith('-')) {
          sortObj = { by: sort.substring(1), order: 'desc' };
        } else {
          sortObj = { by: sort, order: 'asc' };
        }
      } else if (sort && typeof sort === 'object' && (sort.by || sort.order)) {
        // assume well-formed
        sortObj = { by: (sort as any).by, order: (sort as any).order || 'asc' } as any;
      }

      let result;
      if (query && query.trim().length > 0) {
        // Use fuzzy search
        let projects = searchIndex.search(query, pageSize || 50);

        // Apply sorting to search results if requested
        if (sortObj && sortObj.by) {
          projects = projects.slice();
          projects.sort((a, b) => {
            let aVal: any = a[sortObj!.by as any];
            let bVal: any = b[sortObj!.by as any];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return sortObj!.order === 'asc' ? 1 : -1;
            if (bVal == null) return sortObj!.order === 'asc' ? -1 : 1;

            if (typeof aVal === 'string') {
              const cmp = aVal.localeCompare(bVal);
              return sortObj!.order === 'asc' ? cmp : -cmp;
            }

            return sortObj!.order === 'asc' ? aVal - bVal : bVal - aVal;
          });
        }

        result = {
          projects,
          total: projects.length,
          page: 1
        };
      } else {
        // Use filter/sort
        const searchResult = searchIndex.getAll({
          filters,
          sort: sortObj,
          page,
          pageSize
        });
        result = {
          ...searchResult,
          page: page || 1
        };
      }

      return createResponse(true, result, undefined, requestId);
    } catch (error: any) {
      log.error('Error listing projects:', error);
      return createResponse(
        false,
        undefined,
        {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to list projects'
        },
        requestId
      );
    }
  });

  ipcMain.handle('project:get', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { id } = params;
      if (!id) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Project ID is required' },
          requestId
        );
      }

      const project = await store.getProject(id);
      if (!project) {
        return createResponse(
          false,
          undefined,
          { code: 'NOT_FOUND', message: `Project ${id} not found` },
          requestId
        );
      }

      return createResponse(true, { project }, undefined, requestId);
    } catch (error: any) {
      log.error('Error getting project:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  ipcMain.handle('project:update', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { id, updates } = params;
      if (!id || !updates) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'ID and updates are required' },
          requestId
        );
      }

      const project = await store.updateProject(id, updates);
      if (!project) {
        return createResponse(
          false,
          undefined,
          { code: 'NOT_FOUND', message: `Project ${id} not found` },
          requestId
        );
      }

      // Notify other windows
      event.sender.send('project:updated', { projectId: id, changes: updates });

      return createResponse(true, { project }, undefined, requestId);
    } catch (error: any) {
      log.error('Error updating project:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  ipcMain.handle('project:delete', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { id } = params;
      if (!id) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Project ID is required' },
          requestId
        );
      }

      const deleted = await store.deleteProject(id);
      
      if (deleted) {
        // Notify other windows
        event.sender.send('project:deleted', { projectId: id });
      }

      return createResponse(true, { deleted }, undefined, requestId);
    } catch (error: any) {
      log.error('Error deleting project:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  // === Scan Handlers ===

  ipcMain.handle('scan:start', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { paths } = params;
      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Scan paths are required' },
          requestId
        );
      }

      // Start scan with configuration
      const scanManager = getScanJobManager();
      const jobId = await scanManager.startScan({
        paths,
        ignoredPatterns: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/target/**',
          '**/.venv/**',
          '**/__pycache__/**'
        ],
        maxDepth: 5,
        minSizeBytes: 0
      });

      // Listen to progress and emit to renderer
      scanManager.onProgress((id, progress) => {
        const allWindows = BrowserWindow.getAllWindows();
        for (const window of allWindows) {
          window.webContents.send('scan:progress', {
            jobId: id,
            discovered: progress.discovered,
            processed: progress.processed
          });
        }
      });

      return createResponse(
        true,
        { jobId },
        undefined,
        requestId
      );
    } catch (error: any) {
      log.error('Error starting scan:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  ipcMain.handle('scan:status', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { jobId } = params;
      if (!jobId) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Job ID is required' },
          requestId
        );
      }

      const scanManager = getScanJobManager();
      const job = scanManager.getJobStatus(jobId);

      if (!job) {
        return createResponse(
          false,
          undefined,
          { code: 'NOT_FOUND', message: `Scan job ${jobId} not found` },
          requestId
        );
      }

      const progress = job.status === 'running' 
        ? (job.progress.discovered > 0 ? (job.progress.processed / job.progress.discovered) * 100 : 0)
        : 100;

      return createResponse(
        true,
        {
          progress,
          status: job.status,
          errors: job.result?.errors || []
        },
        undefined,
        requestId
      );
    } catch (error: any) {
      log.error('Error getting scan status:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  ipcMain.handle('scan:cancel', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { jobId } = params;
      if (!jobId) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Job ID is required' },
          requestId
        );
      }

      const scanManager = getScanJobManager();
      const cancelled = scanManager.cancelScan(jobId);

      return createResponse(
        true,
        { cancelled },
        undefined,
        requestId
      );
    } catch (error: any) {
      log.error('Error cancelling scan:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  // === File System Handlers ===

  /**
   * Get file tree for a project directory
   */
  ipcMain.handle('file:tree', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectId, maxDepth = 3 } = params;
      
      if (!projectId) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Project ID is required' },
          requestId
        );
      }

      // Get project to find its path
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(
          false,
          undefined,
          { code: 'NOT_FOUND', message: `Project ${projectId} not found` },
          requestId
        );
      }

      // Build file tree
      const tree = await buildFileTree(project.path, maxDepth);

      return createResponse(true, { tree }, undefined, requestId);
    } catch (error: any) {
      log.error('Error getting file tree:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  /**
   * List README files in a project
   */
  ipcMain.handle('readme:list', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectId } = params;
      
      if (!projectId) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Project ID is required' },
          requestId
        );
      }

      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(
          false,
          undefined,
          { code: 'NOT_FOUND', message: `Project ${projectId} not found` },
          requestId
        );
      }

      // Return README files from project metadata (already scanned)
      const readmeFiles = project.readmeFiles || [];

      return createResponse(
        true,
        { readmeFiles },
        undefined,
        requestId
      );
    } catch (error: any) {
      log.error('Error listing README files:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  /**
   * Fetch content of a README file
   */
  ipcMain.handle('readme:fetch', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectId, filePath: relativeFilePath } = params;
      
      if (!projectId || !relativeFilePath) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Project ID and file path are required' },
          requestId
        );
      }

      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(
          false,
          undefined,
          { code: 'NOT_FOUND', message: `Project ${projectId} not found` },
          requestId
        );
      }

      // Build absolute path and validate it's within project directory
      const absolutePath = path.join(project.path, relativeFilePath);
      const normalizedProjectPath = path.normalize(project.path);
      const normalizedFilePath = path.normalize(absolutePath);
      
      if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'File path must be within project directory' },
          requestId
        );
      }

      // Read file content
      const content = await fs.readFile(absolutePath, 'utf-8');

      return createResponse(
        true,
        { content, filePath: relativeFilePath },
        undefined,
        requestId
      );
    } catch (error: any) {
      log.error('Error fetching README:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: error.message },
        requestId
      );
    }
  });

  /**
   * List git branches for a project
   */
  ipcMain.handle('git:list-branches', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectId } = params;
      if (!projectId) {
        return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project ID is required' }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, undefined, { code: 'NOT_FOUND', message: `Project ${projectId} not found` }, requestId);
      }

      // Run `git branch --format="%(refname:short)"` in project.path
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const cmd = `git -C "${project.path}" for-each-ref --format="%(refname:short)" refs/heads`;
      const { stdout } = await execAsync(cmd);
      const branches = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      return createResponse(true, { branches }, undefined, requestId);
    } catch (error: any) {
      log.error('Error listing git branches:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

  /**
   * List recent commits for a project
   */
  ipcMain.handle('git:list-commits', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectId, limit = 20 } = params || {};
      if (!projectId) {
        return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project ID is required' }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, undefined, { code: 'NOT_FOUND', message: `Project ${projectId} not found` }, requestId);
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Use a delimiter to safely parse fields
      const format = '%H|||%an|||%ae|||%ad|||%s';
      const cmd = `git -C "${project.path}" log -n ${Number(limit)} --pretty=format:"${format}" --date=iso`;
      const { stdout } = await execAsync(cmd);
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const commits = lines.map((line: string) => {
        const parts = line.split('|||');
        return {
          hash: parts[0] || '',
          authorName: parts[1] || '',
          authorEmail: parts[2] || '',
          date: parts[3] || '',
          message: parts[4] || ''
        };
      });

      return createResponse(true, { commits }, undefined, requestId);
    } catch (error: any) {
      log.error('Error listing recent commits:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

  /**
   * Checkout a git branch for a project
   */
  ipcMain.handle('git:checkout', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectId, branch } = params;
      if (!projectId || !branch) {
        return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project ID and branch are required' }, requestId);
      }
      const project = await store.getProject(projectId);
      if (!project) {
        return createResponse(false, undefined, { code: 'NOT_FOUND', message: `Project ${projectId} not found` }, requestId);
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Check for uncommitted changes first
      const statusCmd = `git -C "${project.path}" status --porcelain`;
      const { stdout: statusOut } = await execAsync(statusCmd);
      if (statusOut && statusOut.trim().length > 0 && !params?.force) {
        // Return a specific error signaling uncommitted changes
        return createResponse(
          false,
          undefined,
          { code: 'UNCOMMITTED_CHANGES', message: 'There are uncommitted changes', details: statusOut },
          requestId
        );
      }

      // Use git -C <path> checkout <branch>
      const cmd = `git -C "${project.path}" checkout "${branch}"`;
      await execAsync(cmd);

      // Update project branch in store
      const updated = await store.updateProject(projectId, { branch });

      // Notify renderers about the update
      const allWindows = BrowserWindow.getAllWindows();
      for (const win of allWindows) {
        win.webContents.send('project:updated', { projectId, changes: { branch } });
      }

      return createResponse(true, { branch, project: updated }, undefined, requestId);
    } catch (error: any) {
      log.error('Error checking out branch:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

      /**
       * List all root-level Markdown (.md) files in a project
       */
      ipcMain.handle('markdown:list', async (event, params) => {
        const requestId = params?.requestId || '';
        try {
          const { projectId } = params;
          if (!projectId) {
            return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project ID is required' }, requestId);
          }
          const project = await store.getProject(projectId);
          if (!project) {
            return createResponse(false, undefined, { code: 'NOT_FOUND', message: `Project ${projectId} not found` }, requestId);
          }
          const files = await fs.readdir(project.path);
          const mdFiles = files.filter(f => f.match(/\.md$/i));
          return createResponse(true, { mdFiles }, undefined, requestId);
        } catch (error: any) {
          log.error('Error listing Markdown files:', error);
          return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
        }
      });

      /**
       * Fetch content of a Markdown file
       */
      ipcMain.handle('markdown:fetch', async (event, params) => {
        const requestId = params?.requestId || '';
        try {
          const { projectId, filePath: relativeFilePath } = params;
          if (!projectId || !relativeFilePath) {
            return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project ID and file path are required' }, requestId);
          }
          const project = await store.getProject(projectId);
          if (!project) {
            return createResponse(false, undefined, { code: 'NOT_FOUND', message: `Project ${projectId} not found` }, requestId);
          }
          const absolutePath = path.join(project.path, relativeFilePath);
          const normalizedProjectPath = path.normalize(project.path);
          const normalizedFilePath = path.normalize(absolutePath);
          if (!normalizedFilePath.startsWith(normalizedProjectPath)) {
            return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'File path must be within project directory' }, requestId);
          }
          const content = await fs.readFile(absolutePath, 'utf-8');
          return createResponse(true, { content, filePath: relativeFilePath }, undefined, requestId);
        } catch (error: any) {
          log.error('Error fetching Markdown:', error);
          return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
        }
      });

  // === Quick Actions ===

  // === Dialog helpers ===
  ipcMain.handle('dialog:select-folder', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { dialog } = require('electron');
      const win = BrowserWindow.getFocusedWindow();
      const defaultPath = params?.defaultPath;

      const result = await dialog.showOpenDialog(win, {
        title: 'Select Folder',
        properties: ['openDirectory', 'createDirectory'] as any,
        defaultPath: defaultPath || undefined
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return createResponse(false, undefined, { code: 'CANCELLED', message: 'No folder selected' }, requestId);
      }

      return createResponse(true, { path: result.filePaths[0] }, undefined, requestId);
    } catch (error: any) {
      log.error('Error showing folder dialog:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

  /**
   * Open project in IDE (VS Code)
   */
  ipcMain.handle('action:open-ide', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectPath } = params;
      if (!projectPath) {
        return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project path is required' }, requestId);
      }
      const store = getStore();
      const settings = await store.getSettings();
      let command: string | undefined = settings.ideCommand;
      if (!command || typeof command !== 'string' || !command.includes('{path}')) {
        // Fallback to platform default
        if (process.platform === 'darwin') {
          command = 'open -a "Visual Studio Code" "{path}"';
        } else if (process.platform === 'win32') {
          command = 'code "{path}"';
        } else {
          command = 'code "{path}"';
        }
      }
      command = command.replace('{path}', projectPath);
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      await execAsync(command);
      return createResponse(true, { opened: true }, undefined, requestId);
    } catch (error: any) {
      log.error('Error opening IDE:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: `Failed to open IDE: ${error.message}` }, requestId);
    }
  });

  /**
   * Open terminal in project directory
   */
  ipcMain.handle('action:open-terminal', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { projectPath } = params;
      if (!projectPath) {
        return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Project path is required' }, requestId);
      }
      const store = getStore();
      const settings = await store.getSettings();
      let command: string | undefined = settings.terminalCommand;
      if (!command || typeof command !== 'string' || !command.includes('{path}')) {
        // Fallback to platform default
        if (process.platform === 'darwin') {
          command = 'open -a Terminal "{path}"';
        } else if (process.platform === 'win32') {
          command = 'start cmd /K cd "{path}"';
        } else {
          // Try common Linux terminals
          const terminals = [
            'gnome-terminal',
            'konsole',
            'xfce4-terminal',
            'x-terminal-emulator',
            'xterm'
          ];
          const { execSync } = require('child_process');
          let found = '';
          for (const term of terminals) {
            try {
              execSync(`command -v ${term}`);
              found = term;
              break;
            } catch {}
          }
          if (found) {
            command = `${found} --working-directory="{path}" &`;
          } else {
            command = 'xterm &';
          }
        }
      }
      command = command.replace('{path}', projectPath);
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      await execAsync(command);
      return createResponse(true, { opened: true }, undefined, requestId);
    } catch (error: any) {
      log.error('Error opening terminal:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: `Failed to open terminal: ${error.message}` }, requestId);
    }
  });

  /**
   * Open remote URL in browser
   */
  ipcMain.handle('action:open-remote', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { remoteUrl } = params;
      
      if (!remoteUrl) {
        return createResponse(
          false,
          undefined,
          { code: 'INVALID_INPUT', message: 'Remote URL is required' },
          requestId
        );
      }

      const { shell } = require('electron');
      
      // Normalize remote URL so it opens in browser.
      // Support forms: git@host:owner/repo.git, ssh://git@host/owner/repo.git,
      // git+ssh://git@host/owner/repo.git, git://host/owner/repo.git, https://...
      let browserUrl = (remoteUrl || '').trim();

      // git@host:owner/repo.git -> https://host/owner/repo
      const sshShortMatch = browserUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
      if (sshShortMatch) {
        const host = sshShortMatch[1];
        const repoPath = sshShortMatch[2].replace(/\.git$/, '');
        browserUrl = `https://${host}/${repoPath}`;
      }

      // ssh://git@host/owner/repo.git or git+ssh://git@host/owner/repo.git
      const sshUrlMatch = browserUrl.match(/^(?:git\+ssh:\/\/|ssh:\/\/)?(?:git@)?([^\/]+)\/(.+?)(?:\.git)?$/);
      if (sshUrlMatch && !browserUrl.startsWith('http')) {
        const host = sshUrlMatch[1];
        const repoPath = sshUrlMatch[2].replace(/\.git$/, '');
        browserUrl = `https://${host}/${repoPath}`;
      }

      // git://host/owner/repo.git -> https://host/owner/repo
      if (browserUrl.startsWith('git://')) {
        browserUrl = browserUrl.replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
      }

      // If it's an https URL, strip trailing .git
      if (browserUrl.startsWith('http') && browserUrl.endsWith('.git')) {
        browserUrl = browserUrl.replace(/\.git$/, '');
      }

      await shell.openExternal(browserUrl);
      
      return createResponse(true, { opened: true }, undefined, requestId);
    } catch (error: any) {
      log.error('Error opening remote:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: `Failed to open remote: ${error.message}` },
        requestId
      );
    }
  });

  // === Export Projects ===
  ipcMain.handle('project:export', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const data = await store.export();
      const { dialog } = require('electron');
      const win = BrowserWindow.getFocusedWindow();

      const result = await dialog.showSaveDialog(win, {
        title: 'Export Projects',
        defaultPath: 'projects.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (result.canceled || !result.filePath) {
        return createResponse(
          false,
          undefined,
          { code: 'CANCELLED', message: 'Export cancelled' },
          requestId
        );
      }

      await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');

      return createResponse(true, { path: result.filePath }, undefined, requestId);
    } catch (error: any) {
      log.error('Error exporting projects:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: `Failed to export projects: ${error.message}` },
        requestId
      );
    }
  });

  // === Import Projects ===
  ipcMain.handle('project:import', async (event, params) => {
    const requestId = params?.requestId || '';
    try {
      const { dialog } = require('electron');
      const win = BrowserWindow.getFocusedWindow();

      const result = await dialog.showOpenDialog(win, {
        title: 'Import Projects',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return createResponse(
          false,
          undefined,
          { code: 'CANCELLED', message: 'Import cancelled' },
          requestId
        );
      }

      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Determine mode: replace (default) or merge
      const mode: 'replace' | 'merge' = params?.mode === 'merge' ? 'merge' : 'replace';
      const onConflict: 'overwrite' | 'skip' = params?.onConflict === 'skip' ? 'skip' : 'overwrite';

      if (mode === 'replace') {
        await store.import(parsed);
      } else {
        // Merge: upsert projects, handling conflicts according to onConflict
        const incomingProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
        for (const p of incomingProjects) {
          if (!p?.id) continue;
          const existing = await store.getProject(p.id);
          if (existing) {
            if (onConflict === 'overwrite') {
              await store.upsertProject(p as any);
            } else {
              // skip
            }
          } else {
            await store.upsertProject(p as any);
          }
        }
      }

      // Rebuild search index
      const searchIndex = getSearchIndex();
      const projects = await store.getAllProjects();
      searchIndex.buildIndex(projects);

      // Notify renderer processes
      event.sender.send('projects:imported', { imported: true, count: projects.length, mode, onConflict });

      return createResponse(true, { imported: true, count: projects.length, mode, onConflict }, undefined, requestId);
    } catch (error: any) {
      log.error('Error importing projects:', error);
      return createResponse(
        false,
        undefined,
        { code: 'INTERNAL_ERROR', message: `Failed to import projects: ${error.message}` },
        requestId
      );
    }
  });

  // === Preview Import (shows open dialog, returns parsed metadata without applying) ===
  ipcMain.handle('project:preview-import', async (event) => {
    const requestId = '';
    try {
      const { dialog } = require('electron');
      const win = BrowserWindow.getFocusedWindow();

      const result = await dialog.showOpenDialog(win, {
        title: 'Preview Import Projects',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return createResponse(false, undefined, { code: 'CANCELLED', message: 'Preview cancelled' }, requestId);
      }

      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content || '{}');

      const incoming = Array.isArray(parsed.projects) ? parsed.projects : [];
      const sample = incoming.slice(0, 10).map((p: any) => ({ id: p.id, name: p.name, path: p.path, provider: p.provider }));

      return createResponse(true, { filePath, count: incoming.length, sample }, undefined, requestId);
    } catch (error: any) {
      log.error('Error previewing import:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message }, requestId);
    }
  });

  // === Settings Handlers ===
  ipcMain.handle('settings:get', async (event) => {
    try {
      const settings = await store.getSettings();
      return createResponse(true, { settings });
    } catch (error: any) {
      log.error('Error getting settings:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message });
    }
  });

  ipcMain.handle('settings:set', async (event, params) => {
    try {
      const { settings } = params;
      if (!settings) {
        return createResponse(false, undefined, { code: 'INVALID_INPUT', message: 'Settings required' });
      }
      await store.setSettings(settings);
      return createResponse(true, { saved: true });
    } catch (error: any) {
      log.error('Error saving settings:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // === Cache Clear ===
  ipcMain.handle('cache:clear', async (event) => {
    try {
      await store.clear();
      // Notify renderers
      const allWindows = BrowserWindow.getAllWindows();
      for (const window of allWindows) {
        window.webContents.send('cache:cleared', { cleared: true });
      }
      return createResponse(true, { cleared: true });
    } catch (error: any) {
      log.error('Error clearing cache:', error);
      return createResponse(false, undefined, { code: 'INTERNAL_ERROR', message: error.message });
    }
  });

  log.info('IPC handlers registered');
}

/**
 * Build a file tree structure for a directory
 */
async function buildFileTree(
  dirPath: string,
  maxDepth: number,
  currentDepth: number = 0
): Promise<FileTreeNode> {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  const node: FileTreeNode = {
    name,
    path: dirPath,
    type: stats.isDirectory() ? 'directory' : 'file',
    size: stats.size,
    children: []
  };

  // Don't recurse if we've hit max depth or it's a file
  if (!stats.isDirectory() || currentDepth >= maxDepth) {
    return node;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    // Filter out common ignored directories
    const ignoredDirs = new Set([
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'target',
      '.venv',
      '__pycache__',
      '.cache',
      'coverage',
      '.idea',
      '.vscode'
    ]);

    const filteredEntries = entries.filter(entry => {
      if (entry.name.startsWith('.') && entry.name !== '.github') {
        return false;
      }
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
        return false;
      }
      return true;
    });

    // Sort: directories first, then alphabetically
    filteredEntries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    // Build children recursively
    const childPromises = filteredEntries.map(async (entry) => {
      const childPath = path.join(dirPath, entry.name);
      return buildFileTree(childPath, maxDepth, currentDepth + 1);
    });

    node.children = await Promise.all(childPromises);
  } catch (error) {
    log.error(`Error reading directory ${dirPath}:`, error);
    // Return node without children on error
  }

  return node;
}

/**
 * File tree node structure
 */
interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  children?: FileTreeNode[];
}
