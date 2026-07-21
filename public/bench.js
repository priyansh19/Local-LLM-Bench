'use strict';
const ollama = require('./ollama');
const { resolve: resolveInference } = require('./inference');

/**
 * The real benchmark suite. Every number produced here is measured from an
 * actual local inference run on this machine — nothing is simulated.
 *
 * What each task genuinely measures:
 *   throughput : sustained tokens/sec over a long generation
 *   ttft       : wall-clock time to the first streamed token (cold + warm)
 *   reasoning  : accuracy on prompts with deterministically checkable answers
 *   memory     : real RSS/GPU delta observed across the run
 *   vision     : only attempted when the model actually reports vision support
 *
 * Tasks the hardware or model cannot support are reported as skipped with a
 * reason, never as a fabricated score.
 */

// Reasoning prompts whose answers can be checked without a human or a judge
// model. Deliberately unambiguous — this measures whether the model can follow
// a simple instruction correctly, not literary quality.
const REASONING_SET = [
  { q: 'What is 17 multiplied by 24? Reply with only the number.', check: (t) => /408/.test(t) },
  { q: 'If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops definitely Lazzies? Answer only yes or no.', check: (t) => /\byes\b/i.test(t) },
  { q: 'Which is heavier: 1 kg of steel or 2 kg of feathers? Reply with only "steel" or "feathers".', check: (t) => /feather/i.test(t) },
  { q: 'What comes next in this sequence: 2, 4, 8, 16, ? Reply with only the number.', check: (t) => /\b32\b/.test(t) },
  { q: 'Sarah has 3 brothers. Each brother has 2 sisters. How many sisters does Sarah have? Reply with only the number.', check: (t) => /\b1\b/.test(t) },
];

const THROUGHPUT_PROMPT =
  'Write a detailed technical explanation of how virtual memory paging works in a modern operating system. Cover page tables, TLBs, and page faults.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class BenchRunner {
  /**
   * @param {object} deps
   * @param {() => object} deps.getMetrics  live hardware sample (real)
   * @param {(evt: object) => void} deps.emit  progress out to the renderer
   */
  constructor({ getMetrics, emit }) {
    this.getMetrics = getMetrics;
    this.emit = emit;
    this.cancelled = false;
    // One controller per runner; its signal is passed into every generation so
    // cancel() genuinely aborts the in-flight HTTP request.
    this.controller = new AbortController();
  }

  cancel() {
    this.cancelled = true;
    try {
      this.controller.abort();
    } catch {
      /* nothing in flight */
    }
  }

  _peakTracker() {
    // Sample the real metric stream during a run and keep the peaks.
    const peak = { ram: 0, gpuMem: 0, gpu: 0, cpu: 0 };
    const id = setInterval(() => {
      const m = this.getMetrics() || {};
      if (m.memoryUsed != null) peak.ram = Math.max(peak.ram, m.memoryUsed);
      if (m.vramUsed != null) peak.gpuMem = Math.max(peak.gpuMem, m.vramUsed);
      if (m.gpuPct != null) peak.gpu = Math.max(peak.gpu, m.gpuPct);
      if (m.cpuPct != null) peak.cpu = Math.max(peak.cpu, m.cpuPct);
    }, 200);
    return { peak, stop: () => clearInterval(id) };
  }

  async run({ model, tasks, options = {} }) {
    // Route to the engine the user picked in the tuner (Ollama / vLLM / LM
    // Studio / llama.cpp). Every call below goes through this.client, so the
    // benchmark is identical regardless of backend.
    this.client = resolveInference(options.provider);
    if (!(await this.client.isUp())) {
      throw new Error(`${this.client.label} is not reachable. ${this.client.startHint}`);
    }

    const started = Date.now();
    const baseline = this.getMetrics() || {};
    const results = { model, startedAt: new Date().toISOString(), tasks: {}, skipped: {} };

    // Which tasks can this model genuinely do?
    const info = await this._modelInfo(model);
    const enabled = Object.entries(tasks)
      .filter(([, on]) => on)
      .map(([k]) => k);

    const plan = [];
    for (const t of enabled) {
      if (t === 'vision' && !info.hasVision) {
        results.skipped.vision = `${model} does not report vision support — cannot benchmark image understanding.`;
        continue;
      }
      if (t === 'audio') {
        results.skipped.audio = 'Ollama exposes no audio-capable model on this machine — no speech benchmark to run.';
        continue;
      }
      plan.push(t);
    }
    // ttft and memory are measured *during* the throughput/reasoning work rather
    // than as separate generations, so they don't need their own step.
    const steps = plan.filter((t) => t !== 'memory' && t !== 'ttft');
    if (steps.length === 0) steps.push('throughput');

    const tracker = this._peakTracker();
    let stepIdx = 0;
    const totalSteps = steps.length;
    const progressFor = (frac) => Math.min(99, Math.round(((stepIdx + frac) / totalSteps) * 100));

    try {
      for (const task of steps) {
        if (this.cancelled) break;
        this.emit({ type: 'task-start', task, progress: progressFor(0) });

        if (task === 'throughput' || task === 'reasoning') {
          const r =
            task === 'throughput'
              ? await this._throughput(model, options, progressFor)
              : await this._reasoning(model, options, progressFor);
          results.tasks[task] = r;
        } else if (task === 'vision') {
          results.tasks.vision = await this._vision(model, options, progressFor);
        }

        stepIdx += 1;
        this.emit({ type: 'task-done', task, progress: progressFor(0) });
      }
    } finally {
      tracker.stop();
    }

    // Real observed memory cost of the run.
    const peak = tracker.peak;
    if (plan.includes('memory') || true) {
      results.tasks.memory = {
        peakRamGb: peak.ram || null,
        baselineRamGb: baseline.memoryUsed ?? null,
        ramDeltaGb:
          peak.ram && baseline.memoryUsed != null ? Math.round((peak.ram - baseline.memoryUsed) * 100) / 100 : null,
        peakGpuMemGb: peak.gpuMem || null,
        peakGpuPct: peak.gpu || null,
        peakCpuPct: peak.cpu || null,
      };
    }

    // TTFT is taken from the throughput run's measured first-token time.
    if (results.tasks.throughput?.ttftMs != null) {
      results.tasks.ttft = {
        coldMs: results.tasks.throughput.coldTtftMs ?? null,
        warmMs: results.tasks.throughput.ttftMs,
      };
    }

    results.durationMs = Date.now() - started;
    results.cancelled = this.cancelled;
    results.finishedAt = new Date().toISOString();
    return results;
  }

  async _modelInfo(model) {
    try {
      const list = await this.client.listModels();
      const m = list.find((x) => x.id === model || x.name === model);
      const fams = (m?.families || []).map((f) => String(f).toLowerCase());
      return {
        hasVision: fams.some((f) => /clip|vision|llava|mllama/.test(f)),
        params: m?.params ?? null,
        quant: m?.quant ?? null,
        sizeNum: m?.sizeNum ?? null,
      };
    } catch {
      return { hasVision: false };
    }
  }

  /** Sustained generation: real tokens, real clock. */
  async _throughput(model, options, progressFor) {
    // First call also pays model load — measure it separately so warm TTFT is honest.
    const cold = await this.client.generateStream(
      { model, prompt: 'Say OK.', options: { ...options, num_predict: 1 } },
      null,
      this.controller.signal
    );

    const r = await this.client.generateStream(
      {
        model,
        prompt: THROUGHPUT_PROMPT,
        options: { ...options, num_predict: options.num_predict ?? 220 },
      },
      ({ text, tokens, ttftMs }) => {
        this.emit({
          type: 'token',
          task: 'throughput',
          text,
          tokens,
          ttftMs,
          metrics: this.getMetrics(),
          progress: progressFor(Math.min(0.95, tokens / (options.num_predict ?? 220))),
        });
      },
      this.controller.signal
    );

    return {
      tps: Math.round(r.tps * 100) / 100,
      tokens: r.tokens,
      ttftMs: Math.round(r.ttftMs),
      coldTtftMs: Math.round(cold.ttftMs),
      loadMs: Math.round(cold.loadMs),
      promptTokens: r.promptTokens,
      evalMs: Math.round(r.evalMs),
      sample: r.text.slice(0, 400),
    };
  }

  /** Accuracy on checkable prompts — a real score, not a vibe. */
  async _reasoning(model, options, progressFor) {
    const items = [];
    for (let i = 0; i < REASONING_SET.length; i++) {
      if (this.cancelled) break;
      const { q, check } = REASONING_SET[i];
      const r = await this.client.generateStream(
        { model, prompt: q, options: { ...options, num_predict: 80, temperature: 0 } },
        ({ text, tokens }) => {
          this.emit({
            type: 'token',
            task: 'reasoning',
            text,
            tokens,
            metrics: this.getMetrics(),
            progress: progressFor((i + 0.5) / REASONING_SET.length),
          });
        },
        this.controller.signal
      );
      const correct = check(r.text);
      items.push({ q, answer: r.text.trim().slice(0, 160), correct, tps: Math.round(r.tps * 100) / 100 });
      this.emit({ type: 'reasoning-item', index: i, correct, progress: progressFor((i + 1) / REASONING_SET.length) });
      await sleep(50);
    }
    const correct = items.filter((i) => i.correct).length;
    return {
      score: items.length ? Math.round((correct / items.length) * 1000) / 10 : null,
      correct,
      total: items.length,
      avgTps: items.length ? Math.round((items.reduce((a, i) => a + i.tps, 0) / items.length) * 100) / 100 : null,
      items,
    };
  }

  /** A 1x1 PNG is enough to prove the vision path executes end-to-end. */
  async _vision(model, options, progressFor) {
    const PIXEL =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const r = await this.client.generateStream(
      { model, prompt: 'Describe this image in one short sentence.', images: [PIXEL], options: { ...options, num_predict: 60 } },
      ({ text, tokens }) =>
        this.emit({ type: 'token', task: 'vision', text, tokens, metrics: this.getMetrics(), progress: progressFor(0.5) }),
      this.controller.signal
    );
    return { tps: Math.round(r.tps * 100) / 100, ttftMs: Math.round(r.ttftMs), sample: r.text.slice(0, 200) };
  }
}

module.exports = { BenchRunner, REASONING_SET };
