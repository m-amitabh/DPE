import { Filter, LayoutGrid, List } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

export interface FilterState {
  type: 'all' | 'git' | 'local';
  provider: 'all' | 'github' | 'gitlab' | 'bitbucket' | 'other';
  tags: string[];
  importance: number | null;
  dateRange: {
    field: 'createdAt' | 'lastModifiedAt';
    from: string | null;
    to: string | null;
  } | null;
}

export type ViewMode = "grid" | "list";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  projectTags: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sort: string, order: 'asc' | 'desc') => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalProjects?: number;
}

export function FilterBar({ 
  filters,
  onFiltersChange,
  projectTags,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange
  , totalProjects = 0
}: FilterBarProps) {
  
  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const activeFilterCount = [
    filters.type !== 'all' ? 1 : 0,
    filters.provider !== 'all' ? 1 : 0,
    filters.tags.length,
    filters.importance ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  const handleSortChange = (value: string) => {
    if (value.startsWith('-')) {
      onSortChange(value.substring(1), 'desc');
    } else {
      onSortChange(value, 'asc');
    }
  };

  const sortValue = sortOrder === 'desc' ? `-${sortBy}` : sortBy;

  return (
    <div className="border-b bg-muted/30 px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sort by:</span>
          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-lastModifiedAt">Last Modified</SelectItem>
              <SelectItem value="-createdAt">Created Date</SelectItem>
              <SelectItem value="-importance">Importance</SelectItem>
              <SelectItem value="-sizeBytes">Disk Usage</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="-name">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-4 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Project Type</h4>
                <Select 
                  value={filters.type} 
                  onValueChange={(value) => onFiltersChange({ ...filters, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="git">Git Only</SelectItem>
                    <SelectItem value="local">Local Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="font-medium mb-2">Git Provider</h4>
                <Select 
                  value={filters.provider} 
                  onValueChange={(value) => onFiltersChange({ ...filters, provider: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="gitlab">GitLab</SelectItem>
                    <SelectItem value="bitbucket">Bitbucket</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="font-medium mb-2">Importance</h4>
                <Select 
                  value={filters.importance?.toString() || 'all'}
                  onValueChange={(value) => onFiltersChange({ ...filters, importance: value === 'all' ? null : parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="5">⭐⭐⭐⭐⭐ (5)</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐ (4)</SelectItem>
                    <SelectItem value="3">⭐⭐⭐ (3)</SelectItem>
                    <SelectItem value="2">⭐⭐ (2)</SelectItem>
                    <SelectItem value="1">⭐ (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {projectTags.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="space-y-2">
                    {projectTags.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={filters.tags.includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                        />
                        <Label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">{totalProjects} projects</div>

        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
