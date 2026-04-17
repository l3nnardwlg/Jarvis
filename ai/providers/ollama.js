const config = require('../../core/config');
const { logger } = require('../../core/logger');
const { request, streamRequest } = require('../../core/http-client');

const log = logger.child('ai:ollama');

let healthCache = { healthy: null, checkedAt: 0 };

async function checkHealth() {
  const now = Date.now();
  if (healthCache.healthy !== null && (now - healthCache.checkedAt) < config.ai.ollama.healthTtlMs) {
    return healthCache.healthy;
  }
  try {
    const res = await request(`${config.ai.ollama.endpoint}/api/tags`, { timeout: 3000 });
    healthCache = { healthy: res.status === 200, checkedAt: now };
  } catch {
    healthCache = { healthy: false, checkedAt: now };
  }
  return healthCache.healthy;
}

async function chat(messages, options = {}) {
  const model = options.model || config.ai.ollama.model;
  const temperature = options.temperature ?? config.ai.ollama.temperature;

  const payload = {
    model,
    messages,
    stream: false,
    options: { temperature },
  };

  const res = await request(`${config.ai.ollama.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: config.ai.ollama.timeoutMs,
  });

  if (res.status !== 200) throw new Error(`Ollama error: ${res.status} ${res.body}`);
  const data = JSON.parse(res.body);
  return {
    content: data.message?.content || '',
    model,
    provider: 'ollama',
    usage: { totalDuration: data.total_duration, evalCount: data.eval_count },
  };
}

async function chatStream(messages, options = {}) {
  const model = options.model || config.ai.ollama.model;
  const temperature = options.temperature ?? config.ai.ollama.temperature;

  const payload = {
    model,
    messages,
    stream: true,
    options: { temperature },
  };

  const res = await streamRequest(`${config.ai.ollama.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: 120000,
  });

  return {
    stream: res,
    model,
    provider: 'ollama',
    async *[Symbol.asyncIterator]() {
      let buffer = '';
      for await (const chunk of res) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield { content: data.message.content, done: data.done || false };
            }
            if (data.done) return;
          } catch {}
        }
      }
    },
  };
}

async function generate(prompt, options = {}) {
  const model = options.model || config.ai.ollama.model;

  const payload = {
    model,
    prompt,
    stream: false,
    options: { temperature: options.temperature ?? config.ai.ollama.temperature },
  };

  if (options.system) payload.system = options.system;

  const res = await request(`${config.ai.ollama.endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: config.ai.ollama.timeoutMs,
  });

  if (res.status !== 200) throw new Error(`Ollama error: ${res.status} ${res.body}`);
  const data = JSON.parse(res.body);
  return { content: data.response || '', model, provider: 'ollama' };
}

async function embeddings(text, options = {}) {
  const model = options.model || 'nomic-embed-text';

  const res = await request(`${config.ai.ollama.endpoint}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
    timeout: config.ai.ollama.timeoutMs,
  });

  if (res.status !== 200) throw new Error(`Ollama embeddings error: ${res.status}`);
  const data = JSON.parse(res.body);
  return data.embedding || [];
}

module.exports = { checkHealth, chat, chatStream, generate, embeddings };
