# Development Guide

## Getting Started

### Install Dependencies
```bash
npm install
```

### Run Development Mode
```bash
npm run electron:dev
```

This will:
1. Start Vite dev server (React renderer)
2. Launch Electron with hot reload enabled

### Build for Production
```bash
npm run build
```

### Package App
```bash
npm run package
```

Creates distributable files in `release/` directory.

## Project Structure

```
/
├── electron/           # Electron main process
│   ├── main.ts        # Main entry point
│   ├── preload.ts     # Preload script (context bridge)
│   ├── json-store.ts  # Data persistence layer
│   └── ipc-handlers.ts # IPC request handlers
├── src/               # React renderer process
│   ├── App.tsx        # Main app component
│   ├── main.tsx       # React entry point
│   └── lib/           # Shared libraries
│       ├── types.ts   # TypeScript definitions
│       └── ipc-api.ts # IPC client wrapper
├── dist/              # Built renderer files
├── dist-electron/     # Built electron files
└── release/           # Packaged app distributables
```

## Development Tips

### View Logs
Electron logs are written to:
- macOS: `~/Library/Logs/desktop-project-explorer/`
- Windows: `%USERPROFILE%\AppData\Roaming\desktop-project-explorer\logs\`

### Data Storage
Projects are stored in:
- macOS: `~/Library/Application Support/desktop-project-explorer/projects.json`
- Windows: `%APPDATA%\desktop-project-explorer\projects.json`

### DevTools
In development mode, DevTools open automatically. Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows) to toggle.

## M0 Milestones

- [x] Electron + Vite + React setup
- [x] TypeScript configuration
- [x] JSON Store with atomic writes
- [x] IPC API with error handling
- [x] Main/Renderer communication working

Next: M1 - Scanner implementation
