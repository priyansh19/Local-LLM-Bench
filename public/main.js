const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  // The design is a fixed 1300x830 window with its own title bar, rounded
  // corners and drop shadow. Going frameless + transparent lets that BE the
  // real window chrome instead of drawing a fake window inside an OS one.
  // The extra 52px on each axis is the 26px padding the shadow renders into.
  mainWindow = new BrowserWindow({
    width: 1352,
    height: 882,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
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
  startMetrics();

  // DevTools no longer auto-opens — it made the app look "inside a window".
  // Toggle it manually via the View menu or Ctrl+Shift+I when debugging.

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('before-quit', () => {
  if (metrics) metrics.stop();
});

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

const { Metrics } = require('./metrics');

let metrics = null;

// Metrics are pushed to the renderer as they arrive rather than polled: a
// one-shot Get-Counter costs ~1.6s in spawn overhead, which is why the old
// 5s poll never felt live.
function startMetrics() {
  if (metrics) return;
  metrics = new Metrics((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-metrics', state);
    }
  });
  metrics.start();
}

// Kept for the initial render; the stream takes over immediately after.
ipcMain.handle('get-system-info', async () => (metrics ? metrics.state : null));

// ---------------------------------------------------------------------------
// Real backend. Every handler below performs actual work against a local
// Ollama server: real model list, real generation, real download, real delete.
// ---------------------------------------------------------------------------
const ollama = require('./ollama');
const inference = require('./inference');
const { BenchRunner } = require('./bench');
const results = require('./results-store');
const { detectProviders } = require('./providers');
const registries = require('./registries');

let runner = null;

const send = (channel, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
};

ipcMain.handle('ollama-status', async () => ({ up: await ollama.isUp() }));
ipcMain.handle('detect-providers', async () => {
  // Must not reject: the renderer runs this in a Promise.all with list-models,
  // so a throw here would blank the whole catalog.
  try {
    return await detectProviders();
  } catch (e) {
    return { checkedAt: new Date().toISOString(), providers: [], error: e.message };
  }
});

// ---- multi-registry model discovery + download ----
ipcMain.handle('registry-search', async (_e, { source, query }) => {
  try {
    if (source === 'huggingface' || source === 'lmstudio') {
      // Both browse Hugging Face; they differ only in how the model is pulled.
      return { ok: true, models: await registries.hfSearch(query) };
    }
    return { ok: true, models: [] };
  } catch (e) {
    return { ok: false, error: e.message, models: [] };
  }
});

ipcMain.handle('registry-quants', async (_e, { repo }) => {
  try {
    return { ok: true, quants: await registries.hfQuants(repo) };
  } catch (e) {
    return { ok: false, error: e.message, quants: [] };
  }
});

ipcMain.handle('lms-list', async () => {
  try {
    return { ok: true, models: await registries.lmsList() };
  } catch (e) {
    return { ok: false, error: e.message, models: [] };
  }
});

// Download from a chosen registry, streaming progress under a stable key so the
// renderer can track this specific pull.
ipcMain.handle('registry-pull', async (_e, { source, repo, quant, key }) => {
  const onProgress = (p) => send('registry-pull-progress', { key, source, ...p });
  try {
    if (source === 'huggingface') {
      await registries.hfPull(repo, quant, onProgress);
    } else if (source === 'lmstudio') {
      // lms accepts a full HF URL; pin the quant when the user picked one.
      const target = quant ? `${repo}@${String(quant).toLowerCase()}` : repo;
      await registries.lmsGet(target, onProgress);
    } else {
      return { ok: false, error: `Unknown registry source: ${source}` };
    }
    send('registry-pull-progress', { key, source, status: 'success', pct: 100 });
    return { ok: true };
  } catch (e) {
    send('registry-pull-progress', { key, source, status: 'error', error: e.message });
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('open-external', async (_e, url) => { if (/^https:\/\//.test(url)) await shell.openExternal(url); });

// Provider-aware: vLLM/LM Studio/llama.cpp expose their OWN model ids via
// /v1/models. Sending an Ollama tag to an OpenAI-compatible server 404s, so the
// picker must list the ids the selected provider actually accepts.
ipcMain.handle('list-models', async (_e, arg) => {
  const provider = (arg && arg.provider) || 'ollama';
  try {
    return { ok: true, provider, models: await inference.resolve(provider).listModels() };
  } catch (e) {
    return { ok: false, provider, error: e.message, models: [] };
  }
});

ipcMain.handle('run-benchmark', async (_e, { model, tasks, options }) => {
  if (runner) return { ok: false, error: 'A benchmark is already running.' };
  runner = new BenchRunner({
    getMetrics: () => (metrics ? metrics.state : {}),
    emit: (evt) => send('benchmark-progress', evt),
  });
  try {
    const out = await runner.run({ model, tasks, options });
    // Attach the machine it actually ran on — results are meaningless without it.
    out.machine = metrics
      ? { gpu: metrics.state.gpu, cpu: metrics.state.cpu, cores: metrics.state.cores, ram: metrics.state.memory, os: metrics.state.os }
      : null;
    const saved = await results.save(out);
    send('benchmark-complete', saved);
    return { ok: true, result: saved };
  } catch (e) {
    send('benchmark-error', { error: e.message });
    return { ok: false, error: e.message };
  } finally {
    runner = null;
  }
});

ipcMain.handle('cancel-benchmark', () => {
  if (!runner) return { ok: false };
  runner.cancel();
  return { ok: true };
});

ipcMain.handle('pull-model', async (_e, { name }) => {
  try {
    await ollama.pullModel(name, (p) => send('pull-progress', { name, ...p }));
    send('pull-progress', { name, status: 'success', completed: 1, total: 1 });
    return { ok: true };
  } catch (e) {
    send('pull-progress', { name, status: 'error', error: e.message });
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('delete-model', async (_e, { name }) => {
  try {
    await ollama.deleteModel(name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('list-runs', async () => results.list());
ipcMain.handle('clear-runs', async () => results.clear());

// Frameless window needs its own controls — the design's three title-bar dots.
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());

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
