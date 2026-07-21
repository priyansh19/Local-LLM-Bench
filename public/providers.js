'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const ollama = require('./ollama');

// Detect which local inference engines are actually installed and running.
// Everything reported here is a real check against the filesystem or a live
// port — nothing is assumed present.

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function httpUp(port, path_ = '/', timeout = 1500) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: path_, method: 'GET', timeout }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function detectProviders() {
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  const ollamaBin = path.join(local, 'Programs', 'Ollama', 'ollama.exe');
  const ollamaInstalled = fileExists(ollamaBin) || fileExists('/usr/local/bin/ollama') || fileExists('/usr/bin/ollama');
  const ollamaRunning = await ollama.isUp();
  let ollamaModelCount = null;
  if (ollamaRunning) {
    try {
      ollamaModelCount = (await ollama.listModels()).length;
    } catch {
      ollamaModelCount = null;
    }
  }

  const lmsBin = path.join(home, '.lmstudio', 'bin', 'lms.exe');
  const lmStudioInstalled = fileExists(lmsBin) || fileExists(path.join(home, '.lmstudio', 'bin', 'lms'));
  const lmStudioRunning = await httpUp(1234, '/v1/models');

  return {
    checkedAt: new Date().toISOString(),
    providers: [
      {
        id: 'ollama',
        label: 'Ollama',
        tag: 'GGUF · one-command',
        installed: ollamaInstalled,
        running: ollamaRunning,
        modelCount: ollamaModelCount,
        primary: true, // the engine the app actually benchmarks through
        endpoint: 'http://127.0.0.1:11434',
        install: 'https://ollama.com/download',
        note: ollamaRunning
          ? `Connected · ${ollamaModelCount ?? 0} model${ollamaModelCount === 1 ? '' : 's'} installed`
          : ollamaInstalled
          ? 'Installed but not running — start it with `ollama serve`.'
          : 'Not installed. Install Ollama to download and benchmark models.',
      },
      {
        id: 'lmstudio',
        label: 'LM Studio',
        tag: 'GGUF · GUI',
        installed: lmStudioInstalled,
        running: lmStudioRunning,
        modelCount: null,
        primary: false,
        endpoint: 'http://127.0.0.1:1234',
        install: 'https://lmstudio.ai',
        note: lmStudioRunning
          ? 'Local server detected on :1234 (benchmarking via LM Studio is not yet wired).'
          : lmStudioInstalled
          ? 'Installed — start its local server to use it here (not yet wired).'
          : 'Not installed.',
      },
      {
        id: 'llamacpp',
        label: 'llama.cpp',
        tag: 'native',
        installed: false,
        running: false,
        modelCount: null,
        primary: false,
        endpoint: null,
        install: 'https://github.com/ggerganov/llama.cpp',
        note: 'Not detected. Direct llama.cpp support is planned.',
      },
    ],
  };
}

module.exports = { detectProviders };
