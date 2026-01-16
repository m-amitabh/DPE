import { Project } from '../lib/types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Github, Clock, ExternalLink, Terminal, Code2 } from 'lucide-react';

interface ProjectListItemProps {
  project: Project;
  onSelect: (project: Project) => void;
  onOpenIDE: (project: Project) => void;
  onOpenTerminal: (project: Project) => void;
  onOpenRemote: (project: Project) => void;
  isSelected: boolean;
}

export function ProjectListItem({
  project,
  onSelect,
  onOpenIDE,
  onOpenTerminal,
  onOpenRemote,
  isSelected
}: ProjectListItemProps) {
  const remoteUrl = project.remotes.length > 0 ? project.remotes[0].url : null;
  const importanceBadge = project.importance >= 4 ? { variant: 'destructive', label: 'High' } : project.importance >= 2 ? { variant: 'default', label: 'Med' } : { variant: 'secondary', label: 'Low' };

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
          <Badge variant={importanceBadge.variant as any}>{importanceBadge.label}</Badge>
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
// formatBytes function is already defined elsewhere
