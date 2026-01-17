import { Project } from '../lib/types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Github, GitBranch, HardDrive, Calendar, Clock, ExternalLink, Terminal, Code2 } from 'lucide-react';

interface ProjectListItemProps {
  project: Project;
  onSelect: (project: Project) => void;
  onOpenIDE: (project: Project) => void;
  onOpenTerminal: (project: Project) => void;
  onOpenRemote: (project: Project) => void;
  onDelete: (project: Project) => void;
  isSelected: boolean;
}

export function ProjectListItem({
  project,
  onSelect,
  onOpenIDE,
  onOpenTerminal,
  onOpenRemote,
  onDelete,
  isSelected
}: ProjectListItemProps) {
  const remoteUrl = project.remotes.length > 0 ? project.remotes[0].url : null;

  // Determine explicit importance only if set (numeric > 0) or string (backcompat)
  type ImportanceLevel = 'High' | 'Medium' | 'Low';
  let importance: ImportanceLevel | null = null;
  if (typeof (project as any).importance === 'string' && ["High","Medium","Low"].includes((project as any).importance)) {
    importance = (project as any).importance as ImportanceLevel;
  } else if (typeof (project as any).importance === 'number' && (project as any).importance > 0) {
    const imp = (project as any).importance as number;
    if (imp >= 4) importance = 'High';
    else if (imp === 3) importance = 'Medium';
    else importance = 'Low';
  }

  const importanceBadge = importance === 'High' ? { variant: 'destructive', label: 'High' } : importance === 'Medium' ? { variant: 'default', label: 'Medium' } : importance === 'Low' ? { variant: 'secondary', label: 'Low' } : null;

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 border-b last:border-b-0 bg-white dark:bg-gray-900 hover:bg-accent transition cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect(project)}
    >
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-10">
        <span className="text-primary"><Code2 className="h-6 w-6" /></span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate text-lg">{project.name}</span>
          {remoteUrl && <Badge variant="outline" className="gap-1"><Github className="h-3 w-3" />github</Badge>}
          {importanceBadge && <Badge variant={importanceBadge.variant as any}>{importanceBadge.label}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Last modified: {formatRelativeTime(project.lastModifiedAt)}</span>
        </div>
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {project.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 items-center ml-2">
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onOpenIDE(project); }}><Code2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onOpenTerminal(project); }}><Terminal className="h-4 w-4" /></Button>
        {remoteUrl && <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onOpenRemote(project); }}><ExternalLink className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}

// Helpers (reuse from utils-project or define here if not imported)
function formatRelativeTime(date: string | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff/86400)}d ago`;
  const months = Math.floor(diff / 2592000);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}
function formatBytes(bytes: number | undefined) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes/1024/1024).toFixed(2)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
}
