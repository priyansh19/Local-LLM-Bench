import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';
import ConfirmDelete from './ConfirmDelete';
import { badgesOf } from '../data/catalog';

const DL_SPEEDS = { llama32v: '38 MB/s', gemma2: '22 MB/s' };

export default function Downloads({ onNavigate, systemInfo, benchmarkConfig, setBenchmarkConfig, catalog, deleteModel, startBenchmark}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const activeDl = catalog.filter((m) => m.status === 'downloading').map((m) => ({
    id: m.id,
    name: m.name,
    params: m.params,
    pctStr: `${Math.round(m.pct)}%`,
    dlOf: `${((m.sizeNum * m.pct) / 100).toFixed(1)} / ${m.sizeNum} GB`,
    speed: DL_SPEEDS[m.id] || '18 MB/s',
  }));

  const installedArr = catalog.filter((m) => m.status === 'installed');
  const installedSize = installedArr.reduce((a, m) => a + m.sizeNum, 0);

  const navItems = buildNavItems('downloads', catalog);
  const confirmModel = catalog.find((m) => m.id === confirmId);

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
      <div className="screen-downloads">
        <div className="screen-label">Downloads &amp; Storage</div>
        <h1 className="screen-title">Your model library</h1>
        <p className="screen-description">
          Models are stored in <span className="path">C:\LLMBench\models\</span>
        </p>

        {activeDl.length > 0 && (
          <div className="active-downloads">
            <div className="block-title dl-now">
              <span className="pulse-dot"></span>
              Downloading now
            </div>
            <div className="download-list">
              {activeDl.map((m) => (
                <div key={m.id} className="download-item">
                  <div className="download-header">
                    <div>
                      <span className="dl-name">{m.name}</span>
                      <span className="dl-params">{m.params}</span>
                    </div>
                    <div className="dl-progress">
                      {m.dlOf} · {m.speed}
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: m.pctStr }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="installed-section">
          <div className="installed-header">
            <span>Installed · {installedArr.length}</span>
            <span className="installed-size">{installedSize.toFixed(1)} GB on disk</span>
          </div>

          <div className="installed-list">
            {installedArr.map((m) => (
              <div key={m.id} className="installed-item">
                <div className="installed-info">
                  <div className="installed-name">
                    <span>{m.name}</span>
                    <span className="installed-params">{m.params}</span>
                  </div>
                  <div className="installed-path">…\models\{m.folder}</div>
                </div>

                <div className="installed-badges">
                  {badgesOf(m).map((b) => (
                    <span key={b.label} className="model-badge" style={{ '--hue': b.color, color: b.color, background: b.bg }}>
                      {b.label}
                    </span>
                  ))}
                </div>

                <div className="installed-size-display">
                  {m.sizeNum}
                  <span>GB</span>
                </div>

                <div className="installed-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setBenchmarkConfig?.((prev) => ({ ...prev, model: m }));
                      onNavigate('setup');
                    }}
                  >
                    Benchmark
                  </button>
                  <button className="btn-danger" onClick={() => setConfirmId(m.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDelete
        model={confirmModel}
        onCancel={() => setConfirmId(null)}
        onConfirm={(m) => {
          deleteModel(m.id);
          setConfirmId(null);
        }}
      />
    </Layout>
  );
}
