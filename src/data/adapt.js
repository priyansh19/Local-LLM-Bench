import { KNOWN_MODELS, installedMatch } from './knownModels';

// Maps a real Ollama model into the shape the design's UI expects.
// Anything we cannot know from Ollama is left null rather than guessed.

const FAMILY_CAT = {
  llama: 'base',
  qwen2: 'base',
  qwen3: 'base',
  qwen35moe: 'base',
  gemma: 'base',
  gemma2: 'base',
  gemma3: 'base',
  gemma4: 'base',
  phi3: 'base',
  mistral: 'base',
  clip: 'vision',
  mllama: 'vision',
  llava: 'vision',
  bert: 'asr',
  nomicbert: 'asr',
};

const nameHints = (name) => {
  const n = name.toLowerCase();
  if (/coder|code|deepseek-coder|starcoder/.test(n)) return 'coding';
  if (/llava|vision|-vl|minicpm-v/.test(n)) return 'vision';
  if (/whisper|asr|embed/.test(n)) return 'asr';
  if (/tts|kokoro|xtts|bark/.test(n)) return 'tts';
  if (/moshi|sts/.test(n)) return 'sts';
  return null;
};

export function adaptOllamaModel(m) {
  const fams = (m.families || []).map((f) => String(f).toLowerCase());
  const hasVision = fams.some((f) => /clip|vision|llava|mllama/.test(f));
  const cat = nameHints(m.name) || (hasVision ? 'vision' : FAMILY_CAT[(m.family || '').toLowerCase()] || 'base');

  const mods = ['text'];
  if (hasVision) mods.push('vision');

  return {
    id: m.id,
    tag: m.tag || m.id,
    name: m.name,
    vendor: m.vendor || 'local',
    source: 'ollama',
    params: m.params || '—',
    quant: m.quant || '—',
    sizeNum: m.sizeNum,
    mods,
    cat,
    // Ollama has no download counter — don't invent one.
    downloads: null,
    status: 'installed', // everything Ollama lists is on disk by definition
    pct: 100,
    folder: m.tag,
    added: m.modifiedAt ? relTime(m.modifiedAt) : '—',
    family: m.family,
    families: m.families,
    hasVision,
  };
}

// Turn a known (not-yet-installed) model into a catalog entry marked available.
function adaptKnownModel(k) {
  return {
    id: k.tag,
    tag: k.tag,
    name: k.name,
    vendor: k.vendor,
    source: 'ollama',
    params: k.params,
    quant: k.quant,
    sizeNum: k.sizeEst,
    sizeIsEstimate: true,
    mods: k.mods,
    cat: k.cat,
    downloads: null,
    status: 'available', // installable, not on disk
    pct: 0,
    folder: k.tag,
    added: '—',
    hasVision: k.mods.includes('vision'),
  };
}

/**
 * The catalog the UI renders: every known/installable model, with the ones
 * actually on disk promoted to real installed data. Any installed model not in
 * the known list (a custom pull) is appended so nothing on disk is hidden.
 */
export function buildCatalog(installedRaw) {
  const installed = (installedRaw || []).map(adaptOllamaModel);
  const usedIds = new Set();

  const merged = KNOWN_MODELS.map((k) => {
    const match = installedMatch(k.tag, installed);
    if (match) {
      usedIds.add(match.id);
      // Real on-disk data wins, but keep the curated category/modalities which
      // Ollama's metadata often lacks.
      return { ...match, cat: match.cat === 'base' ? k.cat : match.cat, mods: k.mods.length > match.mods.length ? k.mods : match.mods, name: k.name };
    }
    return adaptKnownModel(k);
  });

  const extras = installed.filter((m) => !usedIds.has(m.id));
  return [...merged, ...extras];
}

function relTime(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const d = Math.max(0, Date.now() - then);
  const day = 86400000;
  if (d < 3600000) return `${Math.max(1, Math.round(d / 60000))}m ago`;
  if (d < day) return `${Math.round(d / 3600000)}h ago`;
  if (d < 7 * day) return `${Math.round(d / day)}d ago`;
  if (d < 30 * day) return `${Math.round(d / (7 * day))}w ago`;
  return `${Math.round(d / (30 * day))}mo ago`;
}
