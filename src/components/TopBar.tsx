import { Search, Settings, RefreshCw, FolderGit2, Github } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { HelpMenu } from './help-menu';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onSettingsClick: () => void;
  remoteUrl?: string | null;
  onOpenRemote?: () => void;
}

export function TopBar({ searchQuery, onSearchChange, onRefresh, onSettingsClick, remoteUrl, onOpenRemote }: TopBarProps) {
  return (
    <div className="border-b bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Project Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-1 max-w-md mx-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HelpMenu />
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {/* GitHub link for current project (if available) */}
          {remoteUrl ? (
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onOpenRemote && onOpenRemote(); }}
              title="Open repository on GitHub"
            >
              <Github className="h-4 w-4" />
            </Button>
          ) : null}
          <Button variant="outline" size="icon" onClick={onSettingsClick}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
