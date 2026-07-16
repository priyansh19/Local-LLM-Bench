import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [model, setModel] = useState('ollama:mistral');
  const [iterations, setIterations] = useState(5);
  const [dataset, setDataset] = useState('standard');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState('');
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    const loadSystemInfo = async () => {
      if (window.electron) {
        const info = await window.electron.getSystemInfo();
        setSystemInfo(info);
      }
    };
    loadSystemInfo();

    if (window.electron) {
      window.electron.onBenchmarkProgress((data) => {
        setLogs((prev) => prev + data.message + '\n');
        setProgress((prev) => Math.min(prev + 1, 99));
      });
    }
  }, []);

  const runBenchmark = async () => {
    setIsRunning(true);
    setLogs('');
    setProgress(0);
    setResults(null);

    try {
      if (window.electron) {
        const result = await window.electron.runBenchmark({
          model,
          iterations,
          dataset,
          output: 'benchmark_results.json'
        });

        setProgress(100);
        setResults(result);
        setLogs((prev) => prev + '\n✅ Benchmark completed!\n');
      }
    } catch (error) {
      setLogs((prev) => prev + `\n❌ Error: ${error.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const cancelBenchmark = async () => {
    if (window.electron) {
      await window.electron.cancelBenchmark();
      setIsRunning(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 LLM Bench</h1>
        <p>Professional LLM Benchmarking Tool</p>
      </header>

      <div className="container">
        {/* Left Panel - Configuration */}
        <div className="left-panel">
          <div className="panel">
            <h2>⚙️ Configuration</h2>

            <div className="form-group">
              <label>Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={isRunning}>
                <option value="ollama:mistral">Ollama: Mistral</option>
                <option value="ollama:neural-chat">Ollama: Neural Chat</option>
                <option value="ollama:orca">Ollama: Orca</option>
                <option value="lmstudio:model">LM Studio: Model</option>
                <option value="llama-cpp:model">llama.cpp: Model</option>
              </select>
            </div>

            <div className="form-group">
              <label>Iterations: {iterations}</label>
              <input
                type="range"
                min="1"
                max="100"
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value))}
                disabled={isRunning}
              />
            </div>

            <div className="form-group">
              <label>Dataset</label>
              <select value={dataset} onChange={(e) => setDataset(e.target.value)} disabled={isRunning}>
                <option value="standard">Standard</option>
                <option value="extended">Extended</option>
                <option value="coding">Coding Tasks</option>
              </select>
            </div>

            <div className="button-group">
              <button
                className="btn-primary"
                onClick={runBenchmark}
                disabled={isRunning}
              >
                {isRunning ? '⏳ Running...' : '▶️ Start Benchmark'}
              </button>
              {isRunning && (
                <button className="btn-danger" onClick={cancelBenchmark}>
                  ⏹️ Cancel
                </button>
              )}
            </div>
          </div>

          {/* System Info */}
          {systemInfo && (
            <div className="panel">
              <h2>💻 System</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span>CPUs:</span>
                  <strong>{systemInfo.cpus}</strong>
                </div>
                <div className="info-item">
                  <span>Memory:</span>
                  <strong>{(systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB</strong>
                </div>
                <div className="info-item">
                  <span>Platform:</span>
                  <strong>{systemInfo.platform}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Results & Logs */}
        <div className="right-panel">
          {isRunning && (
            <div className="panel">
              <h2>📊 Progress</h2>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="progress-text">{progress}%</p>
            </div>
          )}

          {results && (
            <div className="panel">
              <h2>✅ Results</h2>
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          )}

          <div className="panel">
            <h2>📝 Logs</h2>
            <div className="logs-container">
              <pre>{logs || 'Waiting for benchmark to start...'}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
