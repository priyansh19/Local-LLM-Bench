import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';

function statusOf(p) {
  if (p.running) return { dot: 'ok', text: 'Running' };
  if (p.installed) return { dot: 'warn', text: 'Installed · not running' };
  return { dot: 'off', text: 'Not installed' };
}

export default function Settings({
  onNavigate,
  systemInfo,
  benchmarkConfig,
  setBenchmarkConfig,
  catalog,
  providers,
  runs,
  refreshModels,
  startBenchmark,
}) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navItems = buildNavItems('settings', catalog);

  const provList = providers?.providers || [];
  const installedCount = catalog.filter((m) => m.status === 'installed').length;
  const availableCount = catalog.filter((m) => m.status === 'available').length;

  const open = (url) => window.electron?.openExternal?.(url);

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
      <div className="screen-settings">
        <div className="screen-label">Settings</div>
        <h1 className="screen-title">Engines &amp; configuration</h1>
        <p className="screen-subtitle">
          Benchmarks run against a local inference engine. Install one to download and test models on your own
          hardware.
        </p>

        {/* Inference providers */}
        <div className="settings-block">
          <div className="setup-section-label">Inference providers</div>
          <div className="provider-list">
            {provList.length === 0 && (
              <div className="no-runs">Detecting local inference engines…</div>
            )}
            {provList.map((p) => {
              const st = statusOf(p);
              return (
                <div key={p.id} className={`provider-row ${p.primary ? 'is-primary' : ''}`}>
                  <div className={`prov-dot ${st.dot}`}></div>
                  <div className="prov-main">
                    <div className="prov-head">
                      <span className="prov-name">{p.label}</span>
                      <span className="prov-tag">{p.tag}</span>
                      {p.primary && <span className="prov-badge">used for benchmarks</span>}
                    </div>
                    <div className="prov-note">{p.note}</div>
                  </div>
                  <div className="prov-status">{st.text}</div>
                  <div className="prov-action">
                    {!p.installed ? (
                      <button className="btn-download" onClick={() => open(p.install)}>
                        Get {p.label}
                      </button>
                    ) : !p.running ? (
                      <button className="btn-secondary" onClick={() => refreshModels?.()}>
                        Re-check
                      </button>
                    ) : (
                      <button className="btn-secondary" onClick={() => open(p.install)}>
                        Docs
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="settings-hint">
            Only <b>Ollama</b> is wired for benchmarking today. It streams real token timings the app measures
            directly.
          </div>
        </div>

        {/* Models */}
        <div className="settings-block">
          <div className="setup-section-label">Models</div>
          <div className="settings-cards">
            <div className="settings-stat">
              <div className="settings-stat-value">{installedCount}</div>
              <div className="settings-stat-label">installed on disk</div>
            </div>
            <div className="settings-stat">
              <div className="settings-stat-value">{availableCount}</div>
              <div className="settings-stat-label">available to install</div>
            </div>
            <div className="settings-stat">
              <div className="settings-stat-value">{runs?.length || 0}</div>
              <div className="settings-stat-label">saved benchmark runs</div>
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn-dark" onClick={() => onNavigate('registry')}>
              Browse &amp; install models →
            </button>
            {(runs?.length || 0) > 0 && (
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await window.electron?.clearRuns?.();
                  await refreshModels?.();
                  setBusy(false);
                }}
              >
                Clear run history
              </button>
            )}
          </div>
        </div>

        {/* This machine */}
        <div className="settings-block">
          <div className="setup-section-label">This machine</div>
          <div className="settings-cards">
            <div className="settings-stat wide">
              <div className="settings-stat-value sm">{systemInfo?.gpu || '—'}</div>
              <div className="settings-stat-label">GPU</div>
            </div>
            <div className="settings-stat wide">
              <div className="settings-stat-value sm">{systemInfo?.cpu || '—'}</div>
              <div className="settings-stat-label">CPU · {systemInfo?.cores ?? '—'} cores</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
