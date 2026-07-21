import React, { useState, useEffect, useRef } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';

const TASK_LABELS = {
  throughput: 'Tokens / sec',
  ttft: 'Time to first token',
  vision: 'Image understanding',
  audio: 'Audio transcription',
  reasoning: 'Text reasoning',
  memory: 'Memory & VRAM',
};

const CIRC = 2 * Math.PI * 34;

export default function LiveRun({
  onNavigate,
  systemInfo,
  benchmarkConfig,
  setBenchmarkConfig,
  catalog,
  run,
  cancelBenchmark, startBenchmark}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [outputOverflows, setOutputOverflows] = useState(false);
  const outputRef = useRef(null);

  // Only advance the elapsed clock while the run is actually going, so a
  // finished/errored run shows a frozen final time instead of ticking forever.
  useEffect(() => {
    if (!run?.running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [run?.running]);

  const sel = benchmarkConfig?.model || catalog?.[0] || { name: '—', quant: '—', mods: ['text'] };
  const tasks = benchmarkConfig?.tasks || {};
  const points = run?.points || [];
  const progPct = Math.round(run?.progress || 0);
  const elapsedSecs = run?.startedAt ? Math.floor((now - run.startedAt) / 1000) : 0;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Ollama generates text only. A model without vision can't be benchmarked on
  // images, and there is no audio model here at all — say so rather than
  // animating a fake diffusion preview or waveform.
  const visionSkipped = tasks.vision && !sel.hasVision;

  const lastTps = points.length ? points[points.length - 1] : null;
  const metrics = [
    { label: 'Tokens / sec', value: lastTps != null ? lastTps.toFixed(1) : '—', unit: lastTps != null ? 'tok/s' : '' },
    {
      label: 'Time to first token',
      value: run?.ttftMs != null ? Math.round(run.ttftMs) : '—',
      unit: run?.ttftMs != null ? 'ms' : '',
    },
    { label: 'Tokens generated', value: run?.tokens || 0, unit: '' },
    {
      label: 'GPU / CPU',
      value: `${systemInfo?.gpuPct != null ? systemInfo.gpuPct.toFixed(0) : '—'} / ${
        systemInfo?.cpuPct != null ? systemInfo.cpuPct.toFixed(0) : '—'
      }`,
      unit: '%',
    },
  ];

  // Auto-scale the chart to the real throughput actually observed, instead of
  // the design's fixed 20–74 band which assumed a specific GPU.
  const chart = (() => {
    const W = 680;
    const H = 150;
    const pad = 6;
    if (points.length < 2) return { line: '', area: '', lo: 0, hi: 0 };
    const lo = Math.min(...points) * 0.9;
    const hi = Math.max(...points) * 1.1 || 1;
    const xs = (i) => pad + (i / Math.max(1, points.length - 1)) * (W - 2 * pad);
    const ys = (v) => H - pad - ((v - lo) / Math.max(0.001, hi - lo)) * (H - 2 * pad);
    let line = `M${xs(0).toFixed(1)} ${ys(points[0]).toFixed(1)}`;
    for (let i = 1; i < points.length; i++) line += ` L${xs(i).toFixed(1)} ${ys(points[i]).toFixed(1)}`;
    const area = `${line} L${xs(points.length - 1).toFixed(1)} ${H} L${xs(0).toFixed(1)} ${H} Z`;
    return { line, area, lo, hi };
  })();

  const taskColors = ['var(--orange)', 'var(--ink-4)', 'var(--ink-5)', 'var(--ink-3)', 'var(--bar-idle)', 'var(--nav-idle)'];
  const activeKeys = Object.keys(TASK_LABELS).filter((k) => tasks[k]);
  const doneKey = run?.task;
  const doneIdx = activeKeys.indexOf(doneKey);
  const taskProgress = activeKeys.map((k, i) => {
    // A task is complete once the runner has moved past it; the current one
    // tracks the live progress figure.
    const pct = i < doneIdx ? 100 : i === doneIdx ? progPct : 0;
    return {
      name: TASK_LABELS[k],
      pct,
      color: taskColors[i % taskColors.length],
      dash: `${((pct / 100) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`,
    };
  });

  const navItems = buildNavItems('run', catalog);
  const precision = sel.quant || benchmarkConfig?.precision || '—';

  // Keep the streamed output pinned to a 6-line window: follow the newest tokens
  // while collapsed, and reveal the "Show more" affordance only once it actually
  // overflows, so the panel never grows without bound.
  const outputText = run?.text || '';
  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    setOutputOverflows(el.scrollHeight > el.clientHeight + 2);
    if (!outputExpanded) el.scrollTop = el.scrollHeight;
  }, [outputText, outputExpanded, run?.running]);

  const PROV_LABELS = { ollama: 'Ollama', vllm: 'vLLM', lmstudio: 'LM Studio', llamacpp: 'llama.cpp' };
  const provLabel = PROV_LABELS[run?.provider || benchmarkConfig?.provider] || 'Ollama';

  return (
    <Layout
      navItems={navItems}
      systemInfo={systemInfo}
      startBenchmark={startBenchmark}
      benchmarkConfig={benchmarkConfig}
      setBenchmarkConfig={setBenchmarkConfig}
      isTunerOpen={isTunerOpen}
      setIsTunerOpen={setIsTunerOpen}
      onNavigate={onNavigate}
    >
      <div className="screen-run">
        <div className="run-header">
          <div>
            <div className="run-status">
              {run?.running && <span className="pulse-dot"></span>}
              {run?.error ? 'Run failed' : run?.running ? `Running · ${TASK_LABELS[run.task] || 'starting'}` : 'Finished'}
            </div>
            <h1 className="run-title">{sel.name}</h1>
            <div className="run-details">
              via {provLabel} · {precision}
            </div>
          </div>
          <div className="run-progress-info">
            <div className="run-progress-pct">{progPct}%</div>
            <div className="run-progress-time">{fmt(elapsedSecs)} elapsed</div>
          </div>
        </div>

        <div className="run-progress-bar">
          <div className="progress-fill" style={{ width: `${progPct}%` }}></div>
        </div>

        {run?.error && <div className="run-error">{run.error}</div>}

        <div className="metrics-grid">
          {metrics.map((m) => (
            <div key={m.label} className="metric-card">
              <div className="metric-card-label">{m.label}</div>
              <div className="metric-card-value">
                {m.value}
                {m.unit && <span className="metric-unit"> {m.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="live-panels">
          {visionSkipped && (
            <div className="live-panel skip-panel">
              <div className="panel-title">Image understanding · skipped</div>
              <div className="skip-reason">
                {sel.name} reports no vision support, so there is no image benchmark to run. Pull a vision model
                (e.g. <code>llava</code>) to enable this task.
              </div>
            </div>
          )}
          {tasks.audio && (
            <div className="live-panel skip-panel">
              <div className="panel-title">Audio transcription · skipped</div>
              <div className="skip-reason">
                No audio-capable model is installed under Ollama, so there is no speech benchmark to run.
              </div>
            </div>
          )}

          {/* Real model output, streamed token by token as it is generated. */}
          <div className="live-panel text-panel">
            <div className="panel-title">
              Live output{run?.task ? ` · ${TASK_LABELS[run.task]}` : ''}
            </div>
            <div
              ref={outputRef}
              className={`output-text ${outputExpanded ? 'is-expanded' : 'is-clamped'}`}
            >
              {outputText || (run?.running ? 'Waiting for first token…' : 'No output yet.')}
              {run?.running && <span className="output-cursor">▋</span>}
            </div>
            {(outputOverflows || outputExpanded) && (
              <button className="show-more-btn" onClick={() => setOutputExpanded((v) => !v)}>
                {outputExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="live-panel chart-panel">
            <div className="panel-header">
              <span className="panel-title">Throughput</span>
              <span className="panel-mono">
                {points.length > 1
                  ? `${chart.lo.toFixed(0)}–${chart.hi.toFixed(0)} tok/s · measured`
                  : 'awaiting tokens'}
              </span>
            </div>
            <svg className="throughput-chart" viewBox="0 0 680 150" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--orange)" stopOpacity="0.28" />
                  <stop offset="1" stopColor="var(--orange)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#ag)" />
              <path
                d={chart.line}
                stroke="var(--orange)"
                strokeWidth="2.5"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <div className="task-progress-section">
          <div className="block-title">Suite progress</div>
          <div className="task-progress-grid">
            {taskProgress.map((t) => (
              <div key={t.name} className="task-progress-item">
                <div className="circular-progress">
                  <svg viewBox="0 0 82 82" className="progress-svg">
                    <circle cx="41" cy="41" r="34" fill="none" stroke="var(--track-2)" strokeWidth="8" />
                    <circle
                      cx="41"
                      cy="41"
                      r="34"
                      fill="none"
                      stroke={t.color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={t.dash}
                      className="progress-circle"
                    />
                  </svg>
                  <div className="progress-text">{t.pct}</div>
                </div>
                <div className="task-name">{t.name}</div>
              </div>
            ))}
          </div>
        </div>

        {run?.running && (
          <div className="run-actions">
            <button className="btn-secondary" onClick={cancelBenchmark}>
              Cancel run
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
