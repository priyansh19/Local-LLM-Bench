const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');

let mainWindow;
let benchmarkProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for benchmark operations
ipcMain.handle('run-benchmark', async (event, options) => {
  return new Promise((resolve, reject) => {
    try {
      const cliPath = path.join(__dirname, '../src-cli/target/release/llm-bench');

      benchmarkProcess = spawn(cliPath, [
        'run',
        options.model,
        '--dataset', options.dataset,
        '--iterations', options.iterations,
        '--output', options.output
      ]);

      let output = '';
      let errorOutput = '';

      benchmarkProcess.stdout.on('data', (data) => {
        output += data.toString();
        event.sender.send('benchmark-progress', { status: 'running', message: data.toString() });
      });

      benchmarkProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      benchmarkProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output, errorOutput });
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('list-models', async () => {
  try {
    const cliPath = path.join(__dirname, '../src-cli/target/release/llm-bench');

    return new Promise((resolve, reject) => {
      const process = spawn(cliPath, ['list-datasets']);

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error('Failed to list models'));
        }
      });
    });
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('get-system-info', async () => {
  const os = require('os');
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    appVersion: app.getVersion()
  };
});

ipcMain.handle('cancel-benchmark', () => {
  if (benchmarkProcess) {
    benchmarkProcess.kill();
    return { success: true };
  }
  return { success: false };
});

// Menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit()
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
