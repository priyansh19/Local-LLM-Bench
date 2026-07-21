// Results comparison — transcribed from the design's RM / RMET / RW block.
// Every score and radar vertex below is computed, not authored.

const RM = [
  { short: 'Qwen2-VL', full: 'Qwen2-VL 7B', color: 'var(--orange)', tagline: 'Fast & lean', tps: 47.2, ttft: 318, vram: 9.4, img: 84.0, reason: 72.5 },
  { short: 'Llama 3.2 V', full: 'Llama 3.2 V 11B', color: '#b0894f', tagline: 'Balanced', tps: 38.6, ttft: 402, vram: 11.1, img: 86.2, reason: 79.0 },
  { short: 'LLaVA 1.6', full: 'LLaVA 1.6 13B', color: '#8a8069', tagline: 'Accurate & heavy', tps: 31.1, ttft: 511, vram: 10.8, img: 88.4, reason: 82.6 },
];

const RMET = [
  { key: 'tps', label: 'Throughput', head: 'Tok/s', better: 'high', fmt: (v) => v.toFixed(1) },
  { key: 'ttft', label: 'Latency', head: 'TTFT', better: 'low', fmt: (v) => `${Math.round(v)} ms` },
  { key: 'vram', label: 'VRAM', head: 'VRAM', better: 'low', fmt: (v) => `${v.toFixed(1)} GB` },
  { key: 'img', label: 'Image', head: 'Image', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'reason', label: 'Reasoning', head: 'Reason', better: 'high', fmt: (v) => v.toFixed(1) },
];

const RW = { tps: 0.25, ttft: 0.15, vram: 0.15, img: 0.225, reason: 0.225 };

const RES_BADGE = {
  'Qwen2-VL': ['Fastest', '#c1611c', '#f8e7d6'],
  'LLaVA 1.6': ['Most accurate', '#3a6b4f', '#e0efe6'],
  'Llama 3.2 V': ['Best balance', '#6b5a8a', '#eae4f2'],
};

const MEDALS = ['🥇', '🥈', '🥉'];

// Radar geometry: 5 axes at 72° steps starting at -90°.
const RCX = 150;
const RCY = 130;
const RR = 95;
const vertex = (frac, i) => {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return [RCX + frac * RR * Math.cos(a), RCY + frac * RR * Math.sin(a)];
};
const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

export function buildResults() {
  const models = RM.map((m) => ({ ...m }));

  const ext = {};
  RMET.forEach((mt) => {
    const vs = models.map((m) => m[mt.key]);
    ext[mt.key] = { min: Math.min(...vs), max: Math.max(...vs) };
  });
  const norm = (v, mt) => {
    const { min, max } = ext[mt.key];
    if (max === min) return 100;
    return mt.better === 'high' ? ((v - min) / (max - min)) * 100 : ((max - v) / (max - min)) * 100;
  };

  models.forEach((m) => {
    m.n = {};
    RMET.forEach((mt) => (m.n[mt.key] = norm(m[mt.key], mt)));
    m.score = Math.round(RMET.reduce((a, mt) => a + m.n[mt.key] * RW[mt.key], 0));
  });

  const win = {};
  RMET.forEach((mt) => {
    win[mt.key] = models.reduce((bi, m, i) => (m.n[mt.key] > models[bi].n[mt.key] ? i : bi), 0);
  });

  const ordered = [...models].sort((a, b) => b.score - a.score);
  const winner = ordered[0];

  const radar = {
    rings: [0.25, 0.5, 0.75, 1].map((f) => pts([0, 1, 2, 3, 4].map((i) => vertex(f, i)))),
    spokes: [0, 1, 2, 3, 4].map((i) => {
      const [x, y] = vertex(1, i);
      return { x: x.toFixed(1), y: y.toFixed(1) };
    }),
    models: models.map((m) => ({
      color: m.color,
      fill: `color-mix(in srgb, ${m.color} 13%, transparent)`,
      points: pts(RMET.map((mt, i) => vertex(m.n[mt.key] / 100, i))),
    })),
    axes: RMET.map((mt, i) => {
      const [x, y] = vertex(1.16, i);
      const cosA = Math.cos(((-90 + i * 72) * Math.PI) / 180);
      return {
        x: x.toFixed(1),
        y: (y + 3).toFixed(1),
        label: mt.label,
        anchor: Math.abs(cosA) < 0.3 ? 'middle' : cosA > 0 ? 'start' : 'end',
      };
    }),
  };

  const leaderboard = ordered.map((m, ri) => ({
    short: m.short,
    isTop: ri === 0,
    score: m.score,
    scoreColor: ri === 0 ? 'var(--orange)' : 'var(--ink)',
    rowBg: ri === 0 ? 'var(--notice)' : 'transparent',
    cells: RMET.map((mt) => {
      const isW = win[mt.key] === models.indexOf(m);
      const lead = models[win[mt.key]][mt.key];
      const d = m[mt.key] - lead;
      const delta = isW
        ? 'best'
        : mt.better === 'high'
        ? d.toFixed(1)
        : `+${Math.abs(d).toFixed(mt.key === 'vram' ? 1 : 0)}`;
      return {
        value: mt.fmt(m[mt.key]),
        pct: `${Math.round(m.n[mt.key])}%`,
        delta,
        valColor: isW ? 'var(--orange)' : 'var(--ink)',
        barColor: isW ? 'var(--orange)' : 'var(--bar-idle)',
      };
    }),
  }));

  const ranking = ordered.map((m, ri) => {
    const bd = RES_BADGE[m.short] || ['—', '#8a8069', '#efe7d6'];
    return {
      medal: MEDALS[ri],
      full: m.full,
      tagline: m.tagline,
      color: m.color,
      score: m.score,
      scorePct: `${m.score}%`,
      badge: bd[0],
      badgeColor: bd[1],
      badgeBg: bd[2],
      isTop: ri === 0,
    };
  });

  return {
    radar,
    legend: models.map((m) => ({ short: m.short, tagline: m.tagline, color: m.color })),
    heads: RMET.map((mt) => mt.head),
    leaderboard,
    ranking,
    winnerLine: `${winner.short} takes the top weighted score — fastest and leanest, with quality within reach of the accuracy leaders.`,
    weightsNote: 'Weights · Speed 25% · Latency 15% · VRAM 15% · Image 22.5% · Reason 22.5%',
  };
}
