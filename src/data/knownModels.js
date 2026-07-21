// A curated catalog of well-known models pullable from the Ollama library.
// Sizes are the library's published approximate download sizes — flagged as
// estimates, since the exact on-disk size is only known once installed.
// `tag` is exactly what `ollama pull <tag>` expects.

export const KNOWN_MODELS = [
  // --- base LLMs ---
  { tag: 'llama3.2', name: 'Llama 3.2', vendor: 'Meta', params: '3B', sizeEst: 2.0, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'llama3.1', name: 'Llama 3.1', vendor: 'Meta', params: '8B', sizeEst: 4.7, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'qwen2.5:0.5b', name: 'Qwen2.5 0.5B', vendor: 'Alibaba', params: '0.5B', sizeEst: 0.4, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'qwen2.5:3b', name: 'Qwen2.5 3B', vendor: 'Alibaba', params: '3B', sizeEst: 1.9, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'qwen2.5:7b', name: 'Qwen2.5 7B', vendor: 'Alibaba', params: '7B', sizeEst: 4.7, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'gemma2', name: 'Gemma 2', vendor: 'Google', params: '9B', sizeEst: 5.4, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'gemma2:2b', name: 'Gemma 2 2B', vendor: 'Google', params: '2B', sizeEst: 1.6, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'phi3.5', name: 'Phi-3.5 Mini', vendor: 'Microsoft', params: '3.8B', sizeEst: 2.2, quant: 'Q4_K_M', mods: ['text'], cat: 'base' },
  { tag: 'mistral', name: 'Mistral', vendor: 'Mistral AI', params: '7B', sizeEst: 4.1, quant: 'Q4_0', mods: ['text'], cat: 'base' },

  // --- coding ---
  { tag: 'qwen2.5-coder', name: 'Qwen2.5 Coder', vendor: 'Alibaba', params: '7B', sizeEst: 4.7, quant: 'Q4_K_M', mods: ['text'], cat: 'coding' },
  { tag: 'deepseek-coder-v2', name: 'DeepSeek-Coder V2', vendor: 'DeepSeek', params: '16B', sizeEst: 8.9, quant: 'Q4_K_M', mods: ['text'], cat: 'coding' },
  { tag: 'codellama', name: 'Code Llama', vendor: 'Meta', params: '7B', sizeEst: 3.8, quant: 'Q4_0', mods: ['text'], cat: 'coding' },

  // --- vision ---
  { tag: 'llava', name: 'LLaVA 1.6', vendor: 'community', params: '7B', sizeEst: 4.7, quant: 'Q4_K_M', mods: ['text', 'vision'], cat: 'vision' },
  { tag: 'llama3.2-vision', name: 'Llama 3.2 Vision', vendor: 'Meta', params: '11B', sizeEst: 7.9, quant: 'Q4_K_M', mods: ['text', 'vision'], cat: 'vision' },
  { tag: 'moondream', name: 'Moondream 2', vendor: 'vikhyatk', params: '1.8B', sizeEst: 1.7, quant: 'Q4_K_M', mods: ['text', 'vision'], cat: 'vision' },

  // --- embeddings (asr bucket in the design's palette) ---
  { tag: 'nomic-embed-text', name: 'Nomic Embed', vendor: 'Nomic', params: '137M', sizeEst: 0.3, quant: 'F16', mods: ['text'], cat: 'asr' },
];

// Match a known model's pull tag against an installed model's id. Installed ids
// look like "llama3.2:latest" or "qwen2.5:0.5b"; a tag with no ":" matches the
// ":latest" variant.
export function installedMatch(tag, installedList) {
  return installedList.find((m) => {
    const id = m.id || m.tag || '';
    if (id === tag) return true;
    if (!tag.includes(':')) return id === `${tag}:latest` || id.startsWith(`${tag}:`);
    return false;
  });
}
