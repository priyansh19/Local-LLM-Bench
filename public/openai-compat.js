'use strict';
const http = require('http');

/**
 * Real client for any OpenAI-compatible local server — vLLM, LM Studio,
 * llama.cpp's server, LocalAI, etc. All of them expose /v1/chat/completions
 * with SSE streaming, so one adapter covers the lot.
 *
 * Its generateStream() returns the SAME shape as ollama.generateStream so the
 * benchmark runner is provider-agnostic. Every timing is measured on the wire;
 * nothing is simulated. If the server is down, calls fail loudly.
 */

function endpointFor(provider) {
  // Conventional default ports for each OpenAI-compatible server.
  if (provider === 'vllm') return { host: '127.0.0.1', port: 8000 };
  if (provider === 'lmstudio') return { host: '127.0.0.1', port: 1234 };
  if (provider === 'llamacpp') return { host: '127.0.0.1', port: 8080 };
  return { host: '127.0.0.1', port: 8000 };
}

function req(provider, path, { method = 'GET', body = null, timeout = 8000 } = {}) {
  const { host, port } = endpointFor(provider);
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        host,
        port,
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
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Bad JSON from ${path}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error(`Timeout on ${path}`)));
    if (payload) r.write(payload);
    r.end();
  });
}

async function isUp(provider) {
  try {
    await req(provider, '/v1/models', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

async function listModels(provider) {
  const r = await req(provider, '/v1/models', { timeout: 8000 });
  return (r.data || []).map((m) => ({
    id: m.id,
    name: m.id,
    tag: m.id,
    vendor: m.owned_by || provider,
    params: '—',
    quant: '—',
    sizeNum: null,
    families: [],
  }));
}

/**
 * Stream a real chat completion, measuring TTFT from the wire. Resolves with
 * the same fields ollama.generateStream produces, so downstream code is
 * identical regardless of provider. tps is derived from measured wall-clock
 * because OpenAI-compatible servers don't all return eval-duration counters.
 */
function generateStream({ provider, model, prompt, options = {}, images = null }, onToken, signal) {
  const { host, port } = endpointFor(provider);
  return new Promise((resolve, reject) => {
    const content = images?.length
      ? [
          { type: 'text', text: prompt },
          ...images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } })),
        ]
      : prompt;

    const body = {
      model,
      messages: [{ role: 'user', content }],
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.num_predict ?? 256,
    };
    if (options.top_p != null) body.top_p = options.top_p;
    const payload = JSON.stringify(body);

    const t0 = process.hrtime.bigint();
    let ttftMs = null;
    let tokens = 0;
    let text = '';
    let finished = false;

    const r = http.request(
      {
        host,
        port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 600000,
      },
      (res) => {
        if (res.statusCode >= 400) {
          let e = '';
          res.on('data', (c) => (e += c));
          res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${e.slice(0, 200)}`)));
          return;
        }
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const raw of lines) {
            const line = raw.trim();
            if (!line || !line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
              finish();
              return;
            }
            let o;
            try {
              o = JSON.parse(data);
            } catch {
              continue;
            }
            const delta = o.choices?.[0]?.delta?.content;
            if (delta) {
              if (ttftMs === null) ttftMs = Number(process.hrtime.bigint() - t0) / 1e6;
              tokens += 1;
              text += delta;
              onToken?.({ token: delta, text, tokens, ttftMs });
            }
            if (o.choices?.[0]?.finish_reason) finish(o.choices[0].finish_reason);
          }
        });
        res.on('end', () => finish());
        res.on('error', reject);
      }
    );

    function finish(reason) {
      if (finished) return;
      finished = true;
      const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
      // A generation that yielded no tokens has no meaningful TTFT or throughput
      // — report nulls rather than passing off the total wait as first-token time.
      if (tokens === 0) {
        return reject(
          new Error(
            `${model} returned no tokens (server responded in ${Math.round(elapsedMs)}ms). ` +
              'The model may still be loading, or produced only non-text output.'
          )
        );
      }
      const genMs = ttftMs != null ? Math.max(1, elapsedMs - ttftMs) : elapsedMs;
      resolve({
        text,
        tokens,
        ttftMs: ttftMs ?? elapsedMs,
        // Wall-clock generation rate excluding the wait for the first token.
        tps: tokens > 1 ? (tokens - 1) / (genMs / 1000) : tokens / (elapsedMs / 1000),
        totalMs: elapsedMs,
        loadMs: 0,
        promptTokens: 0,
        evalMs: genMs,
        doneReason: reason || null,
      });
    }

    r.on('error', reject);
    r.on('timeout', () => r.destroy(new Error('Timeout during generation')));
    signal?.addEventListener?.('abort', () => r.destroy(new Error('cancelled')));
    r.write(payload);
    r.end();
  });
}

module.exports = { isUp, listModels, generateStream, endpointFor };
