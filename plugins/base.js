class PluginBase {
  constructor(manifest) {
    this.id = manifest.id;
    this.name = manifest.name;
    this.version = manifest.version || '1.0.0';
    this.description = manifest.description || '';
    this.author = manifest.author || 'unknown';
    this.commands = [];
    this.hooks = {};
    this._engine = null;
    this._enabled = true;
  }

  get engine() { return this._engine; }
  get enabled() { return this._enabled; }

  async init(engine) {
    this._engine = engine;
  }

  async shutdown() {}

  enable() { this._enabled = true; }
  disable() { this._enabled = false; }

  registerCommand(command) {
    this.commands.push({
      ...command,
      pluginId: this.id,
    });
  }

  registerHook(event, handler) {
    if (!this.hooks[event]) this.hooks[event] = [];
    this.hooks[event].push(handler);
  }

  status() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      enabled: this._enabled,
      commands: this.commands.map(c => c.name),
    };
  }
}

module.exports = { PluginBase };
