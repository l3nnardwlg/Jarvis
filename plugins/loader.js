const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { logger } = require('../core/logger');

const log = logger.child('plugins:loader');

class PluginLoader {
  constructor() {
    this.plugins = new Map();
    this.commands = new Map();
  }

  async init(engine) {
    this.engine = engine;
    if (config.plugins.autoload) {
      await this.loadAll();
    }
    log.info(`Loaded ${this.plugins.size} plugins, ${this.commands.size} commands`);
  }

  async loadAll() {
    const dir = config.plugins.dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadPlugin(path.join(dir, entry.name));
      }
    }
  }

  async loadPlugin(pluginPath) {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        log.warn(`No manifest.json in ${pluginPath}`);
        return null;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const mainFile = path.join(pluginPath, manifest.main || 'index.js');

      if (!fs.existsSync(mainFile)) {
        log.warn(`Main file not found: ${mainFile}`);
        return null;
      }

      const PluginClass = require(mainFile);
      const plugin = typeof PluginClass === 'function'
        ? new PluginClass(manifest)
        : PluginClass;

      if (typeof plugin.init === 'function') {
        await plugin.init(this.engine);
      }

      this.plugins.set(manifest.id, plugin);

      if (plugin.commands) {
        for (const cmd of plugin.commands) {
          this.commands.set(cmd.name, cmd);
          if (cmd.aliases) {
            for (const alias of cmd.aliases) {
              this.commands.set(alias, cmd);
            }
          }
        }
      }

      log.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);
      return plugin;
    } catch (err) {
      log.error(`Failed to load plugin at ${pluginPath}`, { error: err.message });
      return null;
    }
  }

  getPlugin(id) {
    return this.plugins.get(id);
  }

  getCommand(name) {
    return this.commands.get(name);
  }

  listPlugins() {
    return [...this.plugins.values()].map(p =>
      typeof p.status === 'function' ? p.status() : { id: p.id, name: p.name }
    );
  }

  listCommands() {
    const unique = new Map();
    for (const [name, cmd] of this.commands) {
      if (!unique.has(cmd.name)) unique.set(cmd.name, cmd);
    }
    return [...unique.values()].map(c => ({
      name: c.name,
      description: c.description,
      pluginId: c.pluginId,
    }));
  }

  async unloadPlugin(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) return false;
    if (typeof plugin.shutdown === 'function') await plugin.shutdown();
    if (plugin.commands) {
      for (const cmd of plugin.commands) {
        this.commands.delete(cmd.name);
        if (cmd.aliases) cmd.aliases.forEach(a => this.commands.delete(a));
      }
    }
    this.plugins.delete(id);
    return true;
  }

  async shutdown() {
    for (const [id, plugin] of this.plugins) {
      if (typeof plugin.shutdown === 'function') {
        try { await plugin.shutdown(); } catch {}
      }
    }
  }

  status() {
    return {
      plugins: this.plugins.size,
      commands: this.commands.size,
    };
  }
}

module.exports = { PluginLoader };
