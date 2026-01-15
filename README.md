# Desktop Project Explorer (DPE)

A desktop application for managing and exploring software projects on your local machine. Scan directories, visualize project metadata, browse files, and quickly open projects in your IDE or terminal.

## Overview

Desktop Project Explorer helps developers organize their local projects by:
- **Auto-discovering** Git and local projects in specified directories
- **Displaying** project metadata (language, stars, last commit, file count)
- **Filtering & searching** with fuzzy search and advanced filters
- **Quick actions** to open projects in IDE, terminal, or on GitHub/GitLab
- **README viewing** with syntax highlighting and Mermaid diagram support

## Features

- 🔍 **Smart Scanning**: Configurable directory scanning with respect for ignore patterns
- 📊 **Project Grid/List Views**: Switch between card grid and detailed list layouts
- 🏷️ **Tagging & Importance**: Organize projects with custom tags and priority levels
- 🔗 **Git Integration**: Automatic detection of GitHub/GitLab repos with optional API enrichment
- ⚡ **Fast Search**: In-memory fuzzy search powered by Fuse.js
- 📝 **Markdown Rendering**: View project READMEs with syntax highlighting
- 🎨 **Dark/Light Themes**: System-aware theme support
- 🔒 **Local-First**: All data stays on your machine, no telemetry

## Tech Stack

- **Desktop Runtime**: Electron
- **Frontend**: React + TypeScript + Vite
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: Zustand + React Query
- **Storage**: JSON-based local storage with atomic writes
- **Search**: Fuse.js for fuzzy matching

## Project Status

✅ **M0 Complete** - Foundation established (JSON store, IPC, Electron scaffold)
✅ **M1 Complete** - Scanner, project discovery, search index working
✅ **M2 Complete** - Filtering & search UI with professional Figma-aligned design
✅ **M3 Complete** - Project detail page with Overview, Files, README tabs, and edit dialog

See [ARCHITECTURE_PROPOSAL.md](ARCHITECTURE_PROPOSAL.md) for detailed technical architecture.

## Installation (Coming Soon)

Once released, installation will be:

**macOS**:
```bash
# Download DPE-1.0.0.dmg from releases
# Drag app to Applications folder
```

**Windows**:
```bash
# Download DPE-Setup-1.0.0.exe from releases
# Run installer
```

## Development Setup

Requirements:
- Node.js 18+
- npm or yarn

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Package for distribution
npm run package
```

### Running the app during development

Use the guarded script which starts Vite and launches Electron after the dev server is ready:

```bash
npm run electron:dev
```

Or run in two terminals (recommended when iterating on the renderer):

Terminal A — start Vite:
```bash
npm run dev -- --port 5173
```

Terminal B — wait and launch Electron (after Vite is ready):
```bash
npx wait-on http://localhost:5173 && VITE_DEV_SERVER_PORT=5173 npx electron .
```

If you see a blank screen in the Electron window, confirm the dev server is listening (`nc -vz localhost 5173` or `curl -I http://localhost:5173`) and then relaunch Electron. The app logs are saved to the terminal that launched Electron and can be inspected for IPC / HMR errors.

## Usage

1. **Add Scan Paths**: Configure directories to scan in Settings
2. **Scan Projects**: Click "Scan" to discover projects (or enable auto-scan)
3. **Browse & Filter**: Use search, filters, and tags to find projects
4. **View Details**: Click any project to see files, README, and git info
5. **Quick Actions**: Open in IDE, terminal, or view on GitHub

## Configuration

Settings include:
- Scan paths and ignore patterns
- Scan frequency (manual, daily, weekly)
- Default IDE and terminal commands
- GitHub/GitLab API tokens (optional)
- UI preferences (theme, view mode, sort order)

## License

Personal use project - License TBD

## Contributing

This is a personal project. Feel free to fork for your own use.

## Roadmap

- [x] Architecture design
- [ ] M0: Foundation (JSON store, IPC, Electron scaffold)
- [ ] M1: Scanner & project discovery
- [ ] M2: Filtering & search
- [ ] M3: Project detail views
- [ ] M4: Quick actions & settings
	- Import preview and import/merge confirmation
	- Export/import (JSON), clear cache and re-scan
- [ ] M5: Polish & packaging

See [ARCHITECTURE_PROPOSAL.md](ARCHITECTURE_PROPOSAL.md) for detailed milestones.
