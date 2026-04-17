const { request } = require('../core/http-client');
const config = require('../core/config');
const { logger } = require('../core/logger');

const log = logger.child('voice:stt');

async function transcribe(audioBuffer, options = {}) {
  const provider = options.provider || config.voice.stt.provider;

  if (provider === 'whisper') {
    return transcribeWhisper(audioBuffer, options);
  }

  throw new Error(`Unknown STT provider: ${provider}`);
}

async function transcribeWhisper(audioBuffer, options = {}) {
  const endpoint = config.voice.stt.whisper.endpoint;
  const model = options.model || config.voice.stt.whisper.model;

  const boundary = '----JarvisBoundary' + Date.now();
  const parts = [];

  parts.push(`--${boundary}\r\n`);
  parts.push(`Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n`);
  parts.push(`Content-Type: audio/wav\r\n\r\n`);
  const headerBuf = Buffer.from(parts.join(''));

  const footerBuf = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n--${boundary}--\r\n`);

  const body = Buffer.concat([headerBuf, audioBuffer, footerBuf]);

  const res = await request(`${endpoint}/asr`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
    timeout: 30000,
  });

  if (res.status !== 200) throw new Error(`Whisper error: ${res.status}`);
  const data = JSON.parse(res.body);
  return {
    text: data.text || '',
    language: data.language || 'en',
    confidence: data.confidence || 1.0,
    duration: data.duration || 0,
  };
}

async function checkHealth() {
  try {
    const endpoint = config.voice.stt.whisper.endpoint;
    const res = await request(`${endpoint}/health`, { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

module.exports = { transcribe, checkHealth };
