const path = require('path');
const { loadCommands } = require('../lib/command-loader');
const { findBestCommand, normalizeInput } = require('../lib/parser');
const respond = require('../lib/response');
const helpers = require('../lib/helpers');
const { logger } = require('./logger');

const log = logger.child('commands');

class CommandSystem {
  constructor() {
    this.commands = [];
    this.state = {
      lightsOn: false,
      focusMode: false,
      alarmArmed: false,
      context: { lastResult: null },
    };
  }

  async init(engine) {
    this.engine = engine;
    const commandsDir = path.join(__dirname, '..', 'commands');
    try {
      this.commands = loadCommands(commandsDir);
      log.info(`Loaded ${this.commands.length} legacy commands`);
    } catch (err) {
      log.error('Failed to load legacy commands', { error: err.message });
    }
  }

  tryMatch(input) {
    const normalized = normalizeInput(input);
    const context = {
      input,
      normalizedInput: normalized,
      state: this.state,
      helpers,
      respond,
    };
    return findBestCommand(this.commands, context);
  }

  async execute(input, memoryStore) {
    const normalized = normalizeInput(input);
    const context = {
      input,
      normalizedInput: normalized,
      state: this.state,
      memory: memoryStore || {},
      helpers,
      respond,
    };
    const command = findBestCommand(this.commands, context);

    if (!command) return null;

    try {
      const result = await command.run(context);
      return result;
    } catch (err) {
      log.error(`Command "${command.name}" error`, { error: err.message });
      return respond.error(`Command error: ${err.message}`);
    }
  }

  list() {
    return this.commands.map(c => ({
      name: c.name,
      triggers: c.triggers || [],
    }));
  }

  status() {
    return { loaded: this.commands.length };
  }

  shutdown() {}
}

module.exports = { CommandSystem };
