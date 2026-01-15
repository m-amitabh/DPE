import Fuse, { IFuseOptions } from 'fuse.js';
import log from 'electron-log';
import type { Project } from '../src/lib/types';

/**
 * Search Index Manager - Provides fuzzy search over projects
 */
export class SearchIndexManager {
  private fuse: Fuse<Project> | null = null;
  private projects: Project[] = [];

  private readonly fuseOptions: IFuseOptions<Project> = {
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'path', weight: 0.3 },
      { name: 'description', weight: 0.2 },
      { name: 'tags', weight: 0.1 },
    ],
    threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
  };

  /**
   * Build or rebuild the search index
   */
  buildIndex(projects: Project[]): void {
    const startTime = Date.now();
    this.projects = projects;
    this.fuse = new Fuse(projects, this.fuseOptions);
    const duration = Date.now() - startTime;
    
    log.info(`Search index built for ${projects.length} projects in ${duration}ms`);
  }

  /**
   * Add a project to the index
   */
  addProject(project: Project): void {
    if (!this.fuse) {
      this.buildIndex([project]);
      return;
    }

    this.projects.push(project);
    // Rebuild index (Fuse doesn't support incremental updates efficiently)
    this.buildIndex(this.projects);
  }

  /**
   * Update a project in the index
   */
  updateProject(project: Project): void {
    const index = this.projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      this.projects[index] = project;
      this.buildIndex(this.projects);
    } else {
      this.addProject(project);
    }
  }

  /**
   * Remove a project from the index
   */
  removeProject(projectId: string): void {
    this.projects = this.projects.filter(p => p.id !== projectId);
    if (this.projects.length > 0) {
      this.buildIndex(this.projects);
    } else {
      this.fuse = null;
    }
  }

  /**
   * Search projects
   */
  search(query: string, limit: number = 50): Project[] {
    if (!this.fuse || !query || query.trim().length === 0) {
      return this.projects.slice(0, limit);
    }

    const results = this.fuse.search(query, { limit });
    return results.map(result => result.item);
  }

  /**
   * Get all projects with optional filtering and sorting
   */
  getAll(options?: {
    filters?: {
      type?: 'git' | 'local';
      provider?: string;
      tags?: string[];
      importance?: number;
    };
    sort?: {
      by: 'name' | 'lastModifiedAt' | 'createdAt' | 'sizeBytes' | 'importance';
      order: 'asc' | 'desc';
    };
    page?: number;
    pageSize?: number;
  }): { projects: Project[]; total: number } {
    let filtered = [...this.projects];

    // Apply filters
    if (options?.filters) {
      const { type, provider, tags, importance } = options.filters;

      if (type) {
        filtered = filtered.filter(p => p.type === type);
      }

      if (provider) {
        filtered = filtered.filter(p => p.provider === provider);
      }

      if (tags && tags.length > 0) {
        filtered = filtered.filter(p =>
          tags.some(tag => p.tags.includes(tag))
        );
      }

      if (importance !== undefined) {
        filtered = filtered.filter(p => p.importance === importance);
      }
    }

    // Apply sorting
    if (options?.sort) {
      const { by, order } = options.sort;
      filtered.sort((a, b) => {
        let aVal: any = a[by];
        let bVal: any = b[by];

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return order === 'asc' ? 1 : -1;
        if (bVal == null) return order === 'asc' ? -1 : 1;

        // String comparison
        if (typeof aVal === 'string') {
          const cmp = aVal.localeCompare(bVal);
          return order === 'asc' ? cmp : -cmp;
        }

        // Number comparison
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // Apply pagination
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return {
      projects: paginated,
      total: filtered.length
    };
  }

  /**
   * Get index stats
   */
  getStats(): { projectCount: number; indexSize: number } {
    return {
      projectCount: this.projects.length,
      indexSize: this.fuse ? JSON.stringify(this.fuse.getIndex()).length : 0
    };
  }
}

// Singleton instance
let searchInstance: SearchIndexManager | null = null;

export function getSearchIndex(): SearchIndexManager {
  if (!searchInstance) {
    searchInstance = new SearchIndexManager();
  }
  return searchInstance;
}
