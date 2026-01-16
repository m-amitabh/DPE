import { useEffect, useState, useRef } from 'react';
import { ipcAPI } from '../lib/ipc-api';
import { Button } from './ui/button';
import { Loader2, ChevronDown, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '../lib/types';

interface BranchSelectorProps {
  project: Project;
}

export function BranchSelector({ project }: BranchSelectorProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>(project.branch || '');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const res = await ipcAPI.listBranches(project.id);
      if (!mounted) return;
      setLoading(false);
      if (res.success && res.data) {
        setBranches(res.data.branches || []);
        if (!selected && res.data.branches && res.data.branches.length > 0) {
          setSelected(res.data.branches[0]);
        }
      } else {
        toast.error(res.error?.message || 'Failed to list branches');
      }
    }
    load();
    return () => { mounted = false; };
  }, [project.id]);

  // Close menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const checkout = async (newBranch: string) => {
    setLoading(true);
    const res = await ipcAPI.checkoutBranch(project.id, newBranch);
    setLoading(false);
    if (res.success) {
      setSelected(newBranch);
      toast.success(`Checked out ${newBranch}`);
      setOpen(false);
    } else if (res.error?.message?.includes('uncommitted changes')) {
      // TODO: Backend should return structured error codes for more reliable error handling
      // Currently checking error message content which is fragile
      // Prompt user to force checkout (not ideal but simple)
      const confirmMsg = 'There are uncommitted changes. Stash changes and checkout?';
      const doForce = window.confirm(confirmMsg);
      if (doForce) {
        await checkout(newBranch);
      }
    } else {
      toast.error(res.error?.message || 'Failed to checkout branch');
    }
  };

  if (loading && branches.length === 0) {
    return <div className="text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin inline-block mr-2"/>Loading</div>;
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
        <span className="font-mono">{selected || 'branch'}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border bg-card shadow-lg z-50">
          <ul className="max-h-60 overflow-auto">
            {branches.map(b => (
              <li key={b}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2"
                  onClick={() => checkout(b)}
                >
                  {selected === b ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                  <span className="font-mono truncate">{b}</span>
                </button>
              </li>
            ))}
            <li>
              <div className="border-t px-2 py-2">
                <button
                  className="w-full text-left px-2 py-1 rounded-md hover:bg-accent flex items-center gap-2"
                  onClick={() => {
                    const name = window.prompt('Create new branch name');
                    if (name) {
                      // create branch locally
                      (async () => {
                        setLoading(true);
                        try {
                          await ipcAPI.checkoutBranch(project.id, name);
                          // refresh branches
                          const res = await ipcAPI.listBranches(project.id);
                          if (res.success && res.data) setBranches(res.data.branches || []);
                          setSelected(name);
                          toast.success(`Created and checked out ${name}`);
                          setOpen(false);
                        } catch (e) {
                          toast.error('Failed to create branch');
                        } finally { setLoading(false); }
                      })();
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Create branch</span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default BranchSelector;
