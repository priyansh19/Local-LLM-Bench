const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const h = (_e, d) => cb(d);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('electron', {
  // --- live hardware ---
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  onSystemMetrics: on('system-metrics'),

  // --- real Ollama backend ---
  ollamaStatus: () => ipcRenderer.invoke('ollama-status'),
  detectProviders: () => ipcRenderer.invoke('detect-providers'),
  registrySearch: (source, query) => ipcRenderer.invoke('registry-search', { source, query }),
  registryQuants: (repo) => ipcRenderer.invoke('registry-quants', { repo }),
  registryPull: (source, repo, quant, key) => ipcRenderer.invoke('registry-pull', { source, repo, quant, key }),
  lmsList: () => ipcRenderer.invoke('lms-list'),
  onRegistryPullProgress: on('registry-pull-progress'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  listModels: (provider) => ipcRenderer.invoke('list-models', { provider }),
  runBenchmark: (opts) => ipcRenderer.invoke('run-benchmark', opts),
  cancelBenchmark: () => ipcRenderer.invoke('cancel-benchmark'),
  pullModel: (name) => ipcRenderer.invoke('pull-model', { name }),
  deleteModel: (name) => ipcRenderer.invoke('delete-model', { name }),
  listRuns: () => ipcRenderer.invoke('list-runs'),
  clearRuns: () => ipcRenderer.invoke('clear-runs'),

  onBenchmarkProgress: on('benchmark-progress'),
  onBenchmarkComplete: on('benchmark-complete'),
  onBenchmarkError: on('benchmark-error'),
  onPullProgress: on('pull-progress'),

  // --- frameless window controls ---
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
});
