import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import Registry from './components/Registry';
import ModelDetail from './components/ModelDetail';
import Downloads from './components/Downloads';
import Setup from './components/Setup';
import LiveRun from './components/LiveRun';
import Results from './components/Results';
import RunReport from './components/RunReport';
import Settings from './components/Settings';
import { buildCatalog } from './data/adapt';

// Browser-tab preview only: no IPC bridge exists there, so this is explicitly
// labelled sample data. Under Electron every field is a live reading.
const BROWSER_PREVIEW_SYSTEM_INFO = {
  gpu: 'RTX 4070 (sample data — run the desktop app for live metrics)',
  vram: 12, vramUsed: 4.2, vramShared: false, gpuPct: 41,
  cpu: 'i7-13700H (sample)', cores: 20, cpuPct: 23,
  memory: 32, memoryUsed: 11.4, os: 'Windows 11',
  gpuTemp: 62, gpuPower: 180, diskUsed: 245, diskTotal: 512,
};

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);

  // The catalog always shows the full installable set; models actually on disk
  // are promoted to "installed" once the backend reports them.
  const [catalog, setCatalog] = useState(() => buildCatalog([]));
  const [runs, setRuns] = useState([]);
  const [providers, setProviders] = useState(null);
  const [backend, setBackend] = useState({ live: false, ollamaUp: false, error: null, checked: false });

  // Live run state, driven by real benchmark-progress events.
  const [run, setRun] = useState({
    running: false, progress: 0, task: null, text: '', tokens: 0,
    ttftMs: null, points: [], error: null, startedAt: null,
  });

  const [benchmarkConfig, setBenchmarkConfig] = useState({
    model: null,
    tasks: { throughput: true, ttft: true, vision: false, audio: false, reasoning: true, memory: true },
    provider: 'ollama',
    precision: 'Q4_K_M',
    temp: 0.7, topP: 0.9, topK: 40, maxTokens: 512,
    ctx: 4096, gpuLayers: 33, batch: 512,
    flashAttn: true, mmap: true, kvF16: true,
  });

  const lastTokenAt = useRef(0);
  // Mirror currentView + run.running into refs so the IPC listeners (bound once)
  // read the latest value without re-subscribing.
  const viewRef = useRef(currentView);
  viewRef.current = currentView;
  const runningRef = useRef(run.running);
  runningRef.current = run.running;

  const refreshModels = useCallback(async () => {
    if (!window.electron?.listModels) return;
    const [{ up }, res, provs] = await Promise.all([
      window.electron.ollamaStatus(),
      window.electron.listModels(),
      window.electron.detectProviders?.() ?? Promise.resolve(null),
    ]);
    if (provs) setProviders(provs);
    // Always show the full installable catalog; promote whatever is really on
    // disk. If Ollama is down we still show installable models, just disabled.
    setCatalog(buildCatalog(res.ok ? res.models : []));
    setBackend({
      live: up && res.ok,
      ollamaUp: up,
      error: up ? (res.ok ? null : res.error) : 'Ollama is not running — start it to install and benchmark models.',
      checked: true,
    });
  }, []);

  const refreshRuns = useCallback(async () => {
    if (!window.electron?.listRuns) return;
    setRuns((await window.electron.listRuns()) || []);
  }, []);

  useEffect(() => {
    if (!window.electron) {
      setSystemInfo(BROWSER_PREVIEW_SYSTEM_INFO);
      setBackend({ live: false, ollamaUp: false, error: 'Browser preview — no backend. Run the desktop app.', checked: true });
      return undefined;
    }
    document.body.classList.add('is-electron');

    const offMetrics = window.electron.onSystemMetrics?.((m) => setSystemInfo(m));
    window.electron.getSystemInfo?.().then((m) => m && setSystemInfo(m));
    refreshModels();
    refreshRuns();

    const offProgress = window.electron.onBenchmarkProgress?.((e) => {
      setRun((prev) => {
        const next = { ...prev, progress: e.progress ?? prev.progress, task: e.task ?? prev.task };
        if (e.type === 'token') {
          next.text = e.text;
          next.tokens = e.tokens;
          next.ttftMs = e.ttftMs ?? prev.ttftMs;
          // Derive a real throughput series from actual token arrival times.
          // Each sub-generation (cold/throughput/reasoning items) restarts the
          // client's token count at 1, so only measure a delta WITHIN a
          // generation — a reset (e.tokens <= prev) starts a fresh segment.
          const now = performance.now();
          if (lastTokenAt.current && e.tokens > prev.tokens && e.tokens - prev.tokens < 50) {
            const dt = (now - lastTokenAt.current) / 1000;
            if (dt > 0) {
              const inst = (e.tokens - prev.tokens) / dt;
              next.points = [...prev.points, Math.min(400, inst)].slice(-48);
            }
          }
          lastTokenAt.current = now;
        }
        return next;
      });
    });

    const offComplete = window.electron.onBenchmarkComplete?.((result) => {
      setRun((prev) => ({ ...prev, running: false, progress: 100 }));
      setSelectedRun(result);
      refreshRuns();
      // Only jump to results if the user is actually watching the run — don't
      // yank them off whatever screen they navigated to.
      if (viewRef.current === 'run') setCurrentView('results');
    });

    const offError = window.electron.onBenchmarkError?.(({ error }) => {
      setRun((prev) => ({ ...prev, running: false, error }));
    });

    return () => {
      offMetrics?.();
      offProgress?.();
      offComplete?.();
      offError?.();
    };
  }, [refreshModels, refreshRuns]);

  // ---- real actions -------------------------------------------------------
  const startBenchmark = useCallback(
    async (model) => {
      // Don't clobber a run already in flight — the backend would reject the
      // second one and leave the UI showing a fresh-but-dead run.
      if (runningRef.current) {
        setCurrentView('run');
        return;
      }
      const target = model || benchmarkConfig.model || catalog.find((m) => m.status === 'installed');
      if (!target) return;
      lastTokenAt.current = 0;
      // The run snapshot carries everything the LiveRun screen needs, so it can
      // be left and returned to without losing context.
      setRun({
        running: true,
        progress: 0,
        task: null,
        text: '',
        tokens: 0,
        ttftMs: null,
        points: [],
        error: null,
        startedAt: Date.now(),
        model: target,
        provider: benchmarkConfig.provider,
        tasks: benchmarkConfig.tasks,
      });
      setBenchmarkConfig((p) => ({ ...p, model: target }));
      setCurrentView('run');

      if (!window.electron?.runBenchmark) {
        setRun((p) => ({ ...p, running: false, error: 'No backend in browser preview — run the desktop app.' }));
        return;
      }
      await window.electron.runBenchmark({
        model: target.tag || target.id,
        tasks: benchmarkConfig.tasks,
        options: {
          provider: benchmarkConfig.provider,
          temperature: benchmarkConfig.temp,
          top_p: benchmarkConfig.topP,
          top_k: benchmarkConfig.topK,
          num_predict: benchmarkConfig.maxTokens,
          num_ctx: benchmarkConfig.ctx,
          num_gpu: benchmarkConfig.gpuLayers,
        },
      });
    },
    [benchmarkConfig, catalog]
  );

  const cancelBenchmark = useCallback(async () => {
    await window.electron?.cancelBenchmark?.();
    setRun((p) => ({ ...p, running: false }));
  }, []);

  const startDownload = useCallback(
    async (id) => {
      setCurrentView('downloads');
      if (!window.electron?.pullModel) return;
      setCatalog((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'downloading', pct: 0 } : m)));
      const off = window.electron.onPullProgress?.((p) => {
        if (p.name !== id) return;
        if (p.total && p.completed) {
          const pct = (p.completed / p.total) * 100;
          setCatalog((prev) => prev.map((m) => (m.id === id ? { ...m, pct, dlStatus: p.status } : m)));
        }
        if (p.status === 'success') { off?.(); refreshModels(); }
        if (p.status === 'error') {
          off?.();
          setCatalog((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'available', pct: 0, error: p.error } : m)));
        }
      });
      await window.electron.pullModel(id);
    },
    [refreshModels]
  );

  const deleteModel = useCallback(
    async (id) => {
      if (!window.electron?.deleteModel) return;
      const res = await window.electron.deleteModel(id);
      if (res?.ok) refreshModels();
    },
    [refreshModels]
  );

  const handleNavigation = (view, data = null) => {
    if (view === 'detail') { setSelectedModel(data); setCurrentView('detail'); }
    else if (view === 'run') { startBenchmark(data); }
    else if (view === 'report') {
      setSelectedRun(data?.run || data);
      if (data?.model) setSelectedModel(data.model);
      setCurrentView('report');
    } else setCurrentView(view);
  };

  const shared = {
    currentView, systemInfo, selectedModel, selectedRun,
    catalog, runs, backend, run, providers,
    startDownload, deleteModel, startBenchmark, cancelBenchmark, refreshModels,
    benchmarkConfig, setBenchmarkConfig,
    onNavigate: handleNavigation,
  };

  // A benchmark keeps running in app state no matter where you navigate. This
  // banner is the way back to it, and shows live progress so it's never lost.
  const showRunBanner = run.running && currentView !== 'run';

  return (
    <div className="app">
      {currentView === 'dashboard' && <Dashboard {...shared} />}
      {currentView === 'registry' && <Registry {...shared} />}
      {currentView === 'detail' && <ModelDetail {...shared} />}
      {currentView === 'downloads' && <Downloads {...shared} />}
      {currentView === 'setup' && <Setup {...shared} />}
      {currentView === 'settings' && <Settings {...shared} />}
      {currentView === 'run' && <LiveRun {...shared} />}
      {currentView === 'results' && <Results {...shared} />}
      {currentView === 'report' && <RunReport {...shared} />}

      {showRunBanner && (
        <button className="run-banner" onClick={() => setCurrentView('run')}>
          <span className="pulse-dot"></span>
          <span className="run-banner-text">
            Benchmarking <b>{run.model?.name || 'model'}</b> · {Math.round(run.progress || 0)}%
          </span>
          <span className="run-banner-cta">View run →</span>
        </button>
      )}
    </div>
  );
}

export default App;
