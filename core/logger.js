const fs = require('fs');
const path = require('path');
const config = require('./config');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

class Logger {
  constructor(namespace = 'jarvis') {
    this.namespace = namespace;
    this.level = LEVELS[config.logging.level] ?? LEVELS.info;
    this._stream = null;
  }

  _getStream() {
    if (!this._stream) {
      const dir = path.dirname(config.logging.file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this._stream = fs.createWriteStream(config.logging.file, { flags: 'a' });
    }
    return this._stream;
  }

  _format(level, msg, meta) {
    const ts = new Date().toISOString();
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    return `[${ts}] [${level.toUpperCase()}] [${this.namespace}] ${msg}${metaStr}`;
  }

  _log(level, msg, meta) {
    if (LEVELS[level] < this.level) return;
    const formatted = this._format(level, msg, meta);
    const color = COLORS[level] || '';
    console[level === 'error' ? 'error' : 'log'](`${color}${formatted}${RESET}`);
    try { this._getStream().write(formatted + '\n'); } catch {}
  }

  debug(msg, meta) { this._log('debug', msg, meta); }
  info(msg, meta) { this._log('info', msg, meta); }
  warn(msg, meta) { this._log('warn', msg, meta); }
  error(msg, meta) { this._log('error', msg, meta); }

  child(namespace) {
    return new Logger(`${this.namespace}:${namespace}`);
  }

  close() {
    if (this._stream) {
      this._stream.end();
      this._stream = null;
    }
  }
}

const rootLogger = new Logger();

module.exports = { Logger, logger: rootLogger };
