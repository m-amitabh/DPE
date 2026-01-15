import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HelpCircle, ChevronRight, Github } from 'lucide-react';
import { Button } from './ui/button';
import { ipcAPI } from '../lib/ipc-api';

const HELP_ITEMS = [
  'Help Center',
  'Support Forum',
  'YouTube videos',
  'Release notes',
  'Legal summary',
  'Ask the community',
  'Contact support',
  'Report abuse',
  'Change keyboard layout...',
  'Change language...'
];

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" size="icon" onClick={() => setOpen(o => !o)} aria-label="Help">
        <HelpCircle className="h-5 w-5" />
      </Button>

      {open && ReactDOM.createPortal(
        <>
          {/* Backdrop to block clicks to underlying page when menu is open */}
          <div
            className="fixed inset-0 z-40 bg-transparent pointer-events-auto"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div className="fixed right-6 top-[56px] w-64 rounded-lg bg-popover border shadow-lg z-50">
            <ul className="divide-y">
              <li>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between"
                  onClick={async () => { setOpen(false); await ipcAPI.openRemote('https://github.com/m-amitabh/DPE'); }}
                >
                  <span className="flex items-center gap-2"><Github className="h-4 w-4" />View on GitHub</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
              {HELP_ITEMS.map(item => (
                <li key={item}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between"
                    onClick={() => { setPage(item); setOpen(false); }}
                  >
                    <span>{item}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body
      )}

      {/* Modal for pages */}
      {page && ReactDOM.createPortal(
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={() => setPage(null)} />
          <div className="relative bg-card rounded-lg w-[720px] max-w-full p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{page}</h2>
              <Button variant="ghost" size="icon" onClick={() => setPage(null)}>✕</Button>
            </div>
            <div className="text-sm text-muted-foreground">
              This page is coming soon. We will add detailed content for "{page}" here.
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default HelpMenu;
