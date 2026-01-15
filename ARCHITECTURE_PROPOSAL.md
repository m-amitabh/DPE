# Desktop Project Explorer — Architecture Proposal

## Sources
- `FEATURES.md`
- `Figma_Code/Software Project Explorer/FEATURES.md`
- Screenshots in `ss/`

---

## Goal
A desktop-first Project Explorer that scans local folders, detects projects (Git/non-Git), displays them in grid/list modes, provides detailed project panels (Overview/Files/README), supports advanced filtering/search/sorting, quick actions (open in IDE, terminal), and local persistence with a responsive, accessible UI.

## High-level Layers
- Shell: Electron with Vite + React renderer.
- Main (native) process: filesystem scanning, JSON store access, git CLI calls, worker management, IPC endpoints.
- Renderer (UI): existing Vite + React app (files under `src/`), rendering, markdown/mermaid.
- Background Workers: scanner/indexer for long-running tasks; emit incremental diffs via IPC.
- Persistence/Index: JSON-backed store (primary) for projects, with `electron-store` or separate JSON for settings and small caches.

## Core Components
- Scanner: incremental folder walker respecting ignore patterns and depth limits.
- Git Adapter: shell `git` invocations (via `execa`) for branch/commit/status; cache results.
- JSON Store: a small, robust helper that loads `projects.json` into memory, exposes read/update operations, and persists using atomic write+rename with backup and debounced writes.
- IPC API: typed endpoints for project queries, scans, actions (open IDE/terminal), and updates. All writes to the JSON store should be routed through the Main process to avoid concurrency races.
- UI Layer: React components (use `react-window` for virtualization), state via `zustand`, data fetching via `react-query`.

## Example Data Model

### Project Schema
```typescript
interface Project {
  id: string;  // UUID v4
  name: string;
  path: string;  // Absolute, normalized path
  type: 'git' | 'local';
  tags: string[];
  importance: 1 | 2 | 3 | 4 | 5;  // 1=lowest, 5=highest
  sizeBytes: number;
  createdAt: string;  // ISO 8601
  lastUsedAt: string;  // ISO 8601, updated when opened in IDE/terminal
  fileCount: number;
  
  // Git-specific fields (null if type='local')
  provider: 'github' | 'gitlab' | 'bitbucket' | 'other' | null;
  lastCommitHash: string | null;
  branch: string | null;
  remotes: Array<{
    name: string;  // e.g., 'origin'
    url: string;
    provider?: 'github' | 'gitlab' | 'bitbucket';
    owner?: string;  // Parsed from URL
    repo?: string;   // Parsed from URL
  }>;
  
  // Additional metadata
  readmeFiles: string[];  // Relative paths within project
  description?: string;  // From git provider API or user-entered
  language?: string;  // Primary language detected
  
  // Scan tracking
  scanStatus: 'complete' | 'pending' | 'scanning' | 'error' | 'user-modified';  // User edits marked to avoid overwrites
  lastScannedAt: string | null;  // ISO 8601
  scanErrors?: string[];  // Error messages from last scan
  
  // Git provider API enrichment (optional)
  stars?: number;
  openIssues?: number;
  lastPushedAt?: string;  // ISO 8601 from provider API
}
```

**lastUsedAt Tracking**: Updated when:
- Project opened in IDE via quick action
- Project opened in terminal
- Project detail page viewed for >10 seconds
Debounced writes to avoid storm (max 1 update per project per 30 minutes).

### FileEntry (Not Persisted in JSON for v1)
**File tree generation**: On-demand only when user opens project detail view. Live filesystem scan when detail view is opened; not cached.

**Not triggered by**:
- App startup
- Background scans
- Automatic refresh

**Only triggered by**: User explicitly viewing Files tab in project detail page.

Future versions may cache in separate `.files.json` per project if needed.

### Settings Schema
```typescript
interface Settings {
  scanPaths: string[];  // Absolute paths to scan
  ignoredPatterns: string[];  // Glob patterns (default: node_modules, .git, dist, build)
  maxDepth: number;  // Default: 5
  minSizeBytes: number;  // Skip folders smaller than this (default: 0)
  
  // Scan scheduling
  autoScan: boolean;  // Enable automatic background scans (default: false)
  scanFrequency: 'manual' | 'daily' | 'weekly' | 'on-startup';  // Default: 'manual'
  lastAutoScanAt: string | null;  // ISO 8601
  
  defaultIDE: { command: string; args: string[] };  // e.g., { command: '/usr/local/bin/code', args: ['.'] }
  defaultTerminal: { command: string; args: string[] };
  
  uiPrefs: {
    theme: 'light' | 'dark' | 'system';
    viewMode: 'grid' | 'list';
    sortBy: 'name' | 'lastUsedAt' | 'createdAt';
    sortOrder: 'asc' | 'desc';
  };
  
  gitProviders: {
    github?: { enabled: boolean; token: string /* encrypted */; lastSync?: string };
    gitlab?: { enabled: boolean; baseUrl: string; token: string /* encrypted */ };
  };
}
```

### Storage Layout (JSON)
```json
{
  "meta": {
    "version": 1,
    "lastScanAt": "2026-01-14T10:30:00Z",
    "projectCount": 42
  },
  "projects": [
    { /* Project object */ },
    { /* Project object */ }
  ]
}
```

**In-Memory Indexing**: On load, build Fuse.js index over `name`, `path`, `tags`, and `description`.

## IPC / API Surface (Main ↔ Renderer)

### Protocol Specification
**Request Format**:
```typescript
{ method: string, params: any, requestId: string }
```

**Response Format**:
```typescript
{
  success: boolean,
  data?: any,
  error?: {
    code: string,  // 'NOT_FOUND' | 'PERMISSION_DENIED' | 'INVALID_INPUT' | 'TIMEOUT' | 'INTERNAL_ERROR'
    message: string,
    details?: any
  },
  requestId: string
}
```

**API Version**: Include `apiVersion: 1` in handshake; check compatibility on startup.

### Endpoints
- `scan/start(paths[])` → `{ jobId: string }` — start scan job (async)
- `scan/status(jobId)` → `{ progress: number, status: 'running'|'complete'|'error', errors?: string[] }` — job progress
- `scan/cancel(jobId)` → `{ cancelled: boolean }` — cancel running scan
- `project/list({filters, sort, page, pageSize})` → `{ projects: Project[], total: number, page: number }` — paginated projects (Main filters in-memory)
- `project/get(id)` → `{ project: Project }` — full project details (error if not found)
- `project/update(id, partial)` → `{ project: Project }` — edit metadata (Main applies update and persists JSON)
- `project/delete(id)` → `{ deleted: boolean }` — remove project (Main persists)
- `readme/list(projectId)` → `{ files: string[] }` — list markdown files
- `readme/fetch(projectId, filePath)` → `{ content: string, path: string }` — fetch raw markdown
- `git/info(path)` → `{ branch, lastCommit, remotes[], status }` — branch/lastCommit/remote
- `open/ide(path, options)` → `{ launched: boolean }` — launch IDE
- `open/terminal(path, options)` → `{ launched: boolean }` — launch terminal

**Bi-directional Events** (Main → Renderer):
- `scan:progress` — incremental scan updates `{ jobId, discovered: number, processed: number }`
- `project:updated` — project metadata changed `{ projectId, changes }`
- `project:deleted` — project removed `{ projectId }`

**Timeout Handling**: All IPC requests time out after 30 seconds; renderer retries with exponential backoff.

**Typed Wrapper**: Implement `src/lib/ipc-api.ts` with full TypeScript types for compile-time safety. Main handlers in `electron/ipc-handlers.ts` use the same types.

**Concurrency**: Main queues write operations (update/delete); reads are concurrent. Scanner emits events throttled to 100ms intervals.

## Concurrency & Locking Model
**Single-Writer Principle**: Main process is the sole authority for `projects.json` writes.

**Write Queue**: Main maintains an in-memory write queue:
```typescript
class WriteQueue {
  private pending: Array<{ op: 'update'|'delete', projectId, data, resolve, reject }>;
  private processing: boolean;
  
  async enqueue(op) { /* add to queue, process sequentially */ }
  private async flush() { /* batch writes, debounce 500ms */ }
}
```

**Conflict Resolution**:
- Scanner updates and user edits: User edits always win; set `scanStatus: 'user-modified'` flag to skip overwriting.
- Multiple renderer windows: Main broadcasts `project:updated` events; other windows refetch via `react-query` invalidation.
- Re-scan during editing: Scanner checks `scanStatus` before overwriting; prompts user if conflicts detected.

**Lock-Free Reads**: Multiple renderers can read concurrently; reads use in-memory cached data (no file I/O).

**Race Prevention**: IPC requests include `requestId`; Main tracks in-flight operations and rejects duplicates.

## State Management
- UI state with `zustand` (view mode, filters, selection)
- Server-backed data with `react-query` for caching and background refetch
- In-memory dataset loaded from `projects.json` on startup; updates are made in memory and written to disk atomically with a debounced writer.
- Optimistic updates for quick metadata edits; rollback on IPC error response; `react-query` handles cache invalidation.

## Search & Filtering
**Index Strategy**:
- Use `Fuse.js` as an in-memory fuzzy/full-text index for `name`, `path`, `tags`, and `readme` snippets (first 500 chars).
- **Index Rebuild**: Full rebuild on startup (blocking, <100ms for 1000 projects) and after complete re-scans.
- **Incremental Updates**: Add/update/remove individual projects in index without full rebuild (O(1) per operation).
- **Rebuild Triggers**: Startup, manual re-scan complete, or when `projects.json` is externally modified.

**Performance Targets**:
- Search query latency: <50ms for 1000 projects, <200ms for 5000 projects
- Index memory overhead: ~5MB per 1000 projects
- Index rebuild: non-blocking; renderer shows "indexing..." indicator

**Filtering and Sorting**:
- Execute on Main process over in-memory dataset
- Return paginated results (default 50 per page)
- Support filters: type, provider, tags, importance, date ranges
- Sort keys: name, lastUsedAt, createdAt, sizeBytes, importance

**UI Pagination**: Renderer requests pages of 50-100 items; uses `react-window` for virtualization of visible items only.

## Error Handling & Resilience

### JSON Store Recovery
1. On load, parse `projects.json`; if corrupt:
   - Load `projects.json.bak` (previous version)
   - If both corrupt, show recovery UI: "Import backup or start fresh"
2. Schema validation: check `meta.version`; run migration if mismatch
3. Validation errors: log to `app.log`; show non-blocking notification

### Git Command Failures
- **Git not installed**: Detect on startup via `which git`; show setup prompt
- **Command timeout**: 10s timeout per `git` call; mark project as `gitStatus: 'timeout'`
- **Permission errors**: Catch and mark `gitStatus: 'permission-denied'`; show in UI
- **Invalid repo**: Mark as `type: 'local'` if git commands fail

### IPC Failures
- **Timeout**: 30s per request; show "Request timed out, retry?" UI
- **Main crash**: Renderer detects via ping; shows "Reconnecting..." modal; auto-restarts Main
- **Malformed requests**: Validate in typed wrapper; reject before sending to Main

### Scanner Errors
- **Permission denied**: Skip folder; log to scan results; continue
- **Disk I/O errors**: Retry 3x with backoff; mark folder as failed; notify user
- **Out of memory**: Limit concurrent file reads to 100; process in batches

### Graceful Degradation
- README rendering fails → show "Unable to render, view raw" fallback
- Search index unavailable → fall back to simple string matching
- Git info unavailable → show basic file info only

### Logging
- Use `electron-log`; write to `app.getPath('logs')/main.log` and `renderer.log`
- Log levels: ERROR (always), WARN (default), INFO (verbose mode), DEBUG (dev only)
- Include: timestamp, requestId, operation, duration, error stack
- Expose "Export logs" in Settings for bug reports

## Scanning & Git Integration
**Scanner Architecture**:
- Runs as background worker process (spawned by Main via `child_process.fork`) to avoid blocking UI
- Communicates via structured messages: `{ type: 'progress'|'found'|'error'|'complete', data }`
- Respects `ignoredPatterns` (`.gitignore` + user-defined), `maxDepth` (default: 5), minimum size filters

**Scan Scheduling**:
- **Default**: Manual only (user clicks "Scan" button in UI)
- **Optional**: User enables auto-scan in Settings with frequency:
  - `manual`: Never auto-scan (default)
  - `daily`: Once per day (configurable time, default: 3 AM local)
  - `weekly`: Once per week (configurable day/time)
  - `on-startup`: Every app launch (discouraged for large scan paths)
- **On app startup**: Load `projects.json` from disk; NO automatic scan unless `scanFrequency: 'on-startup'`
- **Background scans**: Run via scheduler when app is idle; user can cancel anytime

**Performance Targets**:
- Scan rate: 1000 files/second on SSD
- Max scan time: 5 minutes (show cancel option after 1 minute)
- Memory limit: 500MB per worker
- Interrupt scan every 1000 files to check for cancel requests

**Git Detection**:
- Use `git` CLI via `execa` for info (branch, last commit, remotes, status)
- Parse remote URL to extract provider/owner/repo:
  ```typescript
  git remote get-url origin
  // → git@github.com:user/repo.git or https://github.com/user/repo.git
  // Parse: provider=github, owner=user, repo=repo
  ```
- Cache results with 5-minute TTL to avoid repeated calls
- Timeout: 10s per `git` command
- Fallback: if git unavailable, mark as `type: 'local'` and continue

**Git Provider Integration (Optional)**:

*Phase 1 — Basic (No API)*:
- Detect provider from remote URL (github.com, gitlab.com, etc.)
- Store provider/owner/repo in Project model
- Add "Open on GitHub" quick action that constructs URL: `https://github.com/{owner}/{repo}`

*Phase 2 — API Enrichment (Optional)*:
- User provides Personal Access Token (PAT) in Settings
- Encrypt and store using `safeStorage.encryptString()`
- Background sync fetches metadata:
  ```typescript
  // GitHub
  GET https://api.github.com/repos/{owner}/{repo}
  // → stars, description, language, openIssues, lastPushedAt
  
  // GitLab (supports self-hosted)
  GET https://gitlab.com/api/v4/projects/{owner}%2F{repo}
  ```
- Cache in Project model with TTL (24 hours)
- Show enriched data in UI: stars badge, language tag, last push date

**Features Enabled**:
- Quick Actions: "Open on GitHub", "View Issues", "View PRs" (URL construction)
- Filters: "Show only GitHub projects", "Has remote"
- Sort: "By stars" (if API enabled)
- Status: "Local behind remote by N commits" (future: via `git status -sb`)

**No OAuth Needed**: For personal use, PAT is sufficient and simpler than OAuth flow.

## Persistence & Offline
- JSON primary store for projects (`projects.json`) placed in the app data directory (Electron: `app.getPath('userData')/projects.json`).
- `electron-store` may be used for settings and small preferences.
- Use atomic write pattern: write to `projects.json.tmp` then `fs.rename` to replace `projects.json`, and keep `projects.json.bak` as a fallback.
- Debounce writes (e.g., 500ms–2s), and batch changes to reduce IO.
- Provide `clear cache` and `re-scan` in Settings.

## UI Mapping (existing code)
- Project list / tiles: `src/app/components/project-list-item.tsx`, `project-card.tsx`
- Top/filter bar: `src/app/components/filter-bar.tsx`
- Project detail: `src/app/components/project-detail-page.tsx`, `project-detail-view.tsx`
- Markdown rendering: `src/app/components/markdown-renderer.tsx`
- Settings and dialogs: `src/app/components/settings-screen.tsx`, `edit-project-dialog.tsx`, `delete-confirmation-dialog.tsx`

Gaps / suggestions:
- Add `ipc-api.ts` to `src/lib/` for typed IPC usage.
- Add `electron/main.ts` and `electron/scan-worker.ts` when scaffolding the desktop runtime.
- Use `react-window` for long lists and `rehype-mermaid`/client-side mermaid rendering.

## Security & Privacy

### Local-First & Network Isolation
- Default to local-only operations; no network calls except user-triggered (open remote URL, fetch git provider metadata)
- Expose clear controls for scanned folders in Settings; show "Scanned Paths" list with remove option
- No telemetry or analytics; all data stays local

### Input Sanitization
- **Path Traversal Prevention**: Validate all paths with `path.resolve()` and check against allowed scan directories
- **Command Injection**: Never interpolate user input into shell commands; use `execa` with argument arrays:
  ```typescript
  // SAFE: arguments as array
  execa('git', ['-C', projectPath, 'status'])
  
  // UNSAFE: string interpolation (never do this)
  // exec(`git -C ${projectPath} status`)
  ```
- **Markdown Sanitization**: Use `rehype-sanitize` to strip dangerous HTML/JS from rendered markdown
- **Project Metadata**: Validate and escape all user-editable fields (name, tags, notes) before persisting

### Process Sandboxing
- Enable Electron's `contextIsolation: true` and `nodeIntegration: false` in renderer
- Expose only safe IPC channels via `contextBridge`
- Git subprocesses run with limited environment variables (no `PATH` pollution)

### Token Storage
- GitHub/GitLab tokens stored using Electron's `safeStorage.encryptString()` (OS-level encryption)
- Tokens never logged or exposed in error messages
- Token validation on startup; prompt re-auth if expired

### File Access Permissions
- Respect OS file permissions; catch `EACCES` errors gracefully
- On Windows, respect UAC and avoid attempting to scan system directories without consent
- Show permission warnings in UI: "Unable to scan /path (permission denied)"

### Security Checklist (Pre-Release)
- [ ] Run `npm audit` and resolve critical vulnerabilities
- [ ] Enable Electron's security recommendations via `--enable-features=ElectronSerialChooser`
- [ ] Test path traversal attacks with malicious `../../` paths
- [ ] Verify command injection impossible via project metadata
- [ ] Audit all `eval()`, `Function()`, or dynamic code execution (should be none)
- [ ] Test markdown rendering with XSS payloads
- [ ] Code-sign builds (macOS notarization, Windows certificate)

## Tech Stack (Confirmed)
- Runtime: Electron + Vite
- Storage: JSON-backed `projects.json` with `lib/json-store.ts` helper. Use `electron-store` for settings.
- Search: `fuse.js` for in-memory fuzzy search.
- Shell: `execa` for `git` and launching IDE/terminal
- State: `zustand`, `react-query`
- List: `react-window`
- Markdown: `remark`/`rehype` with syntax highlight plugin and mermaid support
- Migration path: include an importer that can move `projects.json` → SQLite when/if scaling requires it.

## Electron (macOS & Windows) — Cross-platform notes

- Chosen runtime: **Electron** (Vite + React renderer). This targets macOS and Windows with the same codebase.
- App storage paths: use `app.getPath('userData')` for `projects.json` and `electron-store` settings. Example: `path.join(app.getPath('userData'), 'projects.json')`.
- Launching IDE / terminal:
  - Use `execa` to run configured commands. Normalize commands per-platform (e.g., `open -a 'Visual Studio Code' <path>` on macOS, `start`/`cmd /c start` or direct executable on Windows).
  - For terminal launches, allow user-configured terminal app (Terminal, iTerm2 on macOS; PowerShell, Windows Terminal, cmd on Windows) and form platform-specific command lines.
- Notifications & App ID (Windows): call `app.setAppUserModelId(...)` early for native notifications and taskbar behaviors.
- Path handling: always normalize paths with Node's `path` utilities and store canonical absolute paths. Use `path.posix`/`path.win32` where applicable.
- Atomic writes & backups: write `projects.json.tmp` then `fs.rename` to `projects.json`. Keep `projects.json.bak` for recovery.
- File locking & concurrency: assume single-authoritative Main process. Route all writes through Main IPC. If multiple writer scenarios arise, add a simple file-lock or use `write-file-atomic`.
- Code signing & notarization:
  - macOS: notarize builds and sign the app for smooth user installs.
  - Windows: code-sign installers and binaries to avoid SmartScreen warnings (or clearly document unsigned builds during development).
- Packaging & distribution:
  - Use `electron-builder` for cross-platform installers (DMG/pkg for macOS, NSIS/portable or MSI for Windows).
  - Consider `electron-updater` for in-app updates (optional).
- Platform testing: add CI matrix jobs for macOS and Windows builds (GitHub Actions has both runners) and smoke tests that open the app and run basic IPC flows.
- Developer convenience: provide `npm run dev` that starts the Vite renderer and `electron` main in watch mode; provide `npm run package` with `electron-builder` configs.

## Security & Privacy (platform notes)

- Local-only by default: no outbound network unless user action triggers it (open remote URL).
- Permissions: clearly surface folder-scan locations and let users remove paths. On Windows, respect UAC when trying to access restricted folders.
- Data export/import: provide `Export projects.json` and `Import projects.json` for backups and migrations.

## Memory & Scale Limits
**Target Capacity** (personal use):
- Projects: 500-1000 (comfortable), 2000 (max with JSON)
- Files per project: 10,000 (scanned on-demand, not cached)
- Total JSON size: <5MB uncompressed

**Memory Budget**:
- Main process: <200MB idle, <500MB during scan
- Renderer process: <150MB idle, <300MB with large list
- Search index: ~5MB per 1000 projects

**Scaling Triggers**:
- If `projects.json` exceeds 10MB → prompt user to archive old projects
- If project count exceeds 2000 → suggest migration to SQLite (future)
- If scan takes >5 minutes → suggest reducing scan depth or paths

## Testing Strategy
**Unit Tests** (Jest):
- JSON store: load, save, atomic writes, backup recovery
- IPC handlers: request/response/error formatting
- Git parser: remote URL parsing, provider detection
- Search index: Fuse.js queries, incremental updates

**Integration Tests** (Playwright + Spectron):
- End-to-end: scan folders → display projects → open detail → edit metadata
- IPC flow: renderer → Main → response → UI update
- Error scenarios: corrupt JSON, missing git, permission errors

**Manual Testing Checklist**:
- [ ] Scan 100+ projects in ~10 directories
- [ ] Edit project metadata while scan is running (conflict handling)
- [ ] Corrupt `projects.json` and verify backup recovery
- [ ] Test on macOS and Windows (path handling, IDE launching)
- [ ] Render README with malicious HTML (XSS attempt)
- [ ] Disconnect network and verify local-only operation

**Performance Benchmarks**:
- [ ] Scan 1000 files in <1 second
- [ ] Search 1000 projects in <50ms
- [ ] Load app with 500 projects in <1 second
- [ ] Render list of 1000 projects smoothly (60fps scroll)

## Schema Versioning & Migrations
**Version Field**: `meta.version` in `projects.json` (current: 1)

**Migration Path**:
```typescript
function migrate(data: any): ProjectsData {
  const version = data.meta?.version || 0;
  
  if (version < 1) {
    // v0 → v1: add scanStatus field
    data.projects = data.projects.map(p => ({ ...p, scanStatus: 'complete' }));
    data.meta.version = 1;
  }
  
  // Future migrations here
  
  return data;
}
```

**Breaking Changes**: If incompatible, show migration UI: "Upgrade database? (backup created automatically)"

**SQLite Migration** (future):
- Provide `Export to SQLite` button in Settings
- Create `projects.db` with schema matching JSON structure
- Fallback: keep JSON as export/import format for portability

## Accessibility & Internationalization
**Accessibility** (WCAG 2.1 AA):
- All interactive elements keyboard-navigable (Tab, Enter, Escape)
- ARIA labels on icons, buttons, status indicators
- Focus indicators visible (outline rings)
- Screen reader tested with VoiceOver (macOS) and NVDA (Windows)
- Color contrast ratio ≥4.5:1 for text

**Internationalization** (i18n):
- Not planned for v1 (English-only)
- Future: Use `react-i18next`; extract strings to `locales/en.json`
- Date/time formatting via `Intl.DateTimeFormat`

## Implementation Milestones
**M0 — Foundation** (1-2 days):
- Scaffold Electron with Vite renderer
- Add `lib/json-store.ts` with atomic writes, backup, migration support
- Add `lib/ipc-api.ts` typed wrapper with error schema
- Implement basic IPC handlers: `project/list`, `project/get`
- Unit tests for JSON store and IPC protocol

**M1 — Core Data Flow** (2-3 days):
- Scanner worker that walks directories and detects git projects
- Populate `projects.json` with discovered projects
- In-memory Fuse.js index for search
- Wire renderer to display project list via IPC
- Add loading states and error boundaries

**M2 — Filtering & Search** (2 days):
- Implement filter bar: type, provider, tags, date ranges
- Wire search input to Fuse.js index
- Add virtualization via `react-window` for project list
- Sort options: name, lastUsedAt, importance
- Pagination for large result sets

**M3 — Project Details** (2-3 days):
- Project detail page with tabs: Overview, Files, README
- Files tab: on-demand filesystem tree (not cached)
- README tab: fetch and render markdown with syntax highlighting
- Git info panel: branch, last commit, remotes
- Edit metadata dialog with optimistic updates

**M4 — Actions & Settings** (2 days):
- Quick actions: Open in IDE, Open terminal, Open on GitHub
- Settings screen: scan paths, ignored patterns, IDE config, git provider tokens
- Delete project with confirmation
- Export/import `projects.json` for backup
- Clear cache and re-scan

**M5 — Polish & Testing** (2-3 days):
- Error handling and graceful degradation
- Performance tuning: debounce writes, throttle events
- Platform testing: macOS and Windows
- Security audit: XSS, command injection, path traversal
- Accessibility review
- Package with `electron-builder` (DMG, NSIS)

## Next Steps

**Recommended Path**: Start with **M0 (Foundation)** to validate architecture decisions early:

1. **Scaffold Electron + Vite Integration** (~2 hours)
   - Set up `electron/main.ts`, `electron/preload.ts`
   - Configure Vite to build renderer + main process
   - Test hot reload in dev mode

2. **Implement `lib/json-store.ts`** (~3 hours)
   - Load/save with atomic writes
   - Backup and recovery logic
   - Schema migration system
   - Unit tests with Jest

3. **Implement `lib/ipc-api.ts`** (~2 hours)
   - Typed wrappers for all IPC endpoints
   - Error schema and timeout handling
   - Request/response logging

4. **Validate Concurrency Model** (~2 hours)
   - Write queue implementation
   - Test concurrent reads + sequential writes
   - Verify no race conditions

**Success Criteria for M0**:
- [ ] App launches and displays empty project list
- [ ] `project/list` IPC call succeeds with empty data
- [ ] `projects.json` created and loaded correctly
- [ ] Unit tests pass for JSON store and IPC
- [ ] No crashes or memory leaks in 5-minute idle test

---

**Architecture Status**: ✅ Production-ready with critical gaps addressed

**Changes from Original**:
- Added IPC error schema and timeout handling
- Specified concurrency model with write queue
- Expanded error handling and resilience strategies
- Added performance targets and memory limits
- Defined security checklist and sanitization rules
- Added testing strategy and migration plan
- Clarified git provider integration phases
- Expanded data model with field definitions

---

Created from: `FEATURES.md`, `Figma_Code/Software Project Explorer/FEATURES.md`, screenshots in `ss/`.

**Revision**: Updated based on architectural review addressing concurrency, error handling, security, and scaling concerns.
