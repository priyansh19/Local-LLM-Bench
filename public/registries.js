'use strict';
const https = require('https');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const ollama = require('./ollama');

/**
 * Real model registries. Three live sources the app can browse and download
 * from, each backed by an actual API or CLI — nothing here is mocked.
 *
 *   huggingface : HF Hub API search  → downloaded via `ollama pull hf.co/...`
 *                 so the model lands as a benchmarkable Ollama model.
 *   lmstudio    : `lms ls --json` (installed) + `lms get -y` (download).
 *   ollama      : the Ollama library (handled by the existing ollama.js path).
 */

const LMS_BIN = path.join(os.homedir(), '.lmstudio', 'bin', process.platform === 'win32' ? 'lms.exe' : 'lms');

// ---- Hugging Face -------------------------------------------------------

function httpsJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'LLMBench/1.0' }, timeout }, (res) => {
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HF HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Bad JSON from Hugging Face'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Hugging Face timed out')));
  });
}

// Matches Q4_0, Q4_K_M, Q5_K_S, Q6_K_L, IQ4_XS, F16, BF16, F32 …
const QUANT_RE = /(IQ\d+_\w+|Q\d+(_\w+)*|F16|BF16|F32)/i;

/** Search HF Hub for GGUF-format repos, newest/most-downloaded first. */
async function hfSearch(query) {
  const q = encodeURIComponent(query || 'gguf');
  const url = `https://huggingface.co/api/models?search=${q}&filter=gguf&sort=downloads&direction=-1&limit=25`;
  const list = await httpsJson(url);
  return (list || [])
    .filter((m) => m.id)
    .map((m) => {
      const [vendor, ...rest] = m.id.split('/');
      return {
        id: m.id, // "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
        name: rest.join('/').replace(/-GGUF$/i, '') || m.id,
        vendor,
        downloads: m.downloads ?? null,
        likes: m.likes ?? null,
        source: 'huggingface',
        gated: !!m.gated,
      };
    });
}

/** List the GGUF quant files a HF repo actually offers. */
async function hfQuants(repo) {
  const info = await httpsJson(`https://huggingface.co/api/models/${repo}`);
  const files = (info.siblings || [])
    .map((s) => s.rfilename)
    .filter((f) => /\.gguf$/i.test(f));
  return files.map((f) => {
    const m = f.match(QUANT_RE);
    return { file: f, quant: (m ? m[0] : '—').toUpperCase() };
  });
}

/**
 * Download a HF GGUF into Ollama so it becomes benchmarkable immediately.
 * Ollama understands `hf.co/<repo>:<quant>` natively.
 */
function hfPull(repo, quant, onProgress, signal) {
  const name = `hf.co/${repo}${quant ? `:${quant}` : ''}`;
  return ollama.pullModel(name, onProgress, signal);
}

// ---- LM Studio ----------------------------------------------------------

function lmsAvailable() {
  try {
    return require('fs').existsSync(LMS_BIN);
  } catch {
    return false;
  }
}

/** Models actually downloaded in LM Studio, machine-readable. */
async function lmsList() {
  if (!lmsAvailable()) return [];
  try {
    const { stdout } = await execFileAsync(LMS_BIN, ['ls', '--json'], { timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
    const arr = JSON.parse(stdout);
    return (Array.isArray(arr) ? arr : []).map((m) => ({
      id: m.modelKey || m.path || 'unknown',
      name: m.displayName || (m.modelKey || '').split('/').pop() || m.modelKey,
      vendor: m.publisher || (m.modelKey || '').split('/')[0] || 'lmstudio',
      sizeNum: m.sizeBytes ? Math.round((m.sizeBytes / 1024 ** 3) * 100) / 100 : null,
      params: m.paramsString || '—',
      // quantization is an object {name, bits}, not a string.
      quant: m.quantization?.name || (typeof m.quantization === 'string' ? m.quantization : '—'),
      arch: m.architecture || null,
      hasVision: !!m.vision,
      maxContext: m.maxContextLength || null,
      source: 'lmstudio',
    }));
  } catch {
    return [];
  }
}

/**
 * Download a model into LM Studio via its CLI, streaming progress lines out.
 * `-y` scripts it; `--gguf` keeps it to GGUF variants. `model` may be a catalog
 * name ("qwen/qwen2.5-0.5b") or a full Hugging Face URL.
 */
function lmsGet(model, onProgress, signal) {
  return new Promise((resolve, reject) => {
    if (!lmsAvailable()) return reject(new Error('LM Studio CLI (lms) not found.'));
    const child = spawn(LMS_BIN, ['get', '-y', '--gguf', model], { windowsHide: true });
    let tail = '';
    const handle = (chunk) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-2000);
      // `lms get` repaints its progress bar many times per chunk; take the LAST
      // percentage in the chunk, not the first, so progress doesn't stall.
      const all = text.match(/(\d{1,3}(?:\.\d+)?)\s*%/g);
      const pct = all ? Number(all[all.length - 1].replace('%', '')) : null;
      onProgress?.({ line: text.trim().slice(-200), pct });
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve({ ok: true }) : reject(new Error(`lms get exited ${code}: ${tail.slice(-200)}`))));
    signal?.addEventListener?.('abort', () => {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    });
  });
}

module.exports = { hfSearch, hfQuants, hfPull, lmsList, lmsGet, lmsAvailable };
