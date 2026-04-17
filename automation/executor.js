const { execFile, spawn } = require('child_process');
const path = require('path');
const config = require('../core/config');
const { logger } = require('../core/logger');

const log = logger.child('automation:executor');

const BLOCKED_COMMANDS = new Set([
  'rm', 'rmdir', 'del', 'format', 'mkfs', 'dd',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'passwd', 'chown', 'chmod', 'chgrp',
  'kill', 'killall', 'pkill',
]);

const BLOCKED_PATTERNS = [
  /rm\s+(-rf|-fr)\s+\//,
  />\s*\/dev\/sd/,
  /mkfs/,
  /:(){ :|:& };:/,
  /fork\s*bomb/i,
];

function isSafe(command) {
  const parts = command.trim().split(/\s+/);
  const cmd = path.basename(parts[0]).toLowerCase();

  if (BLOCKED_COMMANDS.has(cmd)) return false;
  if (BLOCKED_PATTERNS.some(p => p.test(command))) return false;

  return true;
}

function isPathAllowed(targetPath) {
  if (!config.automation.sandboxed) return true;
  const resolved = path.resolve(targetPath);
  return config.automation.allowedPaths.some(allowed =>
    resolved.startsWith(path.resolve(allowed))
  );
}

function execute(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const fullCmd = [command, ...args].join(' ');

    if (config.automation.sandboxed && !isSafe(fullCmd)) {
      reject(new Error(`Command blocked by safety filter: ${command}`));
      return;
    }

    const timeout = options.timeout || 30000;
    const cwd = options.cwd || config.root;

    if (cwd && !isPathAllowed(cwd)) {
      reject(new Error(`Path not allowed: ${cwd}`));
      return;
    }

    execFile(command, args, { timeout, cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          exitCode: err.code,
          stdout: stdout || '',
          stderr: stderr || err.message,
        });
        return;
      }
      resolve({
        success: true,
        exitCode: 0,
        stdout: stdout || '',
        stderr: stderr || '',
      });
    });
  });
}

function executeStream(command, args = [], options = {}) {
  const fullCmd = [command, ...args].join(' ');
  if (config.automation.sandboxed && !isSafe(fullCmd)) {
    throw new Error(`Command blocked by safety filter: ${command}`);
  }

  const cwd = options.cwd || config.root;
  if (cwd && !isPathAllowed(cwd)) {
    throw new Error(`Path not allowed: ${cwd}`);
  }

  const proc = spawn(command, args, {
    cwd,
    timeout: options.timeout || 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return proc;
}

module.exports = { execute, executeStream, isSafe, isPathAllowed };
