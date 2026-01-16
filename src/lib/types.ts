// Type definitions for the application

export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'git' | 'local';
  tags: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  sizeBytes: number;
  createdAt: string;
  lastModifiedAt: string;
  fileCount: number;
  
  // Git-specific fields
  provider: 'github' | 'gitlab' | 'bitbucket' | 'other' | null;
  lastCommitHash: string | null;
  branch: string | null;
  remotes: Array<{
    name: string;
    url: string;
    provider?: 'github' | 'gitlab' | 'bitbucket';
    owner?: string;
    repo?: string;
  }>;
  
  // Additional metadata
  readmeFiles: string[];
  description?: string;
  language?: string;
  
  // Scan tracking
  scanStatus: 'complete' | 'pending' | 'scanning' | 'error' | 'user-modified';
  lastScannedAt: string | null;
  scanErrors?: string[];

  // Backwards-compatibility aliases (some modules still reference older field names)
  created_at?: string;
  last_used?: string;
  git?: {
    last_commit?: string;
  };
  disk_usage_bytes?: number;
  
  // Git provider API enrichment (optional)
  stars?: number;
  openIssues?: number;
  lastPushedAt?: string;
}

export interface Settings {
  scanPaths: Array<string | { path: string; includeAsProject?: boolean }>;
  ignoredPatterns: string[];
  maxDepth: number;
  minSizeBytes: number;
  
  // Scan scheduling
  autoScan: boolean;
  scanFrequency: 'manual' | 'daily' | 'weekly' | 'on-startup';
  lastAutoScanAt: string | null;
  
  defaultIDE: { command: string; args: string[] };
  defaultTerminal: { command: string; args: string[] };
  
  uiPrefs: {
    theme: 'light' | 'dark' | 'system';
    viewMode: 'grid' | 'list';
    sortBy: 'name' | 'lastModifiedAt' | 'createdAt';
    sortOrder: 'asc' | 'desc';
  };
  
  gitProviders: {
    github?: { enabled: boolean; token: string; lastSync?: string };
    gitlab?: { enabled: boolean; baseUrl: string; token: string };
  };
}

export interface ProjectsData {
  meta: {
    version: number;
    lastScanAt: string;
    projectCount: number;
  };
  projects: Project[];
}

// IPC types
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'INVALID_INPUT' | 'TIMEOUT' | 'INTERNAL_ERROR' | 'UNCOMMITTED_CHANGES';
    message: string;
    details?: any;
  };
  requestId: string;
}

export interface IPCRequest {
  method: string;
  params: any;
  requestId: string;
}

// File system types
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  children?: FileTreeNode[];
}

// Additional exported helper types used across the codebase
export type RemoteProvider = 'github' | 'gitlab' | 'bitbucket' | null;
export type SortBy = 'last_used' | 'created' | 'last_commit' | 'disk_usage' | 'importance' | 'name';
