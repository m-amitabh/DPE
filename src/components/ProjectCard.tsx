import { FolderGit2, Folder, Github, GitBranch, HardDrive, Clock, ExternalLink, Terminal, Code2 } from "lucide-react";
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
  isSelected: boolean;
}

export function ProjectCard({
  project,
  onSelect,
  onOpenIDE,
  onOpenTerminal,
  onOpenRemote,
  isSelected
}: ProjectCardProps) {
  const remoteUrl = project.remotes.length > 0 ? project.remotes[0].url : null;
  const remoteProvider = getRemoteProvider(remoteUrl);
  
  // Map numeric importance (1-5) to badge variant and label
  const getImportanceBadge = (importance: number) => {
    if (importance >= 4) return { variant: "destructive" as const, label: "High" };
    if (importance >= 2) return { variant: "default" as const, label: "Med" };
    return { variant: "secondary" as const, label: "Low" };
  };
  
  const importanceBadge = getImportanceBadge(project.importance);

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
                <Github className="h-3 w-3" />
                {remoteProvider}
              </Badge>
            )}
            <Badge 
              variant={importanceBadge.variant}
              title={`Importance: ${project.importance}/5 (${importanceBadge.label})`}
            >
              {importanceBadge.label}
            </Badge>
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
