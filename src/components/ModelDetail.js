import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';
import { SOURCE_LABELS, catBadge, badgesOf } from '../data/catalog';
import ConfirmDelete from './ConfirmDelete';
import { runsFor, cardMetaFor, findModel } from '../data/runs';

export default function ModelDetail({
  selectedModel,
  onNavigate,
  systemInfo,
  benchmarkConfig,
  setBenchmarkConfig,
  catalog,
  startDownload,
  deleteModel, startBenchmark}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Resolve against live catalog state so status changes (download/delete) are
  // reflected here. Fall back to the passed record, then the first catalog
  // entry — but never assume a specific hardcoded id exists.
  const dm =
    catalog.find((m) => m.id === selectedModel?.id) ||
    catalog.find((m) => m.name === selectedModel?.name) ||
    selectedModel ||
    catalog[0];

  // The catalog can be genuinely empty (backend down, no models) — render a
  // graceful empty state instead of dereferencing undefined into a white screen.
  if (!dm) {
    const navItems = buildNavItems('detail', catalog);
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
        <div className="screen-detail">
          <div className="back-link" onClick={() => onNavigate('registry')}>
            ← Registry
          </div>
          <div className="no-runs">
            This model is no longer available. It may have been deleted or the backend is offline.
          </div>
        </div>
      </Layout>
    );
  }

  const cm = cardMetaFor(dm);
  const cat = catBadge(dm.cat);
  const dmRuns = runsFor(dm.id);
  const sourceLabel = SOURCE_LABELS[dm.source] || dm.source || '—';
  const isInstalled = dm.status === 'installed';
  const mods = (dm.mods || ['text']).join(' + ');

  const specs = [
    { k: 'Parameters', v: dm.params },
    { k: 'Quant', v: dm.quant },
    { k: 'On disk', v: `${dm.sizeNum} GB` },
    { k: 'Downloads', v: dm.downloads },
  ];

  const cardRows = [
    { k: 'License', v: cm.license },
    { k: 'Architecture', v: cm.arch },
    { k: 'Parameters', v: dm.params },
    { k: 'Tensor type', v: cm.tensor },
    { k: 'Languages', v: cm.langs },
    { k: 'Added', v: dm.added },
  ];

  const detailRuns = dmRuns.map((r) => ({
    ...r,
    metricsLine: `${r.tps} tok/s · ${r.ttft} ms TTFT · ${r.vram} GB VRAM`,
    chips: [r.provider, r.precision, `temp ${r.temp}`, `ctx ${r.ctx}`, `gpu ${r.gpu}/33`],
  }));

  // Only claim a fit when the GPU's VRAM is actually known.
  const vram = systemInfo?.vram;
  const gpuName = systemInfo?.gpu;
  const needed = Math.round((dm.sizeNum * 1.25 + 0.6) * 10) / 10;

  let fitText;
  if (vram) {
    const fits = needed <= vram;
    fitText = (
      <>
        <b>{fits ? `Fits your ${gpuName}.` : `Too large for your ${gpuName}.`}</b> Needs ≈ {needed} GB VRAM at{' '}
        {dm.quant} against {vram} GB available
        {fits ? ' — leaves room for a 4K context window.' : ' — expect CPU offload and much lower throughput.'}
      </>
    );
  } else if (gpuName) {
    fitText = (
      <>
        <b>Detected {gpuName}.</b> VRAM telemetry needs <code>nvidia-smi</code>, which isn’t available on this
        machine, so fit can’t be estimated. The {dm.sizeNum} GB of weights still need to fit in VRAM to run on GPU.
      </>
    );
  } else {
    fitText = <b>Detecting GPU…</b>;
  }

  const navItems = buildNavItems('detail', catalog);

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
      <div className="screen-detail">
        <div className="back-link" onClick={() => onNavigate('registry')}>
          ← Registry
        </div>

        <div className="detail-header">
          <div>
            <div className="screen-label">
              {dm.vendor} · {sourceLabel}
            </div>
            <h1 className="detail-title">{dm.name}</h1>
            <div className="detail-badges">
              <span className="model-badge" style={{ '--hue': cat.color, color: cat.color, background: cat.bg }}>
                {cat.label}
              </span>
              {badgesOf(dm).map((b) => (
                <span key={b.label} className="model-badge" style={{ '--hue': b.color, color: b.color, background: b.bg }}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="detail-actions">
            {isInstalled ? (
              <>
                <button
                  className="btn-dark"
                  onClick={() => {
                    setBenchmarkConfig?.((prev) => ({ ...prev, model: dm }));
                    onNavigate('setup');
                  }}
                >
                  ▶ Benchmark
                </button>
                <button className="btn-danger" onClick={() => setConfirmOpen(true)}>Delete files</button>
              </>
            ) : (
              <button className="btn-download" onClick={() => startDownload(dm.id)}>
                Download · {dm.sizeNum} GB
              </button>
            )}
          </div>
        </div>

        <p className="detail-description">
          {dm.name} ({dm.params}, {dm.quant}) is a {mods} model from {dm.vendor}. Quantized for on-device
          inference, it targets laptops with 8–12 GB of VRAM. Download it to run the full multimodal benchmark
          suite on your own hardware.
        </p>

        <div className="specs-grid">
          {specs.map((s) => (
            <div key={s.k} className="spec-card">
              <div className="spec-label">{s.k}</div>
              <div className="spec-value">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="fit-notice">
          <div className="fit-icon">✦</div>
          <div className="fit-text">{fitText}</div>
        </div>

        <div className="model-card-section">
          <div className="model-card-header">
            <span>Model card</span>
            <span className="source-hint">pulled from {sourceLabel} · cached locally</span>
          </div>
          <div className="model-card-content">
            <div className="card-rows">
              {cardRows.map((row) => (
                <div key={row.k}>
                  <div className="card-row-label">{row.k}</div>
                  <div className="card-row-value">{row.v}</div>
                </div>
              ))}
            </div>
            <p className="card-readme">
              {dm.name} ships GGUF weights quantized for llama.cpp and Ollama runtimes. This card is pulled from{' '}
              {sourceLabel} at download time and cached locally alongside the model files, so it stays available
              offline. Recommended for on-device {mods} inference on 8–12 GB GPUs.
            </p>
          </div>
        </div>

        <div className="runs-section">
          <div className="runs-header">
            <span>Runs on this machine</span>
            <span className="runs-count">
              {dmRuns.length} previous runs{gpuName ? ` · ${gpuName}` : ''}
            </span>
          </div>
          {detailRuns.length > 0 ? (
            <div className="runs-list">
              {detailRuns.map((run) => (
                <div key={run.id} className="run-item" onClick={() => onNavigate('report', { run, model: dm })}>
                  <div className="run-date">
                    <div className="run-date-str">{run.date}</div>
                    <div className="run-ago">{run.ago}</div>
                  </div>
                  <div className="run-metrics">
                    <div className="run-metrics-line">{run.metricsLine}</div>
                    <div className="run-chips">
                      {run.chips.map((chip) => (
                        <span key={chip} className="chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="run-link">View report →</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-runs">
              No runs yet on this machine — run a benchmark to start building history.
            </div>
          )}
        </div>
      </div>

      <ConfirmDelete
        model={confirmOpen ? dm : null}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={(m) => {
          deleteModel(m.id);
          setConfirmOpen(false);
        }}
      />
    </Layout>
  );
}
