const { PluginBase } = require('../../base');
const vm = require('vm');
const { execFile } = require('child_process');

class CodeExecutorPlugin extends PluginBase {
  constructor(manifest) {
    super(manifest);

    this.registerCommand({
      name: 'run-js',
      aliases: ['eval', 'javascript', 'js'],
      description: 'Execute JavaScript code safely',
      usage: 'run-js <code>',
      run: (args) => this.runJS(args.join(' ')),
    });

    this.registerCommand({
      name: 'run-python',
      aliases: ['python', 'py'],
      description: 'Execute Python code',
      usage: 'run-python <code>',
      run: (args) => this.runPython(args.join(' ')),
    });
  }

  async runJS(code) {
    if (!code.trim()) return { type: 'text', content: 'No code provided.' };

    try {
      const logs = [];
      const sandbox = {
        console: {
          log: (...args) => logs.push(args.map(String).join(' ')),
          error: (...args) => logs.push('[ERROR] ' + args.map(String).join(' ')),
          warn: (...args) => logs.push('[WARN] ' + args.map(String).join(' ')),
        },
        Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite,
        Array, Object, String, Number, Boolean, Map, Set, RegExp,
        setTimeout: undefined, setInterval: undefined,
        require: undefined, process: undefined,
      };

      const ctx = vm.createContext(sandbox);
      const result = vm.runInContext(code, ctx, { timeout: 5000 });

      const output = logs.length > 0 ? logs.join('\n') + '\n' : '';
      const resultStr = result !== undefined ? `=> ${JSON.stringify(result)}` : '';

      return {
        type: 'card',
        title: 'JavaScript Execution',
        content: `\`\`\`\n${output}${resultStr}\n\`\`\``,
      };
    } catch (err) {
      return {
        type: 'error',
        content: `Execution error: ${err.message}`,
      };
    }
  }

  async runPython(code) {
    if (!code.trim()) return { type: 'text', content: 'No code provided.' };

    return new Promise((resolve) => {
      const proc = execFile('python', ['-c', code], { timeout: 10000 }, (err, stdout, stderr) => {
        if (err) {
          resolve({
            type: 'error',
            content: `Python error: ${stderr || err.message}`,
          });
          return;
        }
        resolve({
          type: 'card',
          title: 'Python Execution',
          content: `\`\`\`\n${stdout}${stderr ? '\n[stderr] ' + stderr : ''}\n\`\`\``,
        });
      });
    });
  }
}

module.exports = CodeExecutorPlugin;
