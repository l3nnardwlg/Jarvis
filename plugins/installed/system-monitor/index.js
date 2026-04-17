const os = require('os');
const { PluginBase } = require('../../base');

class SystemMonitorPlugin extends PluginBase {
  constructor(manifest) {
    super(manifest);

    this.registerCommand({
      name: 'sysinfo',
      aliases: ['system', 'monitor', 'resources'],
      description: 'Show system resource usage',
      usage: 'sysinfo',
      run: () => this.getSystemInfo(),
    });

    this.registerCommand({
      name: 'processes',
      aliases: ['top', 'ps'],
      description: 'Show top processes by memory',
      usage: 'processes',
      run: () => this.getProcessInfo(),
    });
  }

  getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const uptimeSec = os.uptime();
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);

    const cpuLoad = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return ((total - idle) / total * 100).toFixed(1);
    });
    const avgLoad = (cpuLoad.reduce((a, b) => a + parseFloat(b), 0) / cpuLoad.length).toFixed(1);

    return {
      type: 'card',
      title: 'System Information',
      content: [
        `Platform: ${os.platform()} ${os.arch()}`,
        `Hostname: ${os.hostname()}`,
        `OS: ${os.type()} ${os.release()}`,
        `Uptime: ${hours}h ${minutes}m`,
        `CPU: ${cpus[0]?.model || 'Unknown'} (${cpus.length} cores)`,
        `CPU Usage: ${avgLoad}% avg`,
        `Memory: ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${((usedMem / totalMem) * 100).toFixed(1)}%)`,
        `Free Memory: ${formatBytes(freeMem)}`,
      ].join('\n'),
    };
  }

  getProcessInfo() {
    const memUsage = process.memoryUsage();
    return {
      type: 'card',
      title: 'Jarvis Process Info',
      content: [
        `PID: ${process.pid}`,
        `Node.js: ${process.version}`,
        `Heap Used: ${formatBytes(memUsage.heapUsed)}`,
        `Heap Total: ${formatBytes(memUsage.heapTotal)}`,
        `RSS: ${formatBytes(memUsage.rss)}`,
        `External: ${formatBytes(memUsage.external)}`,
      ].join('\n'),
    };
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

module.exports = SystemMonitorPlugin;
