const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { logger } = require('../core/logger');

const log = logger.child('automation:scheduler');

class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.timers = new Map();
    this._file = path.join(config.dataDir, 'scheduled-tasks.json');
  }

  async init(engine) {
    this.engine = engine;
    this._load();
    this._startAll();
    log.info(`Scheduler initialized: ${this.tasks.size} tasks`);
  }

  _load() {
    try {
      if (fs.existsSync(this._file)) {
        const data = JSON.parse(fs.readFileSync(this._file, 'utf8'));
        for (const task of data) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (err) {
      log.error('Failed to load scheduled tasks', { error: err.message });
    }
  }

  _save() {
    try {
      const dir = path.dirname(this._file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._file, JSON.stringify([...this.tasks.values()], null, 2));
    } catch (err) {
      log.error('Failed to save scheduled tasks', { error: err.message });
    }
  }

  _startAll() {
    for (const [id, task] of this.tasks) {
      if (task.enabled) this._schedule(task);
    }
  }

  _schedule(task) {
    if (this.timers.has(task.id)) {
      clearInterval(this.timers.get(task.id));
    }

    if (task.type === 'interval') {
      const timer = setInterval(() => this._execute(task), task.intervalMs);
      this.timers.set(task.id, timer);
    } else if (task.type === 'once') {
      const delay = new Date(task.runAt).getTime() - Date.now();
      if (delay > 0) {
        const timer = setTimeout(() => {
          this._execute(task);
          this.remove(task.id);
        }, delay);
        this.timers.set(task.id, timer);
      }
    } else if (task.type === 'cron') {
      const timer = setInterval(() => {
        if (this._cronMatch(task.cron)) this._execute(task);
      }, 60000);
      this.timers.set(task.id, timer);
    }
  }

  async _execute(task) {
    log.info(`Executing scheduled task: ${task.name}`);
    task.lastRun = Date.now();
    task.runCount = (task.runCount || 0) + 1;
    this._save();

    try {
      if (task.handler && this.engine) {
        const plugins = this.engine.get('plugins');
        if (plugins) {
          const cmd = plugins.getCommand(task.command);
          if (cmd && cmd.run) {
            await cmd.run(task.args || []);
          }
        }
      }
      if (task.callback) task.callback();
    } catch (err) {
      log.error(`Scheduled task error: ${task.name}`, { error: err.message });
    }
  }

  _cronMatch(cronExpr) {
    const now = new Date();
    const [min, hour, dom, month, dow] = cronExpr.split(' ');

    const matches = (field, value) => {
      if (field === '*') return true;
      if (field.includes('/')) {
        const [, step] = field.split('/');
        return value % parseInt(step) === 0;
      }
      return field.split(',').some(v => parseInt(v) === value);
    };

    return matches(min, now.getMinutes()) &&
           matches(hour, now.getHours()) &&
           matches(dom, now.getDate()) &&
           matches(month, now.getMonth() + 1) &&
           matches(dow, now.getDay());
  }

  add(task) {
    if (this.tasks.size >= config.automation.maxScheduledTasks) {
      throw new Error('Maximum scheduled tasks reached');
    }

    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fullTask = {
      id,
      name: task.name || 'Unnamed Task',
      type: task.type || 'interval',
      command: task.command || null,
      args: task.args || [],
      intervalMs: task.intervalMs || 60000,
      cron: task.cron || null,
      runAt: task.runAt || null,
      enabled: true,
      createdAt: Date.now(),
      lastRun: null,
      runCount: 0,
    };

    this.tasks.set(id, fullTask);
    this._schedule(fullTask);
    this._save();
    return fullTask;
  }

  remove(id) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }
    const removed = this.tasks.delete(id);
    if (removed) this._save();
    return removed;
  }

  toggle(id) {
    const task = this.tasks.get(id);
    if (!task) return false;
    task.enabled = !task.enabled;
    if (task.enabled) {
      this._schedule(task);
    } else if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
    }
    this._save();
    return task;
  }

  list() {
    return [...this.tasks.values()];
  }

  status() {
    return {
      totalTasks: this.tasks.size,
      activeTasks: [...this.tasks.values()].filter(t => t.enabled).length,
    };
  }

  shutdown() {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this.timers.clear();
    this._save();
  }
}

module.exports = { Scheduler };
