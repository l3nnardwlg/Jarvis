require('dotenv/config');

const { Engine } = require('./core/engine');
const { logger } = require('./core/logger');
const config = require('./core/config');
const { AIRouter } = require('./ai/router');
const { ContextManager } = require('./ai/context');
const { MemorySystem } = require('./memory/store');
const { PluginLoader } = require('./plugins/loader');
const { Scheduler } = require('./automation/scheduler');
const { VoiceModule } = require('./voice/index');
const { APIServer } = require('./api/server');
const { CommandSystem } = require('./core/commands');

const log = logger.child('main');

async function main() {
  const engine = new Engine();

  // Register all modules
  const ai = new AIRouter();
  const context = new ContextManager();
  const memory = new MemorySystem();
  const plugins = new PluginLoader();
  const commands = new CommandSystem();
  const scheduler = new Scheduler();
  const voice = new VoiceModule();
  const api = new APIServer();

  engine.register('ai', ai);
  engine.register('context', context);
  engine.register('memory', memory);
  engine.register('plugins', plugins);
  engine.register('commands', commands);
  engine.register('scheduler', scheduler);
  engine.register('voice', voice);
  engine.register('api', api);

  // Start the engine (initializes all modules in order)
  await engine.start();

  // Graceful shutdown
  const shutdown = async (signal) => {
    log.info(`Received ${signal}, shutting down...`);
    await engine.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log.info(`
  ╔═══════════════════════════════════════╗
  ║           J.A.R.V.I.S  v2.0          ║
  ║     Just A Rather Very Intelligent    ║
  ║              System                   ║
  ╚═══════════════════════════════════════╝

  Server:  http://localhost:${config.server.port}
  AI:      ${ai.activeProvider || 'none'}
  Plugins: ${plugins.plugins?.size || 0} loaded
  Memory:  ${memory.vectorStore?.size() || 0} vectors
  Voice:   Browser wakeword client-side | Server STT ${voice.sttAvailable ? 'ON' : 'OFF'} | TTS ${voice.ttsAvailable ? 'ON' : 'OFF'}
  `);
}

main().catch((err) => {
  log.error('Fatal error', { error: err.message });
  console.error(err);
  process.exit(1);
});
