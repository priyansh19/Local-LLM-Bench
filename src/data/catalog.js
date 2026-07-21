// Transcribed verbatim from the design's `state.catalog`, `catMeta` and
// `sourceLabels`. This is a multi-modal benchmarking tool: vision, ASR, TTS and
// speech-to-speech models, not just text LLMs.

// cat -> [label, color, background]
export const CAT_META = {
  vision: ['Vision', '#c1611c', '#f8e7d6'],
  coding: ['Coding', '#3a6b4f', '#e0efe6'],
  tts: ['Text-to-Speech', '#8a5a2a', '#f1e4d0'],
  sts: ['Speech-to-Speech', '#6b5a8a', '#eae4f2'],
  base: ['Base LLM', '#4a4335', '#ece3d1'],
  asr: ['Speech-to-Text', '#2a6b8a', '#dcecf2'],
};

export const SOURCE_LABELS = {
  huggingface: 'Hugging Face',
  ollama: 'Ollama',
  community: 'Community',
  local: 'local files',
};

// Order the dashboard surfaces one model per category.
export const DASH_CATS = ['vision', 'coding', 'tts', 'sts', 'base', 'asr'];

export const CATALOG = [
  { id: 'qwen25coder', name: 'Qwen2.5-Coder', vendor: 'Alibaba', source: 'huggingface', params: '7B', quant: 'Q4_K_M', sizeNum: 4.4, mods: ['text'], cat: 'coding', downloads: '1.9M', status: 'available', pct: 0, folder: 'qwen2.5-coder-7b', added: '2d ago' },
  { id: 'qwen2vl', name: 'Qwen2-VL', vendor: 'Alibaba', source: 'huggingface', params: '7B', quant: 'Q5_K_M', sizeNum: 5.2, mods: ['text', 'vision'], cat: 'vision', downloads: '1.4M', status: 'installed', pct: 100, folder: 'qwen2-vl-7b', added: '3d ago' },
  { id: 'kokoro', name: 'Kokoro TTS', vendor: 'hexgrad', source: 'huggingface', params: '82M', quant: 'FP16', sizeNum: 0.3, mods: ['text', 'audio'], cat: 'tts', downloads: '640K', status: 'available', pct: 0, folder: 'kokoro-82m', added: '4d ago' },
  { id: 'moshi', name: 'Moshi', vendor: 'Kyutai', source: 'huggingface', params: '7B', quant: 'Q4_K_M', sizeNum: 5.1, mods: ['audio'], cat: 'sts', downloads: '310K', status: 'available', pct: 0, folder: 'moshi-7b', added: '5d ago' },
  { id: 'llama32v', name: 'Llama 3.2 Vision', vendor: 'meta-llama', source: 'huggingface', params: '11B', quant: 'Q4_K_M', sizeNum: 4.8, mods: ['text', 'vision'], cat: 'vision', downloads: '2.1M', status: 'downloading', pct: 63, folder: 'llama-3.2-vision-11b', added: '1w ago' },
  { id: 'whisper', name: 'Whisper Large v3', vendor: 'OpenAI', source: 'huggingface', params: '1.5B', quant: 'FP16', sizeNum: 3.1, mods: ['audio'], cat: 'asr', downloads: '4.2M', status: 'available', pct: 0, folder: 'whisper-large-v3', added: '1w ago' },
  { id: 'phi35', name: 'Phi-3.5 Mini', vendor: 'Microsoft', source: 'huggingface', params: '3.8B', quant: 'Q4_K_M', sizeNum: 2.2, mods: ['text'], cat: 'base', downloads: '3.6M', status: 'installed', pct: 100, folder: 'phi-3.5-mini', added: '1w ago' },
  { id: 'gemma2', name: 'Gemma 2', vendor: 'Google', source: 'huggingface', params: '9B', quant: 'Q4_K_M', sizeNum: 5.4, mods: ['text'], cat: 'base', downloads: '2.8M', status: 'downloading', pct: 28, folder: 'gemma-2-9b', added: '2w ago' },
  { id: 'llama31', name: 'Llama 3.1', vendor: 'meta', source: 'ollama', params: '8B', quant: 'Q4_0', sizeNum: 4.7, mods: ['text'], cat: 'base', downloads: '8.9M', status: 'installed', pct: 100, folder: 'llama3.1-8b', added: '2w ago' },
  { id: 'deepseekcoder', name: 'DeepSeek-Coder', vendor: 'DeepSeek', source: 'community', params: '6.7B', quant: 'Q4_K_M', sizeNum: 3.8, mods: ['text'], cat: 'coding', downloads: '980K', status: 'available', pct: 0, folder: 'deepseek-coder-6.7b', added: '2w ago' },
  { id: 'xtts', name: 'XTTS v2', vendor: 'Coqui', source: 'community', params: '460M', quant: 'FP16', sizeNum: 1.9, mods: ['text', 'audio'], cat: 'tts', downloads: '720K', status: 'available', pct: 0, folder: 'xtts-v2', added: '3w ago' },
  { id: 'mistral', name: 'Mistral', vendor: 'mistralai', source: 'ollama', params: '7B', quant: 'Q4_0', sizeNum: 4.1, mods: ['text'], cat: 'base', downloads: '5.1M', status: 'available', pct: 0, folder: 'mistral-7b', added: '3w ago' },
  { id: 'llava', name: 'LLaVA 1.6', vendor: 'community', source: 'ollama', params: '13B', quant: 'Q4_K_M', sizeNum: 7.4, mods: ['text', 'vision'], cat: 'vision', downloads: '1.1M', status: 'available', pct: 0, folder: 'llava-1.6-13b', added: '3w ago' },
  { id: 'deepseekvl', name: 'DeepSeek-VL', vendor: 'DeepSeek', source: 'community', params: '7B', quant: 'Q4_K_M', sizeNum: 4.9, mods: ['text', 'vision'], cat: 'vision', downloads: '412K', status: 'available', pct: 0, folder: 'deepseek-vl-7b', added: '1mo ago' },
  { id: 'minicpm', name: 'MiniCPM-V', vendor: 'community', source: 'community', params: '8B', quant: 'Q4_K_M', sizeNum: 5.0, mods: ['text', 'vision', 'audio'], cat: 'vision', downloads: '268K', status: 'available', pct: 0, folder: 'minicpm-v-2.6', added: '1mo ago' },
];

export const catBadge = (cat) => {
  const [label, color, bg] = CAT_META[cat] || CAT_META.base;
  return { label, color, bg };
};

// Registry rows badge the model's *modalities*; dashboard cards chip its
// *category*. Two different vocabularies in the design.
export const MOD_STYLE = {
  text: { color: '#4a4335', bg: '#ece3d1' },
  vision: { color: '#c1611c', bg: '#f8e7d6' },
  audio: { color: '#8a5a2a', bg: '#f1e4d0' },
};

export const badgesOf = (m) =>
  (m.mods || []).map((x) => ({
    label: x.charAt(0).toUpperCase() + x.slice(1),
    color: MOD_STYLE[x].color,
    bg: MOD_STYLE[x].bg,
  }));

// The registry's "local files" tab lists whatever is installed, regardless of
// where it came from.
export const bySource = (catalog, source) =>
  source === 'local'
    ? catalog.filter((m) => m.status === 'installed')
    : catalog.filter((m) => m.source === source);
