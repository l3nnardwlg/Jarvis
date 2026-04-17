const readline = require('readline');
const { request } = require('../core/http-client');
const config = require('../core/config');

const BASE_URL = `http://localhost:${config.server.port}`;

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

class CLI {
  constructor() {
    this.rl = null;
    this.sessionId = `cli_${Date.now()}`;
    this.mode = 'standard';
    this.running = false;
  }

  start() {
    this.running = true;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(colorize('\n  ╔═══════════════════════════════════════╗', 'cyan'));
    console.log(colorize('  ║           J.A.R.V.I.S  v2.0          ║', 'cyan'));
    console.log(colorize('  ║     Just A Rather Very Intelligent    ║', 'cyan'));
    console.log(colorize('  ║              System                   ║', 'cyan'));
    console.log(colorize('  ╚═══════════════════════════════════════╝\n', 'cyan'));
    console.log(colorize('  Type /help for commands, /quit to exit\n', 'dim'));

    this._prompt();
  }

  _prompt() {
    const modeTag = colorize(`[${this.mode}]`, 'dim');
    this.rl.question(`${colorize('JARVIS', 'cyan')} ${modeTag} ${colorize('>', 'green')} `, async (input) => {
      if (!this.running) return;
      const trimmed = input.trim();
      if (!trimmed) { this._prompt(); return; }

      if (trimmed.startsWith('/')) {
        await this._handleCommand(trimmed);
      } else {
        await this._chat(trimmed);
      }

      if (this.running) this._prompt();
    });
  }

  async _handleCommand(input) {
    const parts = input.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        console.log(colorize('\n  Available Commands:', 'yellow'));
        console.log('    /help              Show this help');
        console.log('    /status            System status');
        console.log('    /mode <name>       Switch mode (standard/dev/creative/analyst)');
        console.log('    /plugins           List plugins');
        console.log('    /commands          List available commands');
        console.log('    /run <cmd> [args]  Execute a plugin command');
        console.log('    /memory            View memory status');
        console.log('    /remember <text>   Store a fact');
        console.log('    /note <title|body> Save a note');
        console.log('    /search <query>    Search memory');
        console.log('    /voice             Voice status');
        console.log('    /exec <cmd>        Execute system command');
        console.log('    /clear             Clear screen');
        console.log('    /quit              Exit\n');
        break;

      case 'status':
        await this._apiGet('/api/status');
        break;

      case 'mode':
        if (args[0]) {
          this.mode = args[0];
          console.log(colorize(`  Mode switched to: ${this.mode}`, 'green'));
        } else {
          await this._apiGet('/api/modes');
        }
        break;

      case 'plugins':
        await this._apiGet('/api/plugins');
        break;

      case 'commands':
        await this._apiGet('/api/commands');
        break;

      case 'run':
        if (args.length === 0) { console.log(colorize('  Usage: /run <command> [args]', 'yellow')); break; }
        await this._apiPost('/api/command', { command: args[0], args: args.slice(1) });
        break;

      case 'memory':
        await this._apiGet('/api/memory');
        break;

      case 'remember':
        if (args.length === 0) { console.log(colorize('  Usage: /remember <fact>', 'yellow')); break; }
        await this._apiPost('/api/memory/fact', { content: args.join(' ') });
        break;

      case 'note': {
        const text = args.join(' ');
        const pipeIdx = text.indexOf('|');
        const title = pipeIdx > 0 ? text.slice(0, pipeIdx).trim() : 'Note';
        const content = pipeIdx > 0 ? text.slice(pipeIdx + 1).trim() : text;
        await this._apiPost('/api/memory/note', { title, content });
        break;
      }

      case 'search':
        if (args.length === 0) { console.log(colorize('  Usage: /search <query>', 'yellow')); break; }
        await this._apiPost('/api/memory/search', { query: args.join(' ') });
        break;

      case 'voice':
        await this._apiGet('/api/voice/status');
        break;

      case 'exec':
        if (args.length === 0) { console.log(colorize('  Usage: /exec <command> [args]', 'yellow')); break; }
        await this._apiPost('/api/exec', { command: args[0], args: args.slice(1) });
        break;

      case 'clear':
        console.clear();
        break;

      case 'quit':
      case 'exit':
        this.running = false;
        console.log(colorize('\n  Goodbye, sir.\n', 'cyan'));
        this.rl.close();
        process.exit(0);
        break;

      default:
        console.log(colorize(`  Unknown command: /${cmd}. Type /help for available commands.`, 'red'));
    }
  }

  async _chat(message) {
    try {
      const res = await request(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: this.sessionId, mode: this.mode }),
        timeout: 60000,
      });

      const ct = res.headers['content-type'] || '';
      if (ct.includes('text/event-stream') || res.body.startsWith('data:')) {
        const lines = res.body.split('\n');
        let fullText = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) { process.stdout.write(colorize(data.token, 'green')); fullText += data.token; }
              if (data.full) fullText = data.full;
            } catch {}
          }
        }
        if (fullText) console.log();
      } else {
        const data = JSON.parse(res.body);
        if (data.response) {
          console.log(colorize(`\n  ${data.response}\n`, 'green'));
        } else if (data.error) {
          console.log(colorize(`  Error: ${data.error}`, 'red'));
        }
      }
    } catch (err) {
      console.log(colorize(`  Connection error: ${err.message}`, 'red'));
      console.log(colorize('  Make sure Jarvis server is running (node main.js)', 'dim'));
    }
  }

  async _apiGet(path) {
    try {
      const res = await request(`${BASE_URL}${path}`, { timeout: 5000 });
      const data = JSON.parse(res.body);
      console.log(colorize('\n' + JSON.stringify(data, null, 2) + '\n', 'dim'));
    } catch (err) {
      console.log(colorize(`  Error: ${err.message}`, 'red'));
    }
  }

  async _apiPost(path, body) {
    try {
      const res = await request(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 10000,
      });
      const data = JSON.parse(res.body);
      console.log(colorize('\n' + JSON.stringify(data, null, 2) + '\n', 'dim'));
    } catch (err) {
      console.log(colorize(`  Error: ${err.message}`, 'red'));
    }
  }
}

if (require.main === module) {
  const cli = new CLI();
  cli.start();
}

module.exports = { CLI };
