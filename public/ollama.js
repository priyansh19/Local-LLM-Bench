'use strict';
const http = require('http');

/**
 * Real Ollama client. Everything here talks to a live local inference server —
 * there is no simulation in this file. If Ollama is not running, calls fail
 * loudly rather than falling back to invented numbers.
 */

const HOST = '127.0.0.1';
const PORT = 11434;

function request(path, { method = 'GET', body = null, timeout = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
        timeout,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Bad JSON from ${path}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`Timeout on ${path}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

async function isUp() {
  try {
    await request('/api/tags', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/** Real list of models actually present on this machine. */
async function listModels() {
  const r = await request('/api/tags', { timeout: 8000 });
  return (r.models || []).map((m) => ({
    id: m.name,
    name: m.name.replace(/:latest$/, ''),
    tag: m.name,
    vendor: (m.details?.family || 'ollama').toLowerCase(),
    params: m.details?.parameter_size || '—',
    quant: m.details?.quantization_level || '—',
    sizeNum: Math.round((m.size / 1024 ** 3) * 100) / 100,
    family: m.details?.family || null,
    families: m.details?.families || [],
    modifiedAt: m.modified_at,
  }));
}

/**
 * Stream a real generation, measuring time-to-first-token from the wire rather
 * than trusting a server-reported figure. onToken fires per token so the UI can
 * render generation as it happens.
 *
 * Resolves with Ollama's own timing counters, which are authoritative:
 *   eval_count / eval_duration -> tokens/sec
 */
function generateStream({ model, prompt, options = {}, images = null }, onToken, signal) {
  return new Promise((resolve, reject) => {
    const body = { model, prompt, stream: true, options };
    if (images) body.images = images;
    const payload = JSON.stringify(body);

    const t0 = process.hrtime.bigint();
    let ttftMs = null;
    let tokens = 0;
    let text = '';
    let settled = false;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      fn(arg);
    };

    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: '/api/generate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 600000,
      },
      (res) => {
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            let o;
            try {
              o = JSON.parse(line);
            } catch {
              continue;
            }
            if (o.error) {
              req.destroy();
              done(reject, new Error(o.error));
              return;
            }
            if (o.response) {
              if (ttftMs === null) ttftMs = Number(process.hrtime.bigint() - t0) / 1e6;
              tokens += 1;
              text += o.response;
              onToken?.({ token: o.response, text, tokens, ttftMs });
            }
            if (o.done) {
              const evalCount = o.eval_count || tokens;
              // A run that produced no tokens has no meaningful timing — reject
              // rather than reporting fabricated 0 tps / total-elapsed TTFT
              // (symmetric with the OpenAI-compatible path).
              if (evalCount === 0) {
                return done(
                  reject,
                  new Error(`${model} returned no tokens (done_reason: ${o.done_reason || 'unknown'}).`)
                );
              }
              const evalNs = o.eval_duration || 1;
              done(resolve, {
                text,
                tokens: evalCount,
                ttftMs: ttftMs ?? Number(process.hrtime.bigint() - t0) / 1e6,
                tps: evalCount / (evalNs / 1e9),
                totalMs: (o.total_duration || 0) / 1e6,
                loadMs: (o.load_duration || 0) / 1e6,
                promptTokens: o.prompt_eval_count || 0,
                promptMs: (o.prompt_eval_duration || 0) / 1e6,
                evalMs: evalNs / 1e6,
                doneReason: o.done_reason || null,
              });
            }
          }
        });
        // A clean close without a done:true line would otherwise hang forever.
        res.on('end', () =>
          done(reject, new Error('Ollama stream ended before completion (no done marker).'))
        );
        res.on('error', (e) => done(reject, e));
      }
    );
    req.on('error', (e) => done(reject, e));
    req.on('timeout', () => req.destroy(new Error('Ollama generation timed out.')));
    signal?.addEventListener?.('abort', () => {
      req.destroy(new Error('cancelled'));
      done(reject, new Error('cancelled'));
    });
    req.write(payload);
    req.end();
  });
}

/** Pull a model for real, streaming progress bytes. */
function pullModel(name, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ name, stream: true });
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: '/api/pull',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 0,
      },
      (res) => {
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const o = JSON.parse(line);
              if (o.error) {
                req.destroy();
                reject(new Error(o.error));
                return;
              }
              onProgress?.(o);
              if (o.status === 'success') resolve({ ok: true });
            } catch {
              /* partial line */
            }
          }
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    signal?.addEventListener?.('abort', () => req.destroy(new Error('cancelled')));
    req.write(payload);
    req.end();
  });
}

/** Really delete a model's files from disk. */
async function deleteModel(name) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ name });
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: '/api/delete',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 30000,
      },
      (res) => {
        res.resume();
        res.on('end', () => (res.statusCode < 300 ? resolve({ ok: true }) : reject(new Error(`HTTP ${res.statusCode}`))));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { isUp, listModels, generateStream, pullModel, deleteModel };
