import { CATALOG } from './catalog';

// Benchmark history, transcribed from the design's runs(id) map.
export const RUNS = {
  qwen2vl: [
    { id: 'q1', date: 'Jul 15 · 14:22', ago: '2 days ago', suite: 'Vision + text · 50 prompts', provider: 'TensorRT-LLM', precision: 'FP8', tps: 47.2, ttft: 318, vram: 9.4, img: 88.1, reason: 74.2, temp: 0.7, topP: 0.9, ctx: '4K', gpu: 33, quant: 'Q5_K_M', batch: 512, verdict: 'Best throughput', output: 'The image shows a wooden cabin beside a still alpine lake at dawn; mist hangs over the water and pine forest climbs the ridge behind it.' },
    { id: 'q2', date: 'Jul 12 · 09:05', ago: '5 days ago', suite: 'Vision only · 30 prompts', provider: 'llama.cpp', precision: 'Q5_K_M', tps: 44.0, ttft: 355, vram: 9.1, img: 87.3, reason: 0, temp: 0.4, topP: 0.8, ctx: '2K', gpu: 28, quant: 'Q5_K_M', batch: 256, verdict: 'Low temperature', output: 'A close-up of a ceramic mug on a wooden desk beside an open notebook and a pair of glasses.' },
    { id: 'q3', date: 'Jul 08 · 20:41', ago: '9 days ago', suite: 'Full suite · 50 prompts', provider: 'vLLM', precision: 'FP16', tps: 41.6, ttft: 402, vram: 11.0, img: 88.6, reason: 75.9, temp: 0.8, topP: 0.95, ctx: '8K', gpu: 33, quant: 'Q4_K_M', batch: 512, verdict: '8K context', output: 'A busy street market at golden hour with stalls of fruit and rows of hanging paper lanterns.' },
  ],
  phi35: [
    { id: 'p1', date: 'Jul 14 · 11:30', ago: '3 days ago', suite: 'Text · 50 prompts', provider: 'Ollama', precision: 'Q4_K_M', tps: 63.4, ttft: 210, vram: 3.1, img: 0, reason: 71.0, temp: 0.7, topP: 0.9, ctx: '4K', gpu: 33, quant: 'Q4_K_M', batch: 512, verdict: 'Fastest text', output: 'To summarize: the proposal cuts latency by batching requests and caching KV state between turns.' },
  ],
  llama31: [
    { id: 'l1', date: 'Jul 10 · 16:12', ago: '7 days ago', suite: 'Text · 50 prompts', provider: 'llama.cpp', precision: 'Q4_0', tps: 52.8, ttft: 255, vram: 4.7, img: 0, reason: 76.4, temp: 0.7, topP: 0.9, ctx: '8K', gpu: 33, quant: 'Q4_0', batch: 512, verdict: 'Balanced', output: 'The three main trade-offs are memory footprint, throughput, and answer quality under load.' },
  ],
};

export const runsFor = (id) => RUNS[id] || [];
export const findModel = (id) => CATALOG.find((m) => m.id === id);

// Per-model card metadata, from the design's cardMetaAll.
export const CARD_META = {
  qwen2vl: { license: 'Apache-2.0', arch: 'Qwen2-VL · ViT-600M + 7B LLM', tensor: 'BF16 → Q5_K_M', langs: '29 languages' },
  qwen25coder: { license: 'Apache-2.0', arch: 'Qwen2.5 dense decoder', tensor: 'BF16 → Q4_K_M', langs: '92 prog. languages' },
  phi35: { license: 'MIT', arch: 'Phi-3.5 dense decoder', tensor: 'BF16 → Q4_K_M', langs: 'English + code' },
  llama31: { license: 'Llama 3.1 Community', arch: 'Llama 3.1 dense decoder', tensor: 'BF16 → Q4_0', langs: '8 languages' },
  llama32v: { license: 'Llama 3.2 Community', arch: 'Llama 3.2 Vision · ViT + 11B', tensor: 'BF16 → Q4_K_M', langs: '8 languages' },
  whisper: { license: 'MIT', arch: 'Whisper encoder-decoder', tensor: 'FP16', langs: '99 languages' },
  kokoro: { license: 'Apache-2.0', arch: 'StyleTTS2 vocoder', tensor: 'FP16', langs: 'English' },
  moshi: { license: 'CC-BY', arch: 'Mimi codec + 7B LM', tensor: 'Q4_K_M', langs: 'English' },
};

export const cardMetaFor = (m) =>
  CARD_META[m.id] || { license: '—', arch: m.name, tensor: m.quant, langs: '—' };

// Models with benchmark history, in the design's order.
export const BENCHED_IDS = ['phi35', 'llama31', 'qwen2vl'];

const LB_METRICS = [
  { key: 'tps', better: 'high', label: 'Tok/s', fmt: (v) => v.toFixed(1) },
  { key: 'ttft', better: 'low', label: 'TTFT', fmt: (v) => `${Math.round(v)} ms` },
  { key: 'vram', better: 'low', label: 'VRAM', fmt: (v) => `${v.toFixed(1)} GB` },
  { key: 'reason', better: 'high', label: 'Reasoning', fmt: (v) => v.toFixed(1) },
];

const LB_WEIGHTS = { tps: 0.3, ttft: 0.2, vram: 0.2, reason: 0.3 };

// Scores are normalised across the compared models per metric, then weighted —
// exactly the design's lbNorm/lbW maths, not hand-picked numbers.
export function buildLeaderboard(ids = BENCHED_IDS) {
  const rows = ids.map((id) => {
    const rs = runsFor(id);
    const best = rs.reduce((a, x) => (x.tps > a.tps ? x : a), rs[0]);
    const m = findModel(id);
    return { id, short: m.name, tps: best.tps, ttft: best.ttft, vram: best.vram, reason: best.reason };
  });

  const ext = {};
  LB_METRICS.forEach((mt) => {
    const vs = rows.map((x) => x[mt.key]);
    ext[mt.key] = { min: Math.min(...vs), max: Math.max(...vs) };
  });

  const norm = (v, mt) => {
    const { min, max } = ext[mt.key];
    if (max === min) return 100;
    return mt.better === 'high' ? ((v - min) / (max - min)) * 100 : ((max - v) / (max - min)) * 100;
  };

  rows.forEach((x) => {
    x.n = {};
    LB_METRICS.forEach((mt) => (x.n[mt.key] = norm(x[mt.key], mt)));
    x.score = Math.round(LB_METRICS.reduce((a, mt) => a + x.n[mt.key] * LB_WEIGHTS[mt.key], 0));
  });

  // Index of the per-metric winner — that cell is highlighted orange.
  const win = {};
  LB_METRICS.forEach((mt) => {
    win[mt.key] = rows.reduce((bi, x, i) => (x.n[mt.key] > rows[bi].n[mt.key] ? i : bi), 0);
  });

  return {
    heads: LB_METRICS.map((mt) => mt.label),
    rows: [...rows]
      .sort((a, b) => b.score - a.score)
      .map((x, ri) => ({
        id: x.id,
        short: x.short,
        rank: ri + 1,
        isTop: ri === 0,
        score: x.score,
        scoreColor: ri === 0 ? 'var(--orange)' : 'var(--ink)',
        rowBg: ri === 0 ? 'var(--notice)' : 'transparent',
        cells: LB_METRICS.map((mt) => {
          const isWinner = win[mt.key] === rows.indexOf(x);
          return {
            value: mt.fmt(x[mt.key]),
            pct: `${Math.round(x.n[mt.key])}%`,
            valColor: isWinner ? 'var(--orange)' : 'var(--ink)',
            barColor: isWinner ? 'var(--orange)' : 'var(--bar-idle)',
          };
        }),
      })),
  };
}
