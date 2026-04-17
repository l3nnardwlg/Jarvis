const config = require('../../core/config');
const { logger } = require('../../core/logger');
const { request } = require('../../core/http-client');

const log = logger.child('ai:jarvisapi');

let healthCache = { healthy: null, checkedAt: 0 };

function getChatEndpoint() {
  const endpoint = String(config.ai.jarvisapi.endpoint || '').replace(/\/+$/, '');
  if (endpoint.endsWith('/chat')) {
    return endpoint;
  }
  return `${endpoint}/chat`;
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (config.ai.jarvisapi.apiKey) {
    headers['x-api-key'] = config.ai.jarvisapi.apiKey;
  }
  return headers;
}

function extractPrompt(messages) {
  const normalized = Array.isArray(messages) ? messages : [];
  const userMessages = normalized.filter((message) => message && message.role === 'user');
  const latestUserMessage = userMessages[userMessages.length - 1];

  if (latestUserMessage && latestUserMessage.content) {
    return latestUserMessage.content;
  }

  const latestMessage = normalized[normalized.length - 1];
  return latestMessage?.content || '';
}

function extractContent(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.response === 'string') return data.response;
  if (typeof data.content === 'string') return data.content;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.message?.content === 'string') return data.message.content;
  return '';
}

async function checkHealth() {
  if (!config.ai.jarvisapi.enabled) return false;

  const now = Date.now();
  if (healthCache.healthy !== null && (now - healthCache.checkedAt) < config.ai.jarvisapi.healthTtlMs) {
    return healthCache.healthy;
  }

  try {
    const res = await request(getChatEndpoint(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message: 'ping' }),
      timeout: Math.min(config.ai.jarvisapi.timeoutMs, 5000),
    });
    healthCache = { healthy: res.status === 200, checkedAt: now };
  } catch (error) {
    log.warn('Health check failed', { error: error.message });
    healthCache = { healthy: false, checkedAt: now };
  }

  return healthCache.healthy;
}

async function chat(messages, options = {}) {
  const prompt = extractPrompt(messages);
  const model = options.model || config.ai.jarvisapi.model;

  const payload = {
    message: prompt,
    messages,
    temperature: options.temperature ?? config.ai.jarvisapi.temperature,
  };

  const res = await request(getChatEndpoint(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
    timeout: config.ai.jarvisapi.timeoutMs,
  });

  if (res.status !== 200) {
    throw new Error(`Jarvis API error: ${res.status} ${res.body}`);
  }

  const data = JSON.parse(res.body);
  return {
    content: extractContent(data),
    model,
    provider: 'jarvisapi',
    usage: data.usage,
  };
}

async function generate(prompt, options = {}) {
  const messages = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: prompt });
  return chat(messages, options);
}

module.exports = { checkHealth, chat, generate };