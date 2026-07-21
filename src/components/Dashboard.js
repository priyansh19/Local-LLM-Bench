import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';
import { DASH_CATS, catBadge } from '../data/catalog';
import { buildLeaderboard, findModel, RUNS } from '../data/runs';

export default function Dashboard({ onNavigate, systemInfo, benchmarkConfig, setBenchmarkConfig, catalog, startDownload, startBenchmark}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);

  const installed = catalog.filter((m) => m.status === 'installed');
  const installedSize = installed.reduce((a, m) => a + m.sizeNum, 0);

  const allRuns = Object.values(RUNS).flat();
  const avgTps = allRuns.reduce((a, r) => a + r.tps, 0) / (allRuns.length || 1);

  const dashStats = [
    { k: 'Models benchmarked', v: String(Object.keys(RUNS).length) },
    { k: 'Total runs', v: String(allRuns.length) },
    { k: 'Avg throughput', v: `${avgTps.toFixed(0)} tok/s` },
    { k: 'Installed', v: `${installedSize.toFixed(1)} GB` },
  ];

  // The design surfaces one model per category, not an arbitrary top-3.
  const dashboardModels = DASH_CATS.map((cat) => {
    const m = catalog.find((x) => x.cat === cat) || catalog[0];
    const badge = catBadge(cat);
    return {
      ...m,
      catLabel: badge.label,
      catColor: badge.color,
      catBg: badge.bg,
      isInstalled: m.status === 'installed',
      isDownloading: m.status === 'downloading',
      isAvailable: m.status === 'available',
      pctStr: `${Math.round(m.pct)}%`,
    };
  });

  const { heads: lbHeads, rows: leaderboard } = buildLeaderboard();



  const navItems = buildNavItems('dashboard', catalog);

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
      <div className="screen-dashboard">
        <div className="screen-header">
          <div>
            <div className="screen-label">Home</div>
            <h1 className="screen-title">Welcome back.</h1>
          </div>
          <button className="btn-dark" onClick={() => onNavigate('setup')}>
            + New benchmark
          </button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {dashStats.map((stat, i) => (
            <div key={i} className="stat-card">
              <div className="stat-value">{stat.v}</div>
              <div className="stat-label">{stat.k}</div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="leaderboard-section">
          <div className="section-header">
            <span className="section-title">Leaderboard · top 3 benchmarked</span>
            <span className="section-subtitle">weighted across speed · latency · VRAM · reasoning</span>
          </div>
          <div className="leaderboard-table">
            <div className="leaderboard-header">
              <span>Model</span>
              {lbHeads.map((h) => (
                <span key={h}>{h}</span>
              ))}
              <span>Score</span>
            </div>
            {leaderboard.map((model) => (
              <div
                key={model.id}
                className="leaderboard-row"
                style={{ background: model.rowBg, cursor: 'pointer' }}
                onClick={() => onNavigate('detail', findModel(model.id))}
              >
                <span className="model-name">
                  {model.isTop && <span>🏆</span>}
                  {model.short}
                </span>
                {model.cells.map((cell, j) => (
                  <div key={j} className="metric-cell">
                    <div className="metric-value" style={{ color: cell.valColor }}>
                      {cell.value}
                    </div>
                    <div className="metric-bar-small">
                      <div className="metric-fill" style={{ background: cell.barColor, width: cell.pct }}></div>
                    </div>
                  </div>
                ))}
                <div className="score-cell">
                  <div className="score-value" style={{ color: model.scoreColor }}>{model.score}</div>
                  <div className="score-max">/100</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Models */}
        <div className="models-section">
          <div className="section-header">
            <span className="section-title">Latest in the registry</span>
            <span className="section-link" onClick={() => onNavigate('registry')}>Browse all →</span>
          </div>
          <div className="models-grid">
            {dashboardModels.map((model, i) => (
              <div key={i} className="model-card">
                <div className="model-header">
                  <span className="model-cat" style={{ '--hue': model.catColor, color: model.catColor, background: model.catBg }}>
                    {model.catLabel}
                  </span>
                  <span className="model-added">{model.added}</span>
                </div>
                <div className="model-name-big">{model.name}</div>
                <div className="model-meta">{model.vendor} · {model.params} · {model.sizeNum} GB</div>
                <div className="model-action" onClick={() => onNavigate('detail', model)} style={{ cursor: 'pointer' }}>
                  {model.isInstalled && (
                    <button
                      className="btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBenchmarkConfig?.((prev) => ({ ...prev, model }));
                        onNavigate('setup');
                      }}
                    >
                      ▶ Benchmark
                    </button>
                  )}
                  {model.isAvailable && (
                    <button
                      className="btn-download"
                      onClick={(e) => {
                        e.stopPropagation();
                        startDownload(model.id);
                      }}
                    >
                      Download
                    </button>
                  )}
                  {model.isDownloading && (
                    <div className="download-progress">
                      <div className="dl-label">Downloading</div>
                      <div className="progress-bar-small">
                        <div className="progress-fill" style={{ width: model.pctStr }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
