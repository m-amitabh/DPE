import { useState, useEffect } from 'react';
import { ArrowLeft, FolderGit2, Folder, Edit, ExternalLink, Terminal, Code2, Trash2, Calendar, HardDrive, GitBranch, Tag as TagIcon, Star, FileText, Loader2 } from 'lucide-react';
import { Project, FileTreeNode } from '../lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { formatBytes, formatRelativeTime, getRemoteProvider } from '../lib/utils-project';
import { ipcAPI } from '../lib/ipc-api';
import { FileTree } from './file-tree';
import { BranchSelector } from './branch-selector';
import { MarkdownRenderer } from './markdown-renderer';


// Project detail page with Overview, Files, and README tabs
interface ProjectDetailPageProps {
  project: Project;
  onBack: () => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onOpenIDE: (project: Project) => void;
  onOpenTerminal: (project: Project) => void;
  onOpenRemote: (project: Project) => void;
}

export function ProjectDetailPage({
  project,
  onBack,
  onEdit,
  onDelete,
  onOpenIDE,
  onOpenTerminal,
  onOpenRemote
}: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState('readme');
  const remoteUrl = project.remotes.length > 0 ? project.remotes[0].url : null;
  const remoteProvider = getRemoteProvider(remoteUrl);

  const importanceBadgeVariant = {
    1: 'secondary' as const,
    2: 'secondary' as const,
    3: 'default' as const,
    4: 'destructive' as const,
    5: 'destructive' as const,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={onBack} className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {project.type === 'git' ? (
                  <FolderGit2 className="h-8 w-8 text-primary flex-shrink-0" />
                ) : (
                  <Folder className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                )}
                <h1 className="text-3xl font-bold truncate">{project.name}</h1>
              </div>
              <p className="text-sm text-muted-foreground truncate" title={project.path}>
                {project.path}
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(project)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenIDE(project)}>
              <Code2 className="h-4 w-4 mr-2" />
              Open in IDE
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenTerminal(project)}>
              <Terminal className="h-4 w-4 mr-2" />
              Terminal
            </Button>
            {remoteUrl && (
              <Button variant="outline" size="sm" onClick={() => onOpenRemote(project)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Remote
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => onDelete(project)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metadata Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={importanceBadgeVariant[project.importance]}>
            <Star className="h-3 w-3 mr-1" />
            Importance: {project.importance}/5
          </Badge>
          {remoteProvider && (
            <Badge variant="outline">
              {remoteProvider}
            </Badge>
          )}
          {project.language && (
            <Badge variant="secondary">
              {project.language}
            </Badge>
          )}
          {project.tags.map(tag => (
            <Badge key={tag} variant="secondary">
              <TagIcon className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Main: left sidebar + right content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left sidebar: project + git info */}
            <aside className="w-full lg:w-96 flex-shrink-0">
              <OverviewTab project={project} />
            </aside>

            {/* Right pane: README + Recent Commits tabs */}
            <main className="flex-1">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                <div className="border-b mb-4">
                  <TabsList>
                    <TabsTrigger value="readme">README</TabsTrigger>
                    <TabsTrigger value="commits">Recent Commits</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1">
                  <TabsContent value="readme" className="mt-0">
                    <ReadmeTab project={project} />
                  </TabsContent>

                  <TabsContent value="commits" className="mt-0">
                    <RecentCommitsTab project={project} />
                  </TabsContent>
                </div>
              </Tabs>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

// Recent Commits placeholder tab
function RecentCommitsTab({ project }: { project: Project }) {
  const [commits, setCommits] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadCommits() {
      setLoading(true);
      setError(null);
      const res = await ipcAPI.listRecentCommits(project.id, 20);
      if (!mounted) return;
      setLoading(false);
      if (res.success && res.data) {
        setCommits(res.data.commits || []);
      } else {
        setError(res.error?.message || 'Failed to load commits');
      }
    }
    loadCommits();
    return () => { mounted = false; };
  }, [project.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Commits</CardTitle>
        <CardDescription>Recent activity on this repository</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-muted-foreground">Loading commits…</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && commits.length === 0 && (
          <div className="text-sm text-muted-foreground">No recent commits available.</div>
        )}
        {!loading && !error && commits.length > 0 && (
          <ul className="space-y-3">
            {commits.map((c) => (
              <li key={c.hash} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.message}</div>
                  <div className="font-mono text-xs text-muted-foreground">{c.hash.substring(0,8)}</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{c.authorName} • {new Date(c.date).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Overview Tab Component
function OverviewTab({ project }: { project: Project }) {
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [ftLoading, setFtLoading] = useState(true);
  const [ftError, setFtError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setFtLoading(true);
      setFtError(null);
      const res = await ipcAPI.getFileTree(project.id, 1);
      if (!mounted) return;
      setFtLoading(false);
      if (res.success && res.data) {
        setFileTree(res.data.tree);
      } else {
        setFtError(res.error?.message || 'Failed to load directory structure');
      }
    }
    load();
    return () => { mounted = false; };
  }, [project.id]);

  return (
    <div className="flex flex-col gap-6">
      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Created</span>
            </div>
            <span className="text-sm font-medium">{formatRelativeTime(project.createdAt)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Last Modified</span>
              </div>
              <span className="text-sm font-medium">{formatRelativeTime(project.lastModifiedAt)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              <span>Size</span>
            </div>
            <span className="text-sm font-medium">{formatBytes(project.sizeBytes)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Folder className="h-4 w-4" />
              <span>Files</span>
            </div>
            <span className="text-sm font-medium">{project.fileCount.toLocaleString()}</span>
          </div>
          {project.description && (
            <>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground mb-2">Description</div>
                <p className="text-sm">{project.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

{/* Git Info Card */}
{project.type === 'git' && (
  <Card>
    <CardHeader>
      <CardTitle>Git Information</CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          <span>Branch</span>
        </div>
        <BranchSelector project={project} />
      </div>

      <Separator />

      {project.lastCommitHash && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Last Commit</div>
            <span className="text-sm font-medium font-mono">
              {project.lastCommitHash.substring(0, 8)}
            </span>
          </div>
          <Separator />
        </>
      )}

      {project.remotes.length > 0 && (
        <div>
          <div className="text-sm text-muted-foreground mb-3">Remotes</div>
          <div className="space-y-2">
            {project.remotes.map((remote, idx) => (
              <div key={idx} className="text-sm">
                <div className="font-medium font-mono">{remote.name}</div>
                <div className="text-muted-foreground text-xs break-all">
                  {remote.url}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {project.provider && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Provider</div>
            <Badge variant="outline">{project.provider}</Badge>
          </div>
        </>
      )}
    </CardContent>
  </Card>
)}

        {/* Tags Card */}
        {project.tags && project.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {project.tags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Directory Structure Card */}
        <Card>
          <CardHeader>
            <CardTitle>Directory Structure</CardTitle>
          </CardHeader>
          <CardContent>
            {ftLoading && <div className="text-sm text-muted-foreground">Loading directory structure…</div>}
            {ftError && <div className="text-sm text-destructive">{ftError}</div>}
            {!ftLoading && !ftError && fileTree && (
              <div className="max-h-64 overflow-auto">
                <FileTree tree={fileTree} />
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}

// Files Tab with File Tree
function FilesTab({ project }: { project: Project }) {
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFileTree() {
      setLoading(true);
      setError(null);
      
      const response = await ipcAPI.getFileTree(project.id, 3);
      
      if (response.success && response.data) {
        setFileTree(response.data.tree);
      } else {
        setError(response.error?.message || 'Failed to load file tree');
      }
      
      setLoading(false);
    }

    loadFileTree();
  }, [project.id]);

  const handleFileSelect = (node: FileTreeNode) => {
    console.log('Selected file:', node.path);
    // TODO: Implement file preview or open in editor
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>File Tree</CardTitle>
        <CardDescription>
          Browse the files in this project - {project.path}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {error && (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">Error loading file tree</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        
        {!loading && !error && fileTree && (
          <div className="max-h-[600px] overflow-y-auto">
            <FileTree tree={fileTree} onFileSelect={handleFileSelect} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// README Tab with Markdown Rendering
function ReadmeTab({ project }: { project: Project }) {
  const [mdFiles, setMdFiles] = useState<string[]>([]);
  const [selectedMd, setSelectedMd] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available Markdown files
  useEffect(() => {
    async function loadMdList() {
      const response = await ipcAPI.listMarkdownFiles(project.id);
      if (response.success && response.data) {
        const files = response.data.mdFiles;
        setMdFiles(files);
        if (files.length > 0) {
          // Prefer README.md when available (case-insensitive), otherwise use first file
          const preferred = files.find((f: string) => f.toLowerCase() === 'readme.md') || files[0];
          setSelectedMd(preferred);
        }
      } else {
        setError(response.error?.message || 'Failed to load documentation files');
      }
      setLoading(false);
    }
    loadMdList();
  }, [project.id]);

  // Load selected Markdown content
  useEffect(() => {
    if (!selectedMd) return;
    async function loadMdContent() {
      setLoading(true);
      setError(null);
      const response = await ipcAPI.fetchMarkdown(project.id, selectedMd);
      if (response.success && response.data) {
        setContent(response.data.content);
      } else {
        setError(response.error?.message || 'Failed to load documentation content');
      }
      setLoading(false);
    }
    loadMdContent();
  }, [project.id, selectedMd]);

return (
  <>
    {mdFiles.length > 0 && (
      <div className="mb-4">
        <select
          value={selectedMd}
          onChange={(e) => setSelectedMd(e.target.value)}
          className="px-4 py-2 text-sm rounded-md border bg-background font-mono"
        >
          {mdFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
      </div>
    )}

    <Card>

      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">Error loading README</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && mdFiles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No documentation files found in this project</p>
          </div>
        )}

        {!loading && !error && content && (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </CardContent>
    </Card>
  </>
);
}