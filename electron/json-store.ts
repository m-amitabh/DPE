import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import type { ProjectsData, Project } from '../src/lib/types';

/**
 * JSON Store - Manages projects.json with atomic writes and backup recovery
 */
export class JSONStore {
  private filePath: string;
  private backupPath: string;
  private tmpPath: string;
  private data: ProjectsData | null = null;
  private settingsPath: string;
  private settingsCache: any = null;
  private writeDebounceTimer: NodeJS.Timeout | null = null;
  private pendingWrites: Map<string, Partial<Project>> = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'projects.json');
    this.backupPath = path.join(userDataPath, 'projects.json.bak');
    this.tmpPath = path.join(userDataPath, 'projects.json.tmp');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    
    log.info(`JSON Store initialized at: ${this.filePath}`);
  }

  /**
   * Load settings from disk (returns defaults if missing)
   */
  async getSettings(): Promise<any> {
    if (this.settingsCache) return this.settingsCache;
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      this.settingsCache = JSON.parse(content);
      return this.settingsCache;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // return defaults
        this.settingsCache = {
          scanPaths: [],
          ignoredPatterns: ['node_modules', '.git', 'dist'],
          ideCommand: 'code {path}',
          terminalCommand: ''
        };
        return this.settingsCache;
      }
      throw error;
    }
  }

  /**
   * Persist settings to disk
   */
  async setSettings(settings: any): Promise<void> {
    this.settingsCache = settings;
    const content = JSON.stringify(settings, null, 2);
    await fs.writeFile(this.settingsPath, content, 'utf-8');
  }

  /**
   * Initialize and load data from disk
   */
  async initialize(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      log.error('Failed to initialize JSON store:', error);
      throw error;
    }
  }

  /**
   * Load projects from disk with backup recovery
   */
  private async load(): Promise<void> {
    try {
      // Try loading main file
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      // Validate and migrate if needed
      this.data = this.migrate(parsed);
      log.info(`Loaded ${this.data.projects.length} projects`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create new
        log.info('No projects.json found, creating new');
        this.data = this.createEmpty();
        await this.flush();
      } else {
        // File is corrupt, try backup
        log.warn('Main file corrupt, attempting backup recovery');
        await this.loadBackup();
      }
    }
  }

  /**
   * Load from backup file
   */
  private async loadBackup(): Promise<void> {
    try {
      const backupContent = await fs.readFile(this.backupPath, 'utf-8');
      const parsed = JSON.parse(backupContent);
      this.data = this.migrate(parsed);
      log.info('Recovered from backup successfully');
      
      // Save recovered data as main file
      await this.flush();
    } catch (error) {
      // Both files failed, start fresh
      log.error('Both main and backup files failed, starting fresh');
      this.data = this.createEmpty();
      await this.flush();
    }
  }

  /**
   * Create empty data structure
   */
  private createEmpty(): ProjectsData {
    return {
      meta: {
        version: 1,
        lastScanAt: new Date().toISOString(),
        projectCount: 0
      },
      projects: []
    };
  }

  /**
   * Migrate data to current schema version
   */
  private migrate(data: any): ProjectsData {
    const version = data.meta?.version || 0;
    
    if (version < 1) {
      // v0 → v1: add scanStatus field if missing
      data.projects = (data.projects || []).map((p: any) => ({
        ...p,
        scanStatus: p.scanStatus || 'complete'
      }));
      data.meta = { ...(data.meta || {}), version: 1 };
    }
    
    // Ensure meta has all required fields
    data.meta = {
      version: 1,
      lastScanAt: data.meta?.lastScanAt || new Date().toISOString(),
      projectCount: data.projects?.length || 0,
      ...data.meta
    };
    
    return data as ProjectsData;
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<Project[]> {
    if (!this.data) {
      await this.load();
    }
    return [...(this.data?.projects || [])];
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    if (!this.data) {
      await this.load();
    }
    return this.data?.projects.find(p => p.id === id) || null;
  }

  /**
   * Add or update project
   * First tries to match by ID, then by path to prevent duplicates
   */
  async upsertProject(project: Project): Promise<void> {
    if (!this.data) {
      await this.load();
    }
    
    // First try to find by ID
    let index = this.data!.projects.findIndex(p => p.id === project.id);
    
    // If not found by ID, try to find by path to prevent duplicates
    if (index < 0) {
      index = this.data!.projects.findIndex(p => p.path === project.path);
      if (index >= 0) {
        // Found existing project at same path with different ID
        // This can happen if the project was re-scanned with a bug or imported
        const existingId = this.data!.projects[index].id;
        log.info(`Project at ${project.path} found with different ID (old: ${existingId}, new: ${project.id}), updating existing entry`);
      }
    }
    
    if (index >= 0) {
      this.data!.projects[index] = project;
    } else {
      this.data!.projects.push(project);
    }
    
    this.data!.meta.projectCount = this.data!.projects.length;
    this.data!.meta.lastScanAt = new Date().toISOString();
    
    await this.debouncedWrite();
  }

  /**
   * Update project metadata (partial update)
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    if (!this.data) {
      await this.load();
    }
    
    const project = this.data!.projects.find(p => p.id === id);
    if (!project) {
      return null;
    }
    
    Object.assign(project, updates);
    project.scanStatus = 'user-modified'; // Mark as user-modified
    
    await this.debouncedWrite();
    return project;
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<boolean> {
    if (!this.data) {
      await this.load();
    }
    
    const initialLength = this.data!.projects.length;
    this.data!.projects = this.data!.projects.filter(p => p.id !== id);
    
    if (this.data!.projects.length < initialLength) {
      this.data!.meta.projectCount = this.data!.projects.length;
      await this.debouncedWrite();
      return true;
    }
    
    return false;
  }

  /**
   * Clear all stored projects (resets to empty) and flush to disk
   */
  async clear(): Promise<void> {
    this.data = this.createEmpty();
    await this.flush();
  }

  /**
   * Debounced write - batches writes within 500ms
   */
  private async debouncedWrite(): Promise<void> {
    if (this.writeDebounceTimer) {
      clearTimeout(this.writeDebounceTimer);
    }
    
    this.writeDebounceTimer = setTimeout(() => {
      this.flush().catch(error => {
        log.error('Failed to flush data:', error);
      });
    }, 500);
  }

  /**
   * Force immediate write to disk with atomic rename
   */
  async flush(): Promise<void> {
    if (!this.data) {
      return;
    }
    
    try {
      // Write to temp file
      const content = JSON.stringify(this.data, null, 2);
      await fs.writeFile(this.tmpPath, content, 'utf-8');
      
      // Create backup of current file if it exists
      try {
        await fs.copyFile(this.filePath, this.backupPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          log.warn('Failed to create backup:', error);
        }
      }
      
      // Atomic rename
      await fs.rename(this.tmpPath, this.filePath);
      
      log.info('Data flushed to disk successfully');
    } catch (error) {
      log.error('Failed to flush data to disk:', error);
      throw error;
    }
  }

  /**
   * Get data snapshot (for export)
   */
  async export(): Promise<ProjectsData> {
    if (!this.data) {
      await this.load();
    }
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * Import data (replaces existing)
   */
  async import(data: ProjectsData): Promise<void> {
    this.data = this.migrate(data);
    await this.flush();
    log.info('Data imported successfully');
  }
}

// Singleton instance
let storeInstance: JSONStore | null = null;

export function getStore(): JSONStore {
  if (!storeInstance) {
    storeInstance = new JSONStore();
  }
  return storeInstance;
}
