import React from 'react';

// Provider ids MUST match public/inference.js (ollama | vllm | lmstudio |
// llamacpp) — the design's decorative "TensorRT-LLM" isn't wired and would make
// resolveInference() throw. LM Studio replaces it because it's a real, common
// OpenAI-compatible local server the backend actually drives.
const PROV_META = {
  ollama: { label: 'Ollama', tag: 'GGUF · one-command' },
  lmstudio: { label: 'LM Studio', tag: 'OpenAI API · :1234' },
  vllm: { label: 'vLLM', tag: 'GPU · paged-attn · :8000' },
  llamacpp: { label: 'llama.cpp', tag: 'GGUF · server · :8080' },
};

const PROV_DESC = {
  ollama: 'Simplest local runtime with the best developer experience. Fully wired.',
  lmstudio: 'OpenAI-compatible local server on port 1234. Load a model in LM Studio first.',
  vllm: 'Highest batched throughput via paged attention. OpenAI-compatible on :8000.',
  llamacpp: 'Broadest model & quant support. Run llama-server on :8080.',
};

const PREC_MAP = {
  ollama: ['Q4_0', 'Q4_K_M', 'Q8_0'],
  lmstudio: ['Q4_K_M', 'Q5_K_M', 'Q8_0', 'F16'],
  vllm: ['FP16', 'BF16', 'FP8', 'AWQ-INT4'],
  llamacpp: ['Q4_K_M', 'Q5_K_M', 'Q8_0', 'F16'],
};

const SPEC_MAP = {
  ollama: [['num_ctx', '4096'], ['num_gpu', '33'], ['keep_alive', '5m']],
  lmstudio: [['endpoint', ':1234'], ['api', 'openai'], ['stream', 'sse']],
  vllm: [['tensor-parallel', '1'], ['gpu-mem-util', '0.90'], ['max-seqs', '256']],
  llamacpp: [['GPU layers', '33/33'], ['Threads', '8'], ['Batch', '512']],
};

const PROVIDER_ORDER = ['ollama', 'lmstudio', 'vllm', 'llamacpp'];

// Explicit default precision per provider (not simply the first list entry).
const DEFAULT_PRECISION = { ollama: 'Q4_K_M', lmstudio: 'Q4_K_M', vllm: 'FP16', llamacpp: 'Q4_K_M' };

const SLIDERS = [
  { label: 'Temperature', key: 'temp', min: 0, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
  { label: 'Top-p (nucleus)', key: 'topP', min: 0, max: 1, step: 0.05, fmt: (v) => v.toFixed(2) },
  { label: 'Top-k', key: 'topK', min: 0, max: 100, step: 1, fmt: (v) => String(v) },
  { label: 'Max output tokens', key: 'maxTokens', min: 128, max: 4096, step: 128, fmt: (v) => String(v) },
  { label: 'Context window', key: 'ctx', min: 2048, max: 32768, step: 2048, fmt: (v) => `${(v / 1024).toFixed(0)}K` },
  { label: 'GPU layers offloaded', key: 'gpuLayers', min: 0, max: 33, step: 1, fmt: (v) => `${v} / 33` },
  { label: 'Batch size', key: 'batch', min: 64, max: 1024, step: 64, fmt: (v) => String(v) },
];

const TOGGLES = [
  { key: 'flashAttn', label: 'Flash attention', desc: 'Faster attention kernels' },
  { key: 'mmap', label: 'Memory-map weights', desc: 'mmap model from disk' },
  { key: 'kvF16', label: 'KV cache FP16', desc: 'Half-precision cache' },
];

export default function ModelTuner({ open, config, setConfig, onClose, systemInfo, onStart }) {
  const cfg = config || {};
  const provKey = PROV_META[cfg.provider] ? cfg.provider : 'llamacpp';
  const precisions = PREC_MAP[provKey];
  // Switching provider can invalidate the precision; the design falls back to
  // that provider's first option rather than keeping an impossible value.
  const activePrec = precisions.includes(cfg.precision) ? cfg.precision : precisions[0];

  const set = (patch) => setConfig?.((prev) => ({ ...prev, ...patch }));

  const selName = cfg.model?.name || 'Qwen2-VL';
  const selMeta = cfg.model ? `${cfg.model.params} · ${cfg.model.vendor}` : '7B · Alibaba';
  const taskCount = cfg.tasks?.length || 4;

  // Always mounted: the design slides the panel in with a transform
  // transition, which a conditional mount would make impossible.
  return (
    <>
      <div className={`tuner-scrim ${open ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`tuner-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="tuner-header">
          <div>
            <div className="tuner-label">Model tuning</div>
            <div className="tuner-name">{selName}</div>
            <div className="tuner-meta">{selMeta}</div>
          </div>
          <button className="tuner-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="tuner-content">
          <div className="tuner-section">
            <div className="tuner-section-label">Inference provider</div>
            <div className="provider-grid">
              {PROVIDER_ORDER.map((p) => (
                <div
                  key={p}
                  className={`provider-card ${provKey === p ? 'active' : ''}`}
                  onClick={() => set({ provider: p, precision: DEFAULT_PRECISION[p] })}
                >
                  <div className="provider-label">{PROV_META[p].label}</div>
                  <div className="provider-tag">{PROV_META[p].tag}</div>
                </div>
              ))}
            </div>
            <div className="tuner-description">{PROV_DESC[provKey]}</div>

            <div className="tuner-sublabel">Precision / engine</div>
            <div className="prec-options">
              {precisions.map((o) => (
                <div
                  key={o}
                  className={`prec-option ${activePrec === o ? 'active' : ''}`}
                  onClick={() => set({ precision: o })}
                >
                  {o}
                </div>
              ))}
            </div>

            <div className="provider-specs">
              {SPEC_MAP[provKey].map(([k, v]) => (
                <span key={k} className="spec-chip">
                  {k} {v}
                </span>
              ))}
            </div>
          </div>

          <div className="tuner-section">
            <div className="tuner-section-label">Sampling &amp; generation</div>
            <div className="sliders-container">
              {SLIDERS.map((s) => {
                const value = cfg[s.key] ?? s.min;
                return (
                  <div key={s.key} className="slider-item">
                    <div className="slider-header">
                      <span className="slider-label">{s.label}</span>
                      <span className="slider-value">{s.fmt(Number(value))}</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={value}
                      onChange={(e) => set({ [s.key]: Number(e.target.value) })}
                      className="slider-input"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="tuner-section">
            <div className="tuner-section-label">Runtime &amp; memory</div>
            <div className="toggles-container">
              {TOGGLES.map((t) => (
                <div key={t.key} className="toggle-item" onClick={() => set({ [t.key]: !cfg[t.key] })}>
                  <div className="toggle-content">
                    <div className="toggle-label">{t.label}</div>
                    <div className="toggle-desc">{t.desc}</div>
                  </div>
                  <div className={`toggle-switch ${cfg[t.key] ? 'on' : ''}`}>
                    <div className="toggle-knob"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="tuner-footer">
          <button
            className="btn-primary tuner-run"
            onClick={() => {
              onClose();
              onStart?.();
            }}
          >
            ▶ Run benchmark
          </button>
          <div className="tuner-footer-note">{taskCount} tasks · runs entirely on your device</div>
        </div>
      </div>
    </>
  );
}
