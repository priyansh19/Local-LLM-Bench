const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  runBenchmark: (options) => ipcRenderer.invoke('run-benchmark', options),
  listModels: () => ipcRenderer.invoke('list-models'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  cancelBenchmark: () => ipcRenderer.invoke('cancel-benchmark'),
  onBenchmarkProgress: (callback) => ipcRenderer.on('benchmark-progress', (event, data) => callback(data)),
  onBenchmarkComplete: (callback) => ipcRenderer.on('benchmark-complete', (event, data) => callback(data))
});
