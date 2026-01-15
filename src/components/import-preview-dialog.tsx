import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface SampleItem {
  id?: string;
  name?: string;
  path?: string;
  provider?: string;
}

interface ImportPreviewDialogProps {
  open: boolean;
  filePath?: string;
  count?: number;
  sample?: SampleItem[];
  onConfirm: (mode: 'merge'|'replace', onConflict: 'overwrite'|'skip') => void;
  onCancel: () => void;
}

export function ImportPreviewDialog({ open, filePath, count=0, sample=[], onConfirm, onCancel }: ImportPreviewDialogProps) {
  const [mode, setMode] = React.useState<'merge'|'replace'>('merge');
  const [onConflict, setOnConflict] = React.useState<'overwrite'|'skip'>('overwrite');

  React.useEffect(() => {
    if (open) {
      setMode('merge');
      setOnConflict('overwrite');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preview Import</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">File: <strong>{filePath || '—'}</strong></p>
          <p className="text-sm">Incoming projects: <strong>{count}</strong></p>

          <div className="max-h-48 overflow-auto border rounded p-2 bg-muted">
            {sample.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sample projects available</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sample.map((s, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span className="font-medium">{s.name || s.id || 'Unnamed'}</span>
                    <span className="text-xs text-muted-foreground">{s.provider || ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode==='merge'} onChange={() => setMode('merge')} /> Merge
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode==='replace'} onChange={() => setMode('replace')} /> Replace (overwrite store)
            </label>
          </div>

          {mode === 'merge' && (
            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-2">
                <input type="radio" checked={onConflict==='overwrite'} onChange={() => setOnConflict('overwrite')} /> Overwrite existing on ID conflict
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={onConflict==='skip'} onChange={() => setOnConflict('skip')} /> Skip duplicates
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onConfirm(mode, onConflict)}>Import</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
