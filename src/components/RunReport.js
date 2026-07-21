import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';
import { RUNS, findModel } from '../data/runs';

const CIRC = 2 * Math.PI * 34;
const dashFor = (pct) => {
  const p = Math.round(pct);
  return `${((p / 100) * CIRC).toFixed(1)} ${(CIRC - (p / 100) * CIRC).toFixed(1)}`;
};

export default function RunReport({
  selectedRun,
  selectedModel,
  onNavigate,
  systemInfo,
  benchmarkConfig,
  setBenchmarkConfig,
  catalog, startBenchmark}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);

  const run = selectedRun || RUNS.qwen2vl[0];
  const modelName = selectedModel?.name || findModel('qwen2vl')?.name || 'Qwen2-VL';

  // The design assumes a 12 GB card for headroom; use the real figure when we
  // actually know it.
  const vramTotal = systemInfo?.vram || 12;

  const rings = [];
  if (run.img) rings.push({ name: 'Image accuracy', pct: Math.round(run.img), color: 'var(--orange)' });
  if (run.reason) rings.push({ name: 'Text reasoning', pct: Math.round(run.reason), color: 'var(--ink)' });
  rings.push({
    name: 'VRAM headroom',
    pct: Math.max(0, Math.round(((vramTotal - run.vram) / vramTotal) * 100)),
    color: 'var(--ring-3)',
  });

  const metrics = [
    { label: 'Tokens / sec', value: run.tps, unit: 'tok/s', color: 'var(--orange)' },
    { label: 'Time to first token', value: run.ttft, unit: 'ms', color: 'var(--ink)' },
    { label: 'VRAM peak', value: run.vram, unit: 'GB', color: 'var(--ink)' },
  ];

  const cfg = [
    { k: 'Provider', v: run.provider },
    { k: 'Precision', v: run.precision },
    { k: 'Temperature', v: run.temp },
    { k: 'Top-p', v: run.topP },
    { k: 'Context', v: run.ctx },
    { k: 'GPU layers', v: `${run.gpu}/33` },
  ];

  const navItems = buildNavItems('report', catalog);

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
      <div className="screen-report">
        <div className="back-link" onClick={() => onNavigate('detail', selectedModel)}>
          ← {modelName}
        </div>

        <div className="report-header">
          <div>
            <div className="screen-label">Run report</div>
            <h1 className="report-title">{modelName}</h1>
            <div className="report-date">
              {run.date} · {run.suite}
            </div>
          </div>
          <div className="report-actions">
            <span className="verdict-badge">🏆 {run.verdict}</span>
            <button className="btn-dark" onClick={() => onNavigate('setup')}>
              Re-run these settings
            </button>
          </div>
        </div>

        <div className="block-title">Configuration used</div>
        <div className="cfg-grid">
          {cfg.map((c) => (
            <div key={c.k} className="cfg-card">
              <div className="cfg-label">{c.k}</div>
              <div className="cfg-value">{c.v}</div>
            </div>
          ))}
        </div>

        <div className="block-title">Results</div>
        <div className="results-grid">
          {metrics.map((m) => (
            <div key={m.label} className="result-card">
              <div className="result-label">{m.label}</div>
              <div className="report-metric-value" style={{ color: m.color }}>
                {m.value}
                <span className="result-unit"> {m.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Scorecard — one ring per scored dimension */}
        <div className="scorecard">
          <div className="block-title">Scorecard</div>
          <div className="scorecard-rings">
            {rings.map((t) => (
              <div key={t.name} className="scorecard-ring">
                <div className="ring-wrap">
                  <svg viewBox="0 0 88 88" className="ring-svg">
                    <circle cx="44" cy="44" r="34" fill="none" stroke="var(--track-2)" strokeWidth="9" />
                    <circle
                      cx="44"
                      cy="44"
                      r="34"
                      fill="none"
                      stroke={t.color}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={dashFor(t.pct)}
                    />
                  </svg>
                  <div className="ring-pct">{t.pct}</div>
                </div>
                <div className="ring-name">{t.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sample output */}
        <div className="sample-output">
          <div className="sample-output-label">Sample output</div>
          <div className="sample-output-text">{run.output}</div>
        </div>
      </div>
    </Layout>
  );
}
