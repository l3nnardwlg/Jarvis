require('dotenv/config');

const path = require('path');

const API_KEY = process.env.API_KEY;
const API_URL = process.env.API_URL;

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const config = {
  root: ROOT_DIR,
  dataDir: DATA_DIR,

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
  },

  ai: {
    defaultProvider: process.env.AI_PROVIDER || 'jarvisapi',
    jarvisapi: {
      enabled: process.env.JARVIS_API_ENABLED !== 'false',
      endpoint: process.env.JARVIS_API_ENDPOINT || API_URL || 'http://135.181.117.35:3000/chat',
      apiKey: process.env.JARVIS_API_KEY || API_KEY || '123456789',
      model: process.env.JARVIS_API_MODEL || 'jarvis-remote',
      temperature: parseFloat(process.env.JARVIS_API_TEMPERATURE || '0.3'),
      timeoutMs: parseInt(process.env.JARVIS_API_TIMEOUT_MS || '30000', 10),
      healthTtlMs: parseInt(process.env.JARVIS_API_HEALTH_TTL_MS || '30000', 10),
    },
    ollama: {
      enabled: process.env.OLLAMA_ENABLED !== 'false',
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3',
      temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.2'),
      timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '15000', 10),
      healthTtlMs: parseInt(process.env.OLLAMA_HEALTH_TTL_MS || '30000', 10),
      retryAfterFailureMs: parseInt(process.env.OLLAMA_RETRY_AFTER_FAILURE_MS || '15000', 10),
    },
    openai: {
      enabled: !!process.env.OPENAI_API_KEY,
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
    },
  },

  voice: {
    enabled: process.env.VOICE_ENABLED !== 'false',
    stt: {
      provider: process.env.STT_PROVIDER || 'whisper',
      whisper: {
        model: process.env.WHISPER_MODEL || 'base',
        endpoint: process.env.WHISPER_ENDPOINT || 'http://localhost:9000',
      },
    },
    tts: {
      provider: process.env.TTS_PROVIDER || 'piper',
      piper: {
        endpoint: process.env.PIPER_ENDPOINT || 'http://localhost:5500',
        voice: process.env.PIPER_VOICE || 'en_US-lessac-medium',
      },
    },
    wakeWord: process.env.WAKE_WORD || 'jarvis',
  },

  memory: {
    shortTermMaxItems: parseInt(process.env.MEMORY_SHORT_TERM_MAX || '100', 10),
    longTermFile: path.join(DATA_DIR, 'long-term-memory.json'),
    vectorFile: path.join(DATA_DIR, 'vector-store.json'),
    embeddingDim: 384,
  },

  plugins: {
    dir: path.join(ROOT_DIR, 'plugins', 'installed'),
    autoload: process.env.PLUGINS_AUTOLOAD !== 'false',
  },

  automation: {
    sandboxed: process.env.AUTOMATION_SANDBOXED !== 'false',
    allowedPaths: (process.env.AUTOMATION_ALLOWED_PATHS || ROOT_DIR).split(','),
    maxScheduledTasks: parseInt(process.env.MAX_SCHEDULED_TASKS || '50', 10),
  },

  search: {
    enabled: process.env.SEARXNG_ENABLED !== 'false',
    endpoint: process.env.SEARXNG_ENDPOINT || 'http://localhost:8888',
    timeoutMs: parseInt(process.env.SEARXNG_TIMEOUT_MS || '5000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: path.join(DATA_DIR, 'jarvis.log'),
    maxSizeMb: parseInt(process.env.LOG_MAX_SIZE_MB || '10', 10),
  },
};

module.exports = config;
