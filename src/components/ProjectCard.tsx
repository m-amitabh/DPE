import { FolderGit2, Folder, Github, Gitlab, GitBranch, HardDrive, Calendar, Clock, ExternalLink, Terminal, Code2 } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Project } from "../lib/types";
import { formatBytes, formatRelativeTime, getRemoteProvider } from "../lib/utils-project";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onOpenIDE: (project: Project) => void;
  onOpenTerminal: (project: Project) => void;
  onOpenRemote: (project: Project) => void;
  onDelete: (project: Project) => void;
  isSelected: boolean;
}

export function ProjectCard({
  project,
  onSelect,
  onOpenIDE,
  onOpenTerminal,
  onOpenRemote,
  onDelete,
  isSelected
}: ProjectCardProps) {
  const remoteUrl = project.remotes.length > 0 ? project.remotes[0].url : null;
  const remoteProvider = getRemoteProvider(remoteUrl);
  
  // Only show importance badge if explicitly set to 'High', 'Medium', or 'Low' (string)
  type ImportanceLevel = 'High' | 'Medium' | 'Low';
  const getImportanceBadge = (importance?: ImportanceLevel) => {
    if (importance === 'High') return { variant: "destructive" as const, label: "High" };
    if (importance === 'Medium') return { variant: "default" as const, label: "Medium" };
    if (importance === 'Low') return { variant: "secondary" as const, label: "Low" };
    return null;
  };

  let importance: ImportanceLevel | null = null;
  if (typeof project.importance === 'string' && ["High","Medium","Low"].includes(project.importance)) {
    importance = project.importance as ImportanceLevel;
  } else if (typeof project.importance === 'number' && project.importance > 0) {
    // Map numeric star values to High/Medium/Low explicitly set by user
    if (project.importance >= 4) importance = 'High';
    else if (project.importance === 3) importance = 'Medium';
    else if (project.importance <= 2) importance = 'Low';
  }
  const importanceBadge = getImportanceBadge(importance ?? undefined);

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on action buttons, don't select
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onSelect(project);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md group ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {project.type === "git" ? (
              <FolderGit2 className="h-5 w-5 text-primary flex-shrink-0" />
            ) : (
              <Folder className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
            <h3 className="font-semibold truncate">{project.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            {remoteProvider && (
              <Badge variant="outline" className="gap-1">
                {remoteProvider === 'github' && <Github className="h-3 w-3" />}
                {remoteProvider === 'gitlab' && <Gitlab className="h-3 w-3 text-orange-500" />}
                {remoteProvider === 'bitbucket' && <Code2 className="h-3 w-3 text-blue-500" />}
                {remoteProvider}
              </Badge>
            )}
            {importanceBadge && (
              <Badge 
                variant={importanceBadge.variant}
                title={`Importance: ${importanceBadge.label}`}
              >
                {importanceBadge.label}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        <p className="text-xs text-muted-foreground truncate" title={project.path}>
          {project.path}
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatRelativeTime(project.lastModifiedAt)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">Last Modified</p>
                <p className="text-xs">{new Date(project.lastModifiedAt).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            <span>{formatBytes(project.sizeBytes)}</span>
          </div>
          {project.branch && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="truncate">{project.branch}</span>
            </div>
          )}
        </div>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {project.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <TooltipProvider>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenIDE(project);
                  }}
                >
                  <Code2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in IDE</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTerminal(project);
                  }}
                >
                  <Terminal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open Terminal</TooltipContent>
            </Tooltip>

            {remoteUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenRemote(project);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open Remote</TooltipContent>
              </Tooltip>
            )}

            <div className="flex-1" />
          </div>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
