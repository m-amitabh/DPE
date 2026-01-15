import { useEffect, useState, useCallback } from 'react';
import { ipcAPI } from './lib/ipc-api';
import { Settings } from './components/Settings';
import { FilterBar, FilterState, ViewMode } from './components/FilterBar';
import { TopBar } from './components/TopBar';
import { ProjectCard } from './components/ProjectCard';
import { ProjectListItem } from './components/project-list-item';
import { ProjectDetailPage } from './components/ProjectDetailPage';
import { EditProjectDialog } from './components/edit-project-dialog';
import { DeleteConfirmationDialog } from './components/delete-confirmation-dialog';
import { Project } from './lib/types';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

import React from 'react';
function App(): React.ReactElement {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ discovered: 0, processed: 0 });
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // M2: Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    provider: 'all',
    tags: [],
    importance: null,
    dateRange: null,
  });
  const [sortBy, setSortBy] = useState<string>('lastModifiedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // Fixed page size for now
  const [allTags, setAllTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  // Safely compute first remote URL for the currently viewed project
  const viewingRemoteUrl: string | undefined = viewingProject?.remotes?.[0]?.url;

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load projects whenever search/filter/sort/pagination changes
  useEffect(() => {
    loadProjects();
  }, [debouncedSearchQuery, filters, sortBy, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    // Listen to scan progress
    const unsubProgress = ipcAPI.onScanProgress((data) => {
      setScanProgress({ discovered: data.discovered, processed: data.processed });
    });

    // Listen to project updates
    const unsubUpdated = ipcAPI.onProjectUpdated(() => {
      loadProjects();
    });

    // Listen to project deletions
    const unsubDeleted = ipcAPI.onProjectDeleted(() => {
      loadProjects();
    });

    // Listen to projects imported (external import)
    const unsubImported = ipcAPI.onProjectsImported(() => {
      loadProjects();
    });

    // Listen to cache cleared
    const unsubCacheCleared = ipcAPI.onCacheCleared(() => {
      loadProjects();
    });

    // On app startup, touch all projects to update lastModifiedAt
    (async () => {
      try {
        await ipcAPI.refreshProjectsModifiedFromFs();
        // After refreshing from fs, reload projects to show updated timestamps
        await loadProjects();
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      unsubProgress();
      unsubUpdated();
      unsubDeleted();
      unsubImported();
      unsubCacheCleared();
    };
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    
    // Build filter params
    const filterParams: any = {};
    if (filters.type !== 'all') filterParams.type = filters.type;
    if (filters.provider !== 'all') filterParams.provider = filters.provider;
    if (filters.tags.length > 0) filterParams.tags = filters.tags;
    if (filters.importance) filterParams.importance = filters.importance;

    // Build sort param
    const sortParam = sortOrder === 'desc' ? `-${sortBy}` : sortBy;

    const response = await ipcAPI.listProjects({
      query: debouncedSearchQuery || undefined,
      filters: Object.keys(filterParams).length > 0 ? filterParams : undefined,
      sort: sortParam,
      page: currentPage,
      pageSize: pageSize,
    });
    
    if (response.success && response.data) {
      // Remove duplicate projects (same path) that may appear from imports or scans
      const rawProjects = response.data.projects || [];
      const seen = new Set<string>();
      const uniqueProjects = rawProjects.filter((p) => {
        const key = p.path || p.id || p.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueProjects.length !== rawProjects.length) {
        // Log duplicates for debugging; keep behavior non-intrusive for users
        // eslint-disable-next-line no-console
        console.warn(
          `Removed ${rawProjects.length - uniqueProjects.length} duplicate project(s) by path from listProjects response.`
        );
      }

      setProjects(uniqueProjects);
      // Adjust total to reflect unique entries shown in the UI
      setTotalProjects(uniqueProjects.length);
      
      // Extract unique tags from all projects
      const tags = new Set<string>();
      uniqueProjects.forEach(p => p.tags?.forEach(t => tags.add(t)));
      setAllTags(Array.from(tags).sort());
    } else {
      setError(response.error?.message || 'Failed to load projects');
    }
    
    setLoading(false);
  }, [debouncedSearchQuery, filters, sortBy, sortOrder, currentPage, pageSize]);

  const handleStartScan = async (scanPaths: Array<string | { path: string; includeAsProject?: boolean }>) => {
    setScanning(true);
    setError('');
    setScanProgress({ discovered: 0, processed: 0 });

    const response = await ipcAPI.startScan(scanPaths);
    
    if (response.success && response.data) {
      setCurrentJobId(response.data.jobId);
      
      // Poll for scan completion
      const checkInterval = setInterval(async () => {
        if (!response.data?.jobId) return;
        
        const status = await ipcAPI.getScanStatus(response.data.jobId);
        
        if (status.success && status.data) {
          if (status.data.status === 'complete') {
            clearInterval(checkInterval);
            setScanning(false);
            setCurrentJobId(null);
              try {
                await ipcAPI.refreshProjectsModifiedFromFs();
              } catch {}
              await loadProjects();
          } else if (status.data.status === 'error') {
            clearInterval(checkInterval);
            setScanning(false);
            setCurrentJobId(null);
            setError('Scan failed');
          }
        }
      }, 1000);
    } else {
      setScanning(false);
      setError(response.error?.message || 'Failed to start scan');
    }
  };

  const handleCancelScan = async () => {
    if (currentJobId) {
      await ipcAPI.cancelScan(currentJobId);
      setScanning(false);
      setCurrentJobId(null);
    }
  };

  const handleOpenIDE = async (project: Project) => {
    try {
      const response = await ipcAPI.openIDE(project.path);
      if (response.success) {
        toast.success(`Opened ${project.name} in VS Code`);
      } else {
        toast.error(response.error?.message || 'Failed to open IDE');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open IDE');
    }
  };

  const handleOpenTerminal = async (project: Project) => {
    try {
      const response = await ipcAPI.openTerminal(project.path);
      if (response.success) {
        toast.success(`Opened terminal for ${project.name}`);
      } else {
        toast.error(response.error?.message || 'Failed to open terminal');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open terminal');
    }
  };

  const handleOpenRemote = async (project: Project) => {
    try {
      const remoteUrl = project.remotes.length > 0 ? project.remotes[0].url : null;
      if (!remoteUrl) {
        toast.error('No remote repository configured');
        return;
      }
      
      const response = await ipcAPI.openRemote(remoteUrl);
      if (response.success) {
        toast.success('Opening repository in browser...');
      } else {
        toast.error(response.error?.message || 'Failed to open remote');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open remote');
    }
  };

  const handleRefresh = () => {
    setSearchQuery('');
    setFilters({
      type: 'all',
      provider: 'all',
      tags: [],
      importance: null,
      dateRange: null,
    });
    setSortBy('lastModifiedAt');
    setSortOrder('desc');
    setCurrentPage(1);
    loadProjects();
  };

  const handleViewProject = (project: Project) => {
    setViewingProject(project);
  };

  const handleBackFromDetail = () => {
    setViewingProject(null);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
  };

  const handleSaveProject = async (projectId: string, updates: Partial<Project>) => {
    // Optimistic update - update UI immediately
    const updatedProject = { ...editingProject!, ...updates };
    
    if (viewingProject?.id === projectId) {
      setViewingProject(updatedProject);
    }
    
    setProjects(prev => 
      prev.map(p => p.id === projectId ? { ...p, ...updates } : p)
    );

    try {
      const response = await ipcAPI.updateProject(projectId, updates);
      
      if (response.success) {
        toast.success('Project updated successfully');
        // Refresh to get latest data from backend
        await loadProjects();
      } else {
        throw new Error(response.error?.message || 'Failed to update project');
      }
    } catch (err: any) {
      // Rollback on error
      toast.error(err.message || 'Failed to update project');
      await loadProjects(); // Reload to restore correct state
      throw err;
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;

    const projectId = deletingProject.id;
    const projectName = deletingProject.name;

    setIsDeletingLoading(true);
    try {
      const response = await ipcAPI.deleteProject(projectId);
      
      if (response.success) {
        // Remove from UI
        setProjects(prev => prev.filter(p => p.id !== projectId));
        
        // Close detail view if it was open
        if (viewingProject?.id === projectId) {
          setViewingProject(null);
        }

        toast.success(`Deleted project "${projectName}"`);
        setDeletingProject(null);
        
        // Reload projects to ensure consistency
        await loadProjects();
      } else {
        throw new Error(response.error?.message || 'Failed to delete project');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleDeleteClick = (project: Project) => {
    setDeletingProject(project);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Show detail page if project selected */}
      {viewingProject ? (
        <ProjectDetailPage
          project={viewingProject}
          onBack={handleBackFromDetail}
          onEdit={handleEditProject}
          onDelete={handleDeleteClick}
          onOpenIDE={handleOpenIDE}
          onOpenTerminal={handleOpenTerminal}
          onOpenRemote={handleOpenRemote}
        />
      ) : (
        <>
          {/* Top Bar */}
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={handleRefresh}
            onSettingsClick={() => setShowSettings(true)}
            remoteUrl={viewingRemoteUrl}
            onOpenRemote={() => viewingProject && handleOpenRemote(viewingProject)}
          />

          {/* Filter Bar */}
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            projectTags={allTags}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
              setSortBy(field);
              setSortOrder(order);
              setCurrentPage(1);
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalProjects={totalProjects}
          />

          {/* Main Content */}
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Scan Progress */}
              {scanning && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Scanning Projects...
                    </h3>
                    <button
                      onClick={handleCancelScan}
                      className="text-sm text-blue-700 hover:text-blue-800 dark:text-blue-300"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-blue-800 dark:text-blue-200">
                      <span>Discovered: {scanProgress.discovered}</span>
                      <span>Processed: {scanProgress.processed}</span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: scanProgress.discovered > 0
                            ? `${(scanProgress.processed / scanProgress.discovered) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && !scanning && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading projects...</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive mb-6">
                  {error}
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && projects.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No projects found. Click Settings to add scan paths and start scanning.
                  </p>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
                  >
                    Configure & Scan
                  </button>
                </div>
              )}

              {/* Projects Grid or List */}
              {!loading && projects.length > 0 && (
                <>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {(projects as Project[]).map((project: Project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onSelect={handleViewProject}
                          onOpenIDE={handleOpenIDE}
                          onOpenTerminal={handleOpenTerminal}
                          onOpenRemote={handleOpenRemote}
                          onDelete={handleDeleteProject}
                           isSelected={Boolean(viewingProject && (viewingProject as Project).id === project.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y rounded-lg border mb-6 bg-white dark:bg-gray-900">
                        {(projects as Project[]).map((project: Project) => (
                        <ProjectListItem
                          key={project.id}
                          project={project}
                          onSelect={handleViewProject}
                          onOpenIDE={handleOpenIDE}
                          onOpenTerminal={handleOpenTerminal}
                          onOpenRemote={handleOpenRemote}
                          onDelete={handleDeleteProject}
                           isSelected={Boolean(viewingProject && (viewingProject as Project).id === project.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalProjects > pageSize && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalProjects)} of {totalProjects} projects
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 border border-input rounded-lg bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, Math.ceil(totalProjects / pageSize)) }, (_, i) => {
                            const totalPages = Math.ceil(totalProjects / pageSize);
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-2 rounded-lg ${
                                  currentPage === pageNum
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background text-foreground border border-input hover:bg-accent hover:text-accent-foreground'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalProjects / pageSize), p + 1))}
                          disabled={currentPage >= Math.ceil(totalProjects / pageSize)}
                          className="px-4 py-2 border border-input rounded-lg bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onSave={handleStartScan}
        />
      )}

      {/* Edit Project Dialog */}
      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          open={!!editingProject}
          onOpenChange={(open) => !open && setEditingProject(null)}
          onSave={handleSaveProject}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!deletingProject}
        project={deletingProject}
        loading={isDeletingLoading}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeletingProject(null)}
      />

      {/* Toast Container */}
      <Toaster />
    </div>
  );
}

export default App;
