const { EventEmitter } = require('events');
const { logger } = require('./logger');
const config = require('./config');

class Engine extends EventEmitter {
  constructor() {
    super();
    this.log = logger.child('engine');
    this.modules = new Map();
    this.started = false;
    this._startTime = null;
  }

  register(name, module) {
    if (this.modules.has(name)) {
      this.log.warn(`Module "${name}" already registered, replacing`);
    }
    this.modules.set(name, module);
    this.log.debug(`Registered module: ${name}`);
    return this;
  }

  get(name) {
    return this.modules.get(name);
  }

  async start() {
    this.log.info('Starting Jarvis engine...');
    this._startTime = Date.now();

    const initOrder = [
      'memory', 'ai', 'plugins', 'automation',
      'voice', 'commands', 'api',
    ];

    for (const name of initOrder) {
      const mod = this.modules.get(name);
      if (mod && typeof mod.init === 'function') {
        this.log.info(`Initializing module: ${name}`);
        try {
          await mod.init(this);
        } catch (err) {
          this.log.error(`Failed to initialize module: ${name}`, { error: err.message });
          this.emit('module:error', { name, error: err });
        }
      }
    }

    this.started = true;
    this.emit('started');
    this.log.info('Jarvis engine started');
    return this;
  }

  async stop() {
    this.log.info('Stopping Jarvis engine...');
    const names = [...this.modules.keys()].reverse();
    for (const name of names) {
      const mod = this.modules.get(name);
      if (mod && typeof mod.shutdown === 'function') {
        try {
          await mod.shutdown();
        } catch (err) {
          this.log.error(`Error shutting down module: ${name}`, { error: err.message });
        }
      }
    }
    this.started = false;
    this.emit('stopped');
    this.log.info('Jarvis engine stopped');
  }

  uptime() {
    if (!this._startTime) return 0;
    return Date.now() - this._startTime;
  }

  status() {
    const moduleStatus = {};
    for (const [name, mod] of this.modules) {
      moduleStatus[name] = typeof mod.status === 'function' ? mod.status() : 'registered';
    }
    return {
      started: this.started,
      uptime: this.uptime(),
      modules: moduleStatus,
    };
  }
}

module.exports = { Engine };
