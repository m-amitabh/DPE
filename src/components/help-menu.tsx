import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { HelpCircle, ChevronRight, Github } from 'lucide-react';

import { Button } from './ui/button';
import { ipcAPI } from '../lib/ipc-api';
// Version is injected at build time from package.json via Vite define
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0';

export function HelpMenu() {
  const [open, setOpen] = useState(false);
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
                <div className="w-full px-4 py-3 flex items-center justify-between text-sm text-muted-foreground select-none cursor-default">
                  <span className="flex items-center gap-2">Version</span>
                  <span className="font-mono text-xs">{APP_VERSION}</span>
                </div>
              </li>
              <li>
                <button
                  className="w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between"
                  onClick={async () => { setOpen(false); await ipcAPI.openRemote('https://github.com/m-amitabh/DPE'); }}
                >
                  <span className="flex items-center gap-2"><Github className="h-4 w-4" />View on GitHub</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            </ul>
          </div>
        </>,
        document.body
      )}

      {/* No additional help pages configured; only GitHub link is shown */}
    </div>
  );
}

export default HelpMenu;
