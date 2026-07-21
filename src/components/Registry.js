import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';
import { SOURCE_LABELS, badgesOf, bySource } from '../data/catalog';
import ConfirmDelete from './ConfirmDelete';

// Ollama shows the merged local catalog; Hugging Face and LM Studio do a LIVE
// search against their registries and install on demand.
const SOURCE_ORDER = ['ollama', 'huggingface', 'lmstudio'];
const LIVE_SOURCES = new Set(['huggingface', 'lmstudio']);

// Prefer a broadly-compatible mid-size quant when the user hasn't chosen one.
const QUANT_PREFERENCE = ['Q4_K_M', 'Q4_0', 'Q5_K_M', 'Q4_K_S', 'Q8_0', 'F16'];
function pickQuant(quants) {
  const names = quants.map((q) => q.quant);
  for (const pref of QUANT_PREFERENCE) if (names.includes(pref)) return pref;
  return names[0] || null;
}

export default function Registry({
  onNavigate,
  systemInfo,
  benchmarkConfig,
  setBenchmarkConfig,
  catalog: allModels,
  startDownload,
  deleteModel,
  startBenchmark,
  backend,
  refreshModels,
}) {
  const [activeSource, setActiveSource] = useState('ollama');
  const [isTunerOpen, setIsTunerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  // Live-search state (HF / LM Studio).
  const [remoteResults, setRemoteResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  // key -> { pct, status, error } for in-flight installs from a live registry.
  const [pulls, setPulls] = useState({});
  const searchSeq = useRef(0);

  const selId = benchmarkConfig?.model?.id;
  const isLive = LIVE_SOURCES.has(activeSource);
  const sourceLabel = SOURCE_LABELS[activeSource] || activeSource;

  // ---- Ollama tab: the merged local catalog ----
  const localCatalog = useMemo(() => bySource(allModels, 'ollama'), [allModels]);
  const localShown = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return localCatalog;
    return localCatalog.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.vendor || '').toLowerCase().includes(q)
    );
  }, [localCatalog, searchTerm]);

  // ---- Live search (debounced), cancel-safe via a sequence guard ----
  useEffect(() => {
    if (!isLive) return undefined;
    if (!window.electron?.registrySearch) {
      setRemoteResults([]);
      setSearchError('Live registry search needs the desktop app.');
      return undefined;
    }
    const q = searchTerm.trim();
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await window.electron.registrySearch(activeSource, q || 'gguf');
        if (seq !== searchSeq.current) return; // a newer search superseded this one
        setRemoteResults(res.ok ? res.models : []);
        setSearchError(res.ok ? null : res.error);
      } catch (e) {
        if (seq === searchSeq.current) setSearchError(e.message);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [isLive, activeSource, searchTerm]);

  // ---- Track install progress pushed from the main process ----
  useEffect(() => {
    if (!window.electron?.onRegistryPullProgress) return undefined;
    const off = window.electron.onRegistryPullProgress((p) => {
      setPulls((prev) => {
        const cur = prev[p.key] || {};
        const next = {
          ...cur,
          pct: p.pct != null ? p.pct : cur.pct,
          status: p.status || cur.status || 'downloading',
          error: p.error || null,
          line: p.line || cur.line,
        };
        return { ...prev, [p.key]: next };
      });
      if (p.status === 'success') {
        refreshModels?.();
        // Clear the finished chip shortly after so the row flips to "installed".
        setTimeout(() => setPulls((prev) => {
          const n = { ...prev };
          delete n[p.key];
          return n;
        }), 1500);
      }
    });
    return off;
  }, [refreshModels]);

  const installRemote = useCallback(
    async (model) => {
      if (!window.electron?.registryPull) return;
      const key = `${activeSource}:${model.id}`;
      setPulls((prev) => ({ ...prev, [key]: { pct: 0, status: 'resolving' } }));
      try {
        // Choose a quant the repo actually offers.
        let quant = null;
        if (window.electron.registryQuants) {
          const q = await window.electron.registryQuants(model.id);
          if (q.ok) quant = pickQuant(q.quants);
        }
        setPulls((prev) => ({ ...prev, [key]: { pct: 0, status: 'downloading', quant } }));
        const res = await window.electron.registryPull(activeSource, model.id, quant, key);
        if (!res.ok) {
          setPulls((prev) => ({ ...prev, [key]: { pct: prev[key]?.pct || 0, status: 'error', error: res.error } }));
        }
      } catch (e) {
        setPulls((prev) => ({ ...prev, [key]: { status: 'error', error: e.message } }));
      }
    },
    [activeSource]
  );

  const navItems = buildNavItems('registry', allModels);

  const catalogInfo = isLive
    ? searching
      ? `Searching ${sourceLabel}…`
      : searchError
      ? `${sourceLabel} search failed — ${searchError}`
      : `${remoteResults.length} results from ${sourceLabel}${searchTerm ? ` for “${searchTerm}”` : ''}`
    : backend?.live
    ? `${localShown.length} models · read live from your local Ollama install`
    : backend?.checked
    ? `Backend unavailable — ${backend.error}`
    : 'Reading local models…';

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
      <div className="screen-registry">
        <div className="screen-header">
          <div>
            <div className="screen-label">Model Registry</div>
            <h1 className="screen-title">
              Find the model
              <br />
              that runs best.
            </h1>
          </div>
          <button className="btn-dark" onClick={() => onNavigate('setup')}>
            + New benchmark
          </button>
        </div>

        <div className="source-tabs">
          <div className="tabs">
            {SOURCE_ORDER.map((id) => (
              <div
                key={id}
                className={`tab ${activeSource === id ? 'active' : ''}`}
                onClick={() => {
                  setActiveSource(id);
                  setSearchTerm('');
                }}
              >
                {activeSource === id && <span className="tab-dot"></span>}
                {SOURCE_LABELS[id] || id}
              </div>
            ))}
          </div>
          <div className="search-box">
            <div className="search-icon"></div>
            <input
              type="text"
              placeholder={isLive ? `Search ${sourceLabel} models…` : `Filter ${sourceLabel}…`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="catalog-info">{catalogInfo}</div>

        {/* ---- Ollama (local merged catalog) ---- */}
        {!isLive && (
          <div className="model-rows">
            {localShown.length === 0 ? (
              <div className="no-runs">No models match “{searchTerm}” in {sourceLabel}.</div>
            ) : (
              localShown.map((m) => (
                <div
                  key={m.id}
                  className={`model-row ${m.id === selId ? 'is-selected' : ''} ${
                    m.status === 'available' ? 'is-uninstalled' : ''
                  }`}
                >
                  <div className="model-row-left">
                    <div className="model-row-head">
                      <span className="model-row-title" onClick={() => onNavigate('detail', m)}>
                        {m.name}
                      </span>
                      <span className="model-row-params">{m.params}</span>
                      {m.status === 'installed' && <span className="installed-badge">installed</span>}
                      {m.status === 'available' && <span className="notinstalled-badge">not installed</span>}
                    </div>
                    <div className="model-badges">
                      {badgesOf(m).map((b) => (
                        <span key={b.label} className="model-badge" style={{ '--hue': b.color, color: b.color, background: b.bg }}>
                          {b.label}
                        </span>
                      ))}
                      {m.downloads && <span className="downloads-badge">↓ {m.downloads}</span>}
                    </div>
                  </div>

                  <div className="model-row-right">
                    <div className="model-size">
                      {m.sizeIsEstimate ? '~' : ''}
                      {m.sizeNum}
                      <span>GB</span>
                    </div>
                    <div className="model-quant">{m.quant}</div>
                  </div>

                  <div className="model-row-actions">
                    {m.status === 'available' && (
                      <button
                        className="btn-download"
                        disabled={!backend?.ollamaUp}
                        title={backend?.ollamaUp ? `ollama pull ${m.tag}` : 'Start Ollama to install models'}
                        onClick={() => startDownload(m.id)}
                      >
                        Install
                      </button>
                    )}
                    {m.status === 'downloading' && (
                      <div className="download-progress" style={{ width: 150 }}>
                        <div className="download-progress-head">
                          <span>Downloading</span>
                          <span className="download-progress-pct">{Math.round(m.pct)}%</span>
                        </div>
                        <div className="progress-bar-small">
                          <div className="progress-fill" style={{ width: `${m.pct}%` }}></div>
                        </div>
                      </div>
                    )}
                    {m.status === 'installed' && (
                      <>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            setBenchmarkConfig?.((prev) => ({ ...prev, model: m }));
                            onNavigate('setup');
                          }}
                        >
                          ▶ Benchmark
                        </button>
                        <button className="btn-delete" title="Delete files" onClick={() => setConfirmId(m.id)}>
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ---- Hugging Face / LM Studio (live search + install) ---- */}
        {isLive && (
          <div className="model-rows">
            {!searching && !searchError && remoteResults.length === 0 && (
              <div className="no-runs">No models found. Try a different search.</div>
            )}
            {remoteResults.map((m) => {
              const key = `${activeSource}:${m.id}`;
              const pull = pulls[key];
              const alreadyInstalled = allModels.some(
                (x) => x.status === 'installed' && (x.id === m.id || x.name === m.name)
              );
              return (
                <div key={m.id} className="model-row">
                  <div className="model-row-left">
                    <div className="model-row-head">
                      <span className="model-row-title">{m.name}</span>
                      {m.gated && <span className="notinstalled-badge">gated</span>}
                      {alreadyInstalled && <span className="installed-badge">installed</span>}
                    </div>
                    <div className="model-badges">
                      <span className="model-row-params">{m.vendor}</span>
                      {m.downloads != null && <span className="downloads-badge">↓ {m.downloads.toLocaleString()}</span>}
                      {m.likes != null && <span className="downloads-badge">♥ {m.likes}</span>}
                    </div>
                  </div>

                  <div className="model-row-actions" style={{ marginLeft: 'auto' }}>
                    {pull && pull.status !== 'error' ? (
                      <div className="download-progress" style={{ width: 190 }}>
                        <div className="download-progress-head">
                          <span>
                            {pull.status === 'resolving'
                              ? 'Resolving…'
                              : pull.status === 'success'
                              ? 'Installed ✓'
                              : `Downloading${pull.quant ? ` · ${pull.quant}` : ''}`}
                          </span>
                          {pull.pct != null && <span className="download-progress-pct">{Math.round(pull.pct)}%</span>}
                        </div>
                        <div className="progress-bar-small">
                          <div className="progress-fill" style={{ width: `${pull.pct || (pull.status === 'success' ? 100 : 5)}%` }}></div>
                        </div>
                      </div>
                    ) : pull && pull.status === 'error' ? (
                      <div className="pull-error" title={pull.error}>
                        Failed · retry
                        <button className="btn-download" onClick={() => installRemote(m)} style={{ marginLeft: 8 }}>
                          Retry
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-download"
                        disabled={!backend?.ollamaUp && activeSource === 'huggingface'}
                        title={
                          activeSource === 'huggingface'
                            ? backend?.ollamaUp
                              ? `Download via Ollama (hf.co/${m.id})`
                              : 'Start Ollama to install Hugging Face models'
                            : `Download via LM Studio (lms get ${m.id})`
                        }
                        onClick={() => installRemote(m)}
                      >
                        {alreadyInstalled ? 'Reinstall' : 'Install'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDelete
        model={allModels.find((m) => m.id === confirmId)}
        onCancel={() => setConfirmId(null)}
        onConfirm={(m) => {
          deleteModel(m.id);
          setConfirmId(null);
        }}
      />
    </Layout>
  );
}
