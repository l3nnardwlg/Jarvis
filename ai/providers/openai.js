const config = require('../../core/config');
const { logger } = require('../../core/logger');
const { request } = require('../../core/http-client');

const log = logger.child('ai:openai');

async function checkHealth() {
  if (!config.ai.openai.enabled) return false;
  try {
    const res = await request(`${config.ai.openai.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.ai.openai.apiKey}` },
      timeout: 5000,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function chat(messages, options = {}) {
  const model = options.model || config.ai.openai.model;

  const payload = {
    model,
    messages,
    temperature: options.temperature ?? config.ai.openai.temperature,
    max_tokens: options.maxTokens || 2048,
  };

  const res = await request(`${config.ai.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ai.openai.apiKey}`,
    },
    body: JSON.stringify(payload),
    timeout: config.ai.openai.timeoutMs,
  });

  if (res.status !== 200) throw new Error(`OpenAI error: ${res.status} ${res.body}`);
  const data = JSON.parse(res.body);
  return {
    content: data.choices?.[0]?.message?.content || '',
    model,
    provider: 'openai',
    usage: data.usage,
  };
}

async function generate(prompt, options = {}) {
  const messages = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });
  return chat(messages, options);
}

async function embeddings(text, options = {}) {
  const model = options.model || 'text-embedding-3-small';

  const res = await request(`${config.ai.openai.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ai.openai.apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
    timeout: config.ai.openai.timeoutMs,
  });

  if (res.status !== 200) throw new Error(`OpenAI embeddings error: ${res.status}`);
  const data = JSON.parse(res.body);
  return data.data?.[0]?.embedding || [];
}

module.exports = { checkHealth, chat, generate, embeddings };
