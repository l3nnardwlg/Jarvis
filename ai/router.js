const config = require('../core/config');
const { logger } = require('../core/logger');
const ollama = require('./providers/ollama');
const openai = require('./providers/openai');

const log = logger.child('ai:router');

const providers = { ollama, openai };

class AIRouter {
  constructor() {
    this.activeProvider = null;
    this.fallbackOrder = ['ollama', 'openai'];
  }

  async init(engine) {
    this.engine = engine;
    await this._detectProvider();
    log.info(`Active AI provider: ${this.activeProvider || 'none'}`);
  }

  async _detectProvider() {
    const preferred = config.ai.defaultProvider;
    if (providers[preferred]) {
      try {
        const healthy = await providers[preferred].checkHealth();
        if (healthy) { this.activeProvider = preferred; return; }
      } catch {}
    }

    for (const name of this.fallbackOrder) {
      if (name === preferred) continue;
      const p = providers[name];
      if (!p) continue;
      try {
        const healthy = await p.checkHealth();
        if (healthy) { this.activeProvider = name; return; }
      } catch {}
    }
    log.warn('No AI provider available');
  }

  get provider() {
    if (!this.activeProvider) return null;
    return providers[this.activeProvider];
  }

  async chat(messages, options = {}) {
    const p = this.provider;
    if (!p) throw new Error('No AI provider available');
    try {
      return await p.chat(messages, options);
    } catch (err) {
      log.error(`Chat error with ${this.activeProvider}`, { error: err.message });
      const fallback = await this._tryFallback('chat', messages, options);
      if (fallback) return fallback;
      throw err;
    }
  }

  async chatStream(messages, options = {}) {
    const p = this.provider;
    if (!p || !p.chatStream) throw new Error('Streaming not available');
    return p.chatStream(messages, options);
  }

  async generate(prompt, options = {}) {
    const p = this.provider;
    if (!p) throw new Error('No AI provider available');
    try {
      return await p.generate(prompt, options);
    } catch (err) {
      log.error(`Generate error with ${this.activeProvider}`, { error: err.message });
      const fallback = await this._tryFallback('generate', prompt, options);
      if (fallback) return fallback;
      throw err;
    }
  }

  async embeddings(text, options = {}) {
    const p = this.provider;
    if (!p || !p.embeddings) throw new Error('Embeddings not available');
    return p.embeddings(text, options);
  }

  async _tryFallback(method, ...args) {
    for (const name of this.fallbackOrder) {
      if (name === this.activeProvider) continue;
      const p = providers[name];
      if (!p || !p[method]) continue;
      try {
        const healthy = await p.checkHealth();
        if (!healthy) continue;
        log.info(`Falling back to ${name}`);
        this.activeProvider = name;
        return await p[method](...args);
      } catch {}
    }
    return null;
  }

  status() {
    return { provider: this.activeProvider, available: this.activeProvider !== null };
  }

  shutdown() {}
}

module.exports = { AIRouter };
