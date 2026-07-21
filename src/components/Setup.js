import React, { useState } from 'react';
import Layout from './Layout';
import buildNavItems from './navItems';

const TASK_DEFS = [
  ['throughput', 'Tokens / sec', 'Sustained generation throughput'],
  ['ttft', 'Time to first token', 'Latency before streaming starts'],
  ['vision', 'Image understanding', 'Accuracy on a vision QA set'],
  ['audio', 'Audio transcription', 'Word error rate on speech'],
  ['reasoning', 'Text reasoning', 'Quality score on reasoning tasks'],
  ['memory', 'Memory & VRAM', 'Peak memory footprint'],
];

export default function Setup({ onNavigate, systemInfo, benchmarkConfig, setBenchmarkConfig, catalog, startBenchmark, backend }) {
  const [isTunerOpen, setIsTunerOpen] = useState(false);

  const sel = benchmarkConfig?.model || catalog?.[0] || { name: '—', vendor: '—', params: '—', quant: '—', sizeNum: 0, mods: ['text'] };
  const tasks = benchmarkConfig?.tasks || {};

  const toggleTask = (key) =>
    setBenchmarkConfig?.((prev) => ({ ...prev, tasks: { ...prev.tasks, [key]: !prev.tasks[key] } }));

  const taskList = TASK_DEFS.map(([key, label, desc]) => {
    // A vision task is meaningless for a text-only model — the design greys it
    // out rather than letting you select something that can't run.
    const needsMod = key === 'vision' ? 'vision' : key === 'audio' ? 'audio' : null;
    const disabled = needsMod ? !(sel.mods || []).includes(needsMod) : false;
    return {
      key,
      label: disabled ? `${label} (n/a)` : label,
      desc,
      active: !!tasks[key] && !disabled,
      disabled,
    };
  });

  const taskCount = Object.values(tasks).filter(Boolean).length;
  const params = [
    { k: 'Prompts', v: '50' },
    { k: 'Context length', v: '4096' },
    { k: 'Precision', v: sel.quant },
  ];

  const navItems = buildNavItems('setup', catalog);
  const selMeta = `${sel.vendor} · ${sel.params} · ${sel.quant} · ${sel.sizeNum} GB`;

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
      <div className="screen-setup">
        <div className="screen-label">Configure benchmark</div>
        <h1 className="screen-title">What should we measure?</h1>

        <div>
          <div className="setup-section-label">Model under test</div>
          <div className="model-selection">
            <div className="model-avatar">{sel.name.charAt(0)}</div>
            <div className="model-info">
              <div className="model-name">{sel.name}</div>
              <div className="model-meta">{selMeta}</div>
            </div>
            <button className="btn-link" onClick={() => onNavigate('registry')}>
              Change
            </button>
          </div>
        </div>

        <div>
          <div className="setup-section-label">Benchmark suite</div>
          <div className="task-grid">
            {taskList.map((t) => (
              <div
                key={t.key}
                className={`task-card ${t.active ? 'active' : ''} ${t.disabled ? 'disabled' : ''}`}
                onClick={t.disabled ? undefined : () => toggleTask(t.key)}
              >
                <div className={`task-box ${t.active ? 'on' : ''}`}>{t.active ? '✓' : ''}</div>
                <div className="task-content">
                  <div className="task-label">{t.label}</div>
                  <div className="task-desc">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="setup-section-label">Run parameters</div>
          <div className="params-grid">
            {params.map((p) => (
              <div key={p.k} className="param-card">
                <div className="param-label">{p.k}</div>
                <div className="param-value">{p.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="setup-actions">
          <button className="btn-primary tune-cta" onClick={() => setIsTunerOpen(true)}>
            Tune &amp; run →
          </button>
          <button className="btn-dark" onClick={() => startBenchmark?.(sel)} disabled={!backend?.live}>
            ▶ Run now
          </button>
          <span className="action-note">
            {taskCount} tasks{systemInfo?.gpu ? ` · est. ~2 min on your ${systemInfo.gpu}` : ''}
          </span>
        </div>
      </div>
    </Layout>
  );
}
