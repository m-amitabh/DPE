import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, MoreVertical } from 'lucide-react';
import { ipcAPI } from '../lib/ipc-api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ImportPreviewDialog } from './import-preview-dialog';

interface ScanPathItem {
  path: string;
  includeAsProject?: boolean;
}

interface SettingsProps {
  onClose: () => void;
  onSave: (scanPaths: ScanPathItem[]) => void;
}

export function Settings({ onClose, onSave }: SettingsProps) {
  const [paths, setPaths] = useState<ScanPathItem[]>([{ path: '' }]);
  const [ignoredPatterns, setIgnoredPatterns] = useState<string[]>([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.env',
    '*.log',
  ]);
  const [ideCommand, setIdeCommand] = useState<string>('code {path}');
  const [terminalCommand, setTerminalCommand] = useState<string>('');
  const [theme, setTheme] = useState<'light'|'dark'|'system'>('system');
  const [activeTab, setActiveTab] = useState('paths');

  const addPath = () => setPaths(prev => [...prev, { path: '' }]);
  const updatePath = (index: number, value: string) => setPaths(prev => prev.map((p, i) => i === index ? { ...p, path: value } : p));
  const toggleIncludeAsProject = (index: number) => setPaths(prev => prev.map((p, i) => i === index ? { ...p, includeAsProject: !p.includeAsProject } : p));
  const removePath = (index: number) => setPaths(prev => prev.filter((_, i) => i !== index));
  const browsePath = async (index: number) => {
    try {
      const res = await ipcAPI.selectFolder(paths[index]?.path || undefined);
      if (res.success && res.data?.path) {
        updatePath(index, res.data.path);
      }
    } catch (e) {
      // ignore
    }
  };

  const addPattern = () => setIgnoredPatterns(prev => [...prev, '']);
  const updatePattern = (index: number, value: string) => setIgnoredPatterns(prev => prev.map((p, i) => i === index ? value : p));
  const removePattern = (index: number) => setIgnoredPatterns(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    const validPaths = paths.map(p => ({ path: (p.path || '').trim(), includeAsProject: !!p.includeAsProject })).filter(p => p.path.length > 0);
    if (validPaths.length === 0) {
      alert('Please add at least one scan path');
      return;
    }
    const settings = { scanPaths: validPaths, ignoredPatterns, ideCommand, terminalCommand, uiPrefs: { theme } };
    try {
      await ipcAPI.setSettings(settings);
      toast.success('Settings saved');
      // Only save settings here. Scanning is a separate action.
      onClose();
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const handleSaveAndScan = async () => {
    const validPaths = paths.map(p => ({ path: (p.path || '').trim(), includeAsProject: !!p.includeAsProject })).filter(p => p.path.length > 0);
    if (validPaths.length === 0) {
      alert('Please add at least one scan path');
      return;
    }
    const settings = { scanPaths: validPaths, ignoredPatterns, ideCommand, terminalCommand, uiPrefs: { theme } };
    try {
      await ipcAPI.setSettings(settings);
      toast.success('Settings saved. Starting scan...');
      // Trigger parent-provided scan/start handler
      onSave(validPaths);
      onClose();
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const handleExport = async () => {
    try {
      const res = await ipcAPI.exportProjects();
      if (res.success) toast.success(`Exported to ${res.data?.path}`);
      else toast.error(res.error?.message || 'Export cancelled');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    filePath?: string;
    count?: number;
    sample?: Array<{ id?: string; name?: string; path?: string; provider?: string }>;
  } | null>(null);

  const handleImport = async () => {
    try {
      const res = await ipcAPI.previewImport();
      if (res.success && res.data) {
        setPreviewData({ filePath: res.data.filePath, count: res.data.count, sample: res.data.sample });
        setPreviewOpen(true);
      } else {
        toast.error(res.error?.message || 'Import preview cancelled');
      }
    } catch (err: any) {
      toast.error(err.message || 'Import preview failed');
    }
  };

  const handleConfirmImport = async (mode: 'merge' | 'replace', onConflict: 'overwrite' | 'skip') => {
    setPreviewOpen(false);
    try {
      const res = await ipcAPI.importProjects({ mode, onConflict });
      if (res.success) toast.success(`Imported ${res.data?.count || 0} projects`);
      else toast.error(res.error?.message || 'Import cancelled');
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setPreviewData(null);
    }
  };

  const handleClearCache = async () => {
    // This function is now the confirmed action handler; kept for compatibility but not used directly.
    try {
      const res = await ipcAPI.clearCache();
      if (res.success) {
        toast.success('Project cache reset');
        const validPaths = paths.filter(p => (p.path || '').trim().length > 0);
        if (validPaths.length > 0) onSave(validPaths);
      } else {
        toast.error(res.error?.message || 'Failed to reset cache');
      }
    } catch (err: any) {
      toast.error(err.message || 'Reset cache failed');
    }
  };

  // State for showing confirmation dialog
  const [resetOpen, setResetOpen] = useState(false);
  const requestReset = () => setResetOpen(true);
  const cancelReset = () => setResetOpen(false);
  const confirmReset = async () => {
    setResetOpen(false);
    await handleClearCache();
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await ipcAPI.getSettings();
        if (!mounted) return;
        if (res.success && res.data?.settings) {
          const s = res.data.settings as any;
          if (Array.isArray(s.scanPaths) && s.scanPaths.length > 0) {
            // Support both legacy string[] and new ScanPathItem[]
            const parsed = s.scanPaths.map((p: any) => typeof p === 'string' ? { path: p } : { path: p.path || '', includeAsProject: !!p.includeAsProject });
            setPaths(parsed);
          }
          if (Array.isArray(s.ignoredPatterns)) setIgnoredPatterns(s.ignoredPatterns);
          if (s.ideCommand) setIdeCommand(s.ideCommand);
          if (s.terminalCommand) setTerminalCommand(s.terminalCommand);
          if (s.uiPrefs && s.uiPrefs.theme) setTheme(s.uiPrefs.theme);
        }
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Apply theme immediately when changed in settings dialog
  useEffect(() => {
    const apply = (t: typeof theme) => {
      const root = document.documentElement;
      if (t === 'dark') {
        root.classList.add('dark');
      } else if (t === 'light') {
        root.classList.remove('dark');
      } else {
        // system
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark');
      }
    };

    try { apply(theme); } catch (e) { /* ignore */ }
  }, [theme]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full rounded-none bg-gray-100 dark:bg-gray-700">
              <TabsTrigger value="paths" className="flex-1">Scan Paths</TabsTrigger>
              <TabsTrigger value="patterns" className="flex-1">Ignore Patterns</TabsTrigger>
              <TabsTrigger value="tools" className="flex-1">IDE & Terminal</TabsTrigger>
              <TabsTrigger value="appearance" className="flex-1">Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="paths" className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Scan Paths</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Add directories to scan for projects. The scanner will look for Git repositories and other project indicators.</p>
                <div className="space-y-3">
                  {paths.map((p, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input value={p.path} onChange={(e) => updatePath(index, e.target.value)} placeholder="/Users/yourname/projects" className="flex-1" />
                      <Button variant="outline" size="sm" onClick={() => browsePath(index)}>Browse</Button>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!p.includeAsProject} onChange={() => toggleIncludeAsProject(index)} />
                        <span>Include as project</span>
                      </label>
                      {paths.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removePath(index)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addPath} className="mt-3">+ Add another path</Button>
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ignore Patterns</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Files and directories matching these patterns will be excluded from scans and file tree views. Supports glob patterns.</p>
                <div className="space-y-3">
                  {ignoredPatterns.map((pattern, index) => (
                    <div key={index} className="flex gap-2">
                      <Input value={pattern} onChange={(e) => updatePattern(index, e.target.value)} placeholder="e.g., node_modules, *.log, .env*" className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => removePattern(index)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addPattern} className="mt-3">+ Add pattern</Button>
              </div>
            </TabsContent>

            <TabsContent value="tools" className="p-6 space-y-6">
              <div>
                <Label htmlFor="ide-cmd" className="text-base font-medium mb-2 block">IDE Command</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Command to open projects in your IDE. Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{path}'}</code> as placeholder.</p>
                <Input id="ide-cmd" value={ideCommand} onChange={(e) => setIdeCommand(e.target.value)} placeholder='code {path}' />
              </div>

              <div>
                <Label htmlFor="term-cmd" className="text-base font-medium mb-2 block">Terminal Command</Label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Command to open terminal in project directory. Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{path}'}</code> as placeholder.</p>
                <Input id="term-cmd" value={terminalCommand} onChange={(e) => setTerminalCommand(e.target.value)} placeholder='Auto-detected for your platform' />
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Appearance</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select theme for the application.</p>
                <div className="max-w-sm">
                  <select value={theme} onChange={(e) => setTheme(e.target.value as any)} className="w-full rounded-md border px-3 py-2 bg-white dark:bg-gray-800">
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3">
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="flex flex-col gap-2">
                  <Button variant="ghost" onClick={handleImport}>Import Projects</Button>
                  <Button variant="ghost" onClick={handleExport}>Export Projects</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" onClick={requestReset} title="Removes stored projects and performs a fresh scan">Reset Project Cache</Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Removes stored projects and runs a fresh scan</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" onClick={handleSave}>Save</Button>
            <Button onClick={handleSaveAndScan} className="bg-blue-600 hover:bg-blue-700">Scan Now</Button>
          </div>
        </div>

        {/* Reset confirmation dialog */}
        <AlertDialog open={resetOpen} onOpenChange={(v) => !v && setResetOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Reset Project Cache?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>This will remove all stored projects from the local cache. A fresh scan will run and repopulate the project list.</p>
                <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">⚠️ This cannot be undone.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel onClick={cancelReset}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmReset} className="bg-destructive hover:bg-destructive/90">Reset</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <ImportPreviewDialog open={previewOpen} filePath={previewData?.filePath} count={previewData?.count} sample={previewData?.sample || []} onConfirm={handleConfirmImport} onCancel={() => { setPreviewOpen(false); setPreviewData(null); }} />
    </div>
  );
}
