'use strict';
const ollama = require('./ollama');
const openai = require('./openai-compat');

/**
 * Routes benchmark work to whichever local engine the user selected in the
 * tuner. Ollama speaks its own protocol; vLLM / LM Studio / llama.cpp all speak
 * the OpenAI-compatible one. Every adapter exposes the same generateStream
 * shape, so bench.js never needs to know which engine it's driving.
 */

const OPENAI_PROVIDERS = new Set(['vllm', 'lmstudio', 'llamacpp']);

function resolve(provider) {
  const p = provider || 'ollama';
  if (p === 'ollama') {
    return {
      provider: p,
      isUp: () => ollama.isUp(),
      listModels: () => ollama.listModels(),
      generateStream: (args, onToken, signal) => ollama.generateStream(args, onToken, signal),
      label: 'Ollama',
      startHint: 'Start it with `ollama serve`.',
    };
  }
  if (OPENAI_PROVIDERS.has(p)) {
    const label = { vllm: 'vLLM', lmstudio: 'LM Studio', llamacpp: 'llama.cpp server' }[p];
    const { port } = openai.endpointFor(p);
    return {
      provider: p,
      isUp: () => openai.isUp(p),
      listModels: () => openai.listModels(p),
      generateStream: (args, onToken, signal) => openai.generateStream({ ...args, provider: p }, onToken, signal),
      label,
      startHint: `Start the ${label} server (expected on port ${port}).`,
    };
  }
  // Unknown provider — fail loudly rather than silently using the wrong engine.
  throw new Error(`Unknown inference provider: ${provider}`);
}

module.exports = { resolve, OPENAI_PROVIDERS };
