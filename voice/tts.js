const { request } = require('../core/http-client');
const config = require('../core/config');
const { logger } = require('../core/logger');

const log = logger.child('voice:tts');

async function synthesize(text, options = {}) {
  const provider = options.provider || config.voice.tts.provider;

  if (provider === 'piper') {
    return synthesizePiper(text, options);
  }

  throw new Error(`Unknown TTS provider: ${provider}`);
}

async function synthesizePiper(text, options = {}) {
  const endpoint = config.voice.tts.piper.endpoint;
  const voice = options.voice || config.voice.tts.piper.voice;

  const res = await request(`${endpoint}/api/tts?voice=${encodeURIComponent(voice)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: text,
    timeout: 15000,
  });

  if (res.status !== 200) throw new Error(`Piper TTS error: ${res.status}`);

  return {
    audio: Buffer.from(res.body, 'binary'),
    format: 'wav',
    voice,
  };
}

async function checkHealth() {
  try {
    const endpoint = config.voice.tts.piper.endpoint;
    const res = await request(`${endpoint}/api/voices`, { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function listVoices() {
  try {
    const endpoint = config.voice.tts.piper.endpoint;
    const res = await request(`${endpoint}/api/voices`, { timeout: 5000 });
    if (res.status === 200) return JSON.parse(res.body);
  } catch {}
  return [];
}

module.exports = { synthesize, checkHealth, listVoices };
