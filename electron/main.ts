import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import log from 'electron-log';
import { getStore } from './json-store';
import { setupIPCHandlers } from './ipc-handlers';
import { getSearchIndex } from './search-index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Window reference
let mainWindow: BrowserWindow | null = null;

// Development mode check
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // If someone tries to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Desktop Project Explorer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app
  if (isDev) {
    // Use environment variable or default to 5173
    const port = process.env.VITE_DEV_SERVER_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created');
}

// Initialize app data
async function initializeApp() {
  try {
    // Initialize JSON store
    const store = getStore();
    await store.initialize();
    log.info('Store initialized successfully');

    // Build search index from stored projects
    const projects = await store.getAllProjects();
    const searchIndex = getSearchIndex();
    searchIndex.buildIndex(projects);
    log.info(`Search index built with ${projects.length} projects`);

    // Set up IPC handlers
    setupIPCHandlers();
  } catch (error) {
    log.error('Failed to initialize app:', error);
    throw error;
  }
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeApp();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
