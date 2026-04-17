const { sendJSON, sendSSE } = require('./helpers');
const { detectIntent } = require('../ai/intent');
const { logger } = require('../core/logger');

const log = logger.child('api:routes');

function createRouter(engine) {
  const routes = new Map();

  // --- Status ---
  routes.set('GET /api/status', (req, res) => {
    sendJSON(res, {
      status: 'online',
      name: 'Jarvis',
      version: '2.0.0',
      ...engine.status(),
    });
  });

  // --- Chat (SSE streaming) ---
  routes.set('POST /api/chat', async (req, res, body) => {
    const { message, sessionId = 'default', mode } = body;
    if (!message) return sendJSON(res, { error: 'message required' }, 400);

    const ai = engine.get('ai');
    const context = engine.get('context');
    const memory = engine.get('memory');
    const commands = engine.get('commands');
    const plugins = engine.get('plugins');

    if (mode && context) context.setMode(sessionId, mode);
    if (context) context.addMessage(sessionId, 'user', message);

    // 1) Try legacy commands first (amazon, light, weather, calc, etc.)
    if (commands) {
      try {
        const cmdResult = await commands.execute(message, memory?.longTerm || {});
        if (cmdResult) {
          const content = cmdResult.response?.content || cmdResult.content || JSON.stringify(cmdResult);
          if (context) context.addMessage(sessionId, 'assistant', content);
          return sendJSON(res, {
            response: content,
            type: cmdResult.response?.type || 'text',
            quickActions: cmdResult.quickActions || [],
            highlight: cmdResult.highlight || '',
            links: cmdResult.links || [],
            autoOpenLinks: cmdResult.autoOpenLinks || false,
            provider: 'command',
          });
        }
      } catch (err) {
        log.warn('Legacy command error', { error: err.message });
      }
    }

    // 2) Try plugin commands (match by first word)
    if (plugins) {
      const firstWord = message.trim().split(/\s+/)[0].toLowerCase();
      const pluginCmd = plugins.getCommand(firstWord);
      if (pluginCmd && pluginCmd.run) {
        try {
          const args = message.trim().split(/\s+/).slice(1);
          const result = await pluginCmd.run(args);
          const content = result?.content || result?.title || JSON.stringify(result);
          if (context) context.addMessage(sessionId, 'assistant', content);
          return sendJSON(res, { response: content, type: result?.type || 'text', provider: 'plugin' });
        } catch (err) {
          log.warn('Plugin command error', { error: err.message });
        }
      }
    }

    // 3) Try AI if available
    if (ai && ai.provider) {
      let memoryContext = '';
      if (memory) {
        memoryContext = await memory.getRelevantContext(message);
      }

      const messages = context
        ? context.buildMessages(sessionId, message, { memoryContext })
        : [{ role: 'user', content: message }];

      try {
        if (ai.activeProvider === 'ollama' && ai.provider.chatStream) {
          sendSSE(res);
          const stream = await ai.chatStream(messages);
          let fullResponse = '';

          for await (const chunk of stream) {
            fullResponse += chunk.content;
            res.write(`data: ${JSON.stringify({ token: chunk.content, done: chunk.done })}\n\n`);
          }

          res.write(`data: ${JSON.stringify({ done: true, full: fullResponse })}\n\n`);
          res.end();

          if (context) context.addMessage(sessionId, 'assistant', fullResponse);
          return;
        } else {
          const result = await ai.chat(messages);
          if (context) context.addMessage(sessionId, 'assistant', result.content);
          return sendJSON(res, { response: result.content, provider: result.provider, model: result.model });
        }
      } catch (err) {
        log.error('AI chat error', { error: err.message });
      }
    }

    // 4) Fallback — no command matched, no AI available
    sendJSON(res, {
      response: 'I couldn\'t find a matching command and no AI model is connected. Try commands like: "weather in London", "what time is it", "calculate 5*5", or connect an AI model (Ollama/OpenAI).',
      provider: null,
    });
  });

  // --- Command execution ---
  routes.set('POST /api/command', async (req, res, body) => {
    const { command, args = [] } = body;
    if (!command) return sendJSON(res, { error: 'command required' }, 400);

    const plugins = engine.get('plugins');
    if (!plugins) return sendJSON(res, { error: 'Plugin system not available' }, 503);

    const cmd = plugins.getCommand(command);
    if (!cmd) return sendJSON(res, { error: `Unknown command: ${command}` }, 404);

    try {
      const result = await cmd.run(args);
      sendJSON(res, { result });
    } catch (err) {
      sendJSON(res, { error: err.message }, 500);
    }
  });

  // --- Intent detection ---
  routes.set('POST /api/intent', async (req, res, body) => {
    const { message } = body;
    if (!message) return sendJSON(res, { error: 'message required' }, 400);

    const ai = engine.get('ai');
    const intent = await detectIntent(ai, message);
    sendJSON(res, intent);
  });

  // --- Sessions ---
  routes.set('GET /api/sessions', (req, res) => {
    const context = engine.get('context');
    sendJSON(res, context ? context.listSessions() : []);
  });

  routes.set('POST /api/sessions', (req, res, body) => {
    const context = engine.get('context');
    if (!context) return sendJSON(res, { error: 'Context not available' }, 503);
    const session = context.createSession(body.id || `session_${Date.now()}`, body.mode || 'standard');
    sendJSON(res, { id: session.id, mode: session.mode });
  });

  routes.set('DELETE /api/sessions', (req, res, body) => {
    const context = engine.get('context');
    if (!context) return sendJSON(res, { error: 'Context not available' }, 503);
    context.deleteSession(body.id);
    sendJSON(res, { deleted: true });
  });

  // --- Modes ---
  routes.set('GET /api/modes', (req, res) => {
    const context = engine.get('context');
    sendJSON(res, context ? context.listModes() : []);
  });

  // --- Memory ---
  routes.set('GET /api/memory', (req, res) => {
    const memory = engine.get('memory');
    if (!memory) return sendJSON(res, { error: 'Memory not available' }, 503);
    sendJSON(res, { facts: memory.getFacts(), notes: memory.getNotes(), status: memory.status() });
  });

  routes.set('POST /api/memory/fact', async (req, res, body) => {
    const memory = engine.get('memory');
    if (!memory) return sendJSON(res, { error: 'Memory not available' }, 503);
    const fact = await memory.storeFact(body.content, body.metadata);
    sendJSON(res, fact);
  });

  routes.set('POST /api/memory/note', async (req, res, body) => {
    const memory = engine.get('memory');
    if (!memory) return sendJSON(res, { error: 'Memory not available' }, 503);
    const note = await memory.storeNote(body.title, body.content, body.tags);
    sendJSON(res, note);
  });

  routes.set('POST /api/memory/search', async (req, res, body) => {
    const memory = engine.get('memory');
    if (!memory) return sendJSON(res, { error: 'Memory not available' }, 503);
    const results = await memory.searchMemory(body.query, body.topK || 5);
    sendJSON(res, results);
  });

  // --- Plugins ---
  routes.set('GET /api/plugins', (req, res) => {
    const plugins = engine.get('plugins');
    sendJSON(res, plugins ? plugins.listPlugins() : []);
  });

  routes.set('GET /api/commands', (req, res) => {
    const plugins = engine.get('plugins');
    sendJSON(res, plugins ? plugins.listCommands() : []);
  });

  // --- Automation ---
  routes.set('POST /api/exec', async (req, res, body) => {
    const executor = require('../automation/executor');
    try {
      const result = await executor.execute(body.command, body.args || [], body.options);
      sendJSON(res, result);
    } catch (err) {
      sendJSON(res, { error: err.message }, 403);
    }
  });

  routes.set('GET /api/files', (req, res) => {
    const filesystem = require('../automation/filesystem');
    const url = new URL(req.url, `http://${req.headers.host}`);
    const dirPath = url.searchParams.get('path') || '.';
    try {
      const files = filesystem.listDir(dirPath);
      sendJSON(res, files);
    } catch (err) {
      sendJSON(res, { error: err.message }, 403);
    }
  });

  routes.set('POST /api/files/read', (req, res, body) => {
    const filesystem = require('../automation/filesystem');
    try {
      const content = filesystem.readFile(body.path);
      sendJSON(res, { content });
    } catch (err) {
      sendJSON(res, { error: err.message }, 403);
    }
  });

  routes.set('POST /api/files/write', (req, res, body) => {
    const filesystem = require('../automation/filesystem');
    try {
      filesystem.writeFile(body.path, body.content);
      sendJSON(res, { success: true });
    } catch (err) {
      sendJSON(res, { error: err.message }, 403);
    }
  });

  // --- Scheduler ---
  routes.set('GET /api/scheduler', (req, res) => {
    const scheduler = engine.get('scheduler');
    sendJSON(res, scheduler ? scheduler.list() : []);
  });

  routes.set('POST /api/scheduler', (req, res, body) => {
    const scheduler = engine.get('scheduler');
    if (!scheduler) return sendJSON(res, { error: 'Scheduler not available' }, 503);
    try {
      const task = scheduler.add(body);
      sendJSON(res, task);
    } catch (err) {
      sendJSON(res, { error: err.message }, 400);
    }
  });

  routes.set('DELETE /api/scheduler', (req, res, body) => {
    const scheduler = engine.get('scheduler');
    if (!scheduler) return sendJSON(res, { error: 'Scheduler not available' }, 503);
    scheduler.remove(body.id);
    sendJSON(res, { deleted: true });
  });

  // --- Voice ---
  routes.set('POST /api/voice/transcribe', async (req, res, body) => {
    const voice = engine.get('voice');
    if (!voice) return sendJSON(res, { error: 'Voice not available' }, 503);
    try {
      const result = await voice.transcribe(body);
      sendJSON(res, result);
    } catch (err) {
      sendJSON(res, { error: err.message }, 500);
    }
  });

  routes.set('POST /api/voice/speak', async (req, res, body) => {
    const voice = engine.get('voice');
    if (!voice) return sendJSON(res, { error: 'Voice not available' }, 503);
    try {
      const result = await voice.speak(body.text, body.options);
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': result.audio.length });
      res.end(result.audio);
    } catch (err) {
      sendJSON(res, { error: err.message }, 500);
    }
  });

  routes.set('GET /api/voice/status', (req, res) => {
    const voice = engine.get('voice');
    sendJSON(res, voice ? voice.status() : { enabled: false });
  });

  // --- Search (SearXNG) ---
  routes.set('POST /api/search', async (req, res, body) => {
    const { request } = require('../core/http-client');
    const config = require('../core/config');
    if (!config.search.enabled) return sendJSON(res, { error: 'Search not enabled' }, 503);
    try {
      const searchRes = await request(
        `${config.search.endpoint}/search?q=${encodeURIComponent(body.query)}&format=json`,
        { timeout: config.search.timeoutMs }
      );
      const data = JSON.parse(searchRes.body);
      sendJSON(res, { results: (data.results || []).slice(0, body.limit || 10) });
    } catch (err) {
      sendJSON(res, { error: err.message }, 500);
    }
  });

  // --- Router function ---
  return async (req, res, body) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = `${req.method} ${url.pathname}`;
    const handler = routes.get(key);

    if (handler) {
      await handler(req, res, body);
    } else {
      sendJSON(res, { error: 'Not Found', path: url.pathname }, 404);
    }
  };
}

module.exports = { createRouter };
