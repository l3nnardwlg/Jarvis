const http = require("http");
const fs = require("fs");
const path = require("path");

const { routeWithAI } = require("./lib/ai-router");
const { loadCommands } = require("./lib/command-loader");
const { createLogStore } = require("./lib/log-store");
const { createMemoryStore } = require("./lib/memory-store");
const { findBestCommand, normalizeInput } = require("./lib/parser");
const respond = require("./lib/response");
const helpers = require("./lib/helpers");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const COMMANDS_DIR = path.join(__dirname, "commands");
const MEMORY_FILE = path.join(__dirname, "data", "memory.json");
const LOG_FILE = path.join(__dirname, "data", "interaction-log.json");

const memory = createMemoryStore(MEMORY_FILE);
const logs = createLogStore(LOG_FILE);
const commands = loadCommands(COMMANDS_DIR);
const memorySnapshot = memory.getSnapshot();

const state = {
  lightsOn: false,
  focusMode: false,
  alarmArmed: true,
  timers: [],
  notifications: [],
  lastCommandAt: new Date().toISOString(),
  context: {
    ...memorySnapshot.context,
  },
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function consumeNotification() {
  return state.notifications.shift() || null;
}

function buildStatusSnapshot() {
  const memorySnapshot = memory.getSnapshot();

  return {
    time: helpers.getTime(),
    date: helpers.getDate(),
    lightsOn: state.lightsOn,
    focusMode: state.focusMode,
    alarmArmed: state.alarmArmed,
    lastNote: memorySnapshot.notes[0] || "Keine Notizen gespeichert.",
    noteCount: memorySnapshot.notes.length,
    activeTimers: state.timers.filter((timer) => timer.active).length,
    latestNotification: consumeNotification(),
    lastCommandAt: state.lastCommandAt,
    lastResult: state.context.lastResult,
  };
}

function finalizeResponse(result) {
  const normalizedResult = result && result.response
    ? result
    : respond.error("Ungültige Command-Response.", {
        highlight: "Invalid command response",
      });

  return {
    response: normalizedResult.response,
    reply: normalizedResult.response.content,
    status: buildStatusSnapshot(),
    quickActions: normalizedResult.quickActions,
    links: normalizedResult.links,
    highlight: normalizedResult.highlight,
    autoOpenLinks: normalizedResult.autoOpenLinks,
    linkType: normalizedResult.linkType,
  };
}

async function handleInput(input) {
  const originalInput = String(input || "");
  const normalizedInput = normalizeInput(originalInput);
  state.lastCommandAt = new Date().toISOString();

  if (!normalizedInput) {
    logs.addEntry({ input: "", command: null, outcome: "empty" });
    return finalizeResponse(
      respond.error("Ich brauche noch einen Befehl von dir.", {
        highlight: "Eingabe erwartet",
        quickActions: ["Status", "Wie spät ist es?", "Wetter in Tokio", "Rechne 2+2"],
      })
    );
  }

  let resolvedInput = originalInput;
  let resolvedNormalizedInput = normalizedInput;
  let aiRoute = null;

  try {
    aiRoute = await routeWithAI(originalInput, commands);
    resolvedInput = aiRoute.executionInput || originalInput;
    resolvedNormalizedInput = normalizeInput(resolvedInput);
  } catch (error) {
    logs.addEntry({
      input: originalInput,
      command: null,
      outcome: "ai-fallback",
      detail: error.message,
    });
  }

  const context = {
    input: resolvedInput,
    originalInput,
    normalizedInput: resolvedNormalizedInput,
    state,
    memory,
    logs,
    helpers,
    respond,
    aiRoute,
  };

  const command = aiRoute?.command || findBestCommand(commands, context);

  if (!command) {
    logs.addEntry({ input: originalInput, command: null, outcome: "unknown" });
    return finalizeResponse(
      respond.error(
        helpers.pickOne([
          "Das habe ich noch nicht sauber verstanden. Versuch es mit Zeit, Wetter, Rechnen, Notizen oder einer URL.",
          "Diesen Befehl konnte ich nicht zuordnen. Formuliere ihn etwas direkter, zum Beispiel mit Wetter, Timer oder Amazon.",
          "Damit kann ich gerade nichts anfangen. Probier es noch einmal anders oder nutze eine der Quick Actions.",
        ]),
        {
          highlight: "Unknown command pattern",
          quickActions: ["Status", "Uhrzeit in Tokio", "Timer 15 sekunden", "Öffne github.com"],
        }
      )
    );
  }

  try {
    const result = await command.run(context);
    state.context.lastCommand = command.name;
    memory.setContext({
      lastResult: state.context.lastResult,
      lastCommand: state.context.lastCommand,
    });
    logs.addEntry({
      input: originalInput,
      command: command.name,
      outcome: "success",
      lastResult: state.context.lastResult,
      aiRoute: aiRoute ? aiRoute.routeName : null,
    });
    return finalizeResponse(result);
  } catch (error) {
    logs.addEntry({
      input: originalInput,
      command: command.name,
      outcome: "error",
      detail: error.message,
      aiRoute: aiRoute ? aiRoute.routeName : null,
    });
    return finalizeResponse(
      respond.error(helpers.pickOne([
        "Das hat gerade nicht funktioniert. Versuch es bitte noch einmal anders formuliert.",
        "Bei diesem Befehl ist etwas schiefgelaufen. Probier es erneut oder nutze eine Quick Action.",
        "Den Auftrag konnte ich diesmal nicht sauber ausführen. Ein zweiter Versuch sollte helfen.",
      ]), {
        highlight: "Command execution failed",
        quickActions: ["Status", "Wie spät ist es?", "Witz erzählen"],
      })
    );
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function serveStaticFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Datei nicht gefunden." });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
    response.end(content);
  });
}

function getRequestBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";

    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/status") {
    sendJson(
      response,
      200,
      finalizeResponse(
        respond.text("Jarvis online.", {
          highlight: "System nominal",
        })
      )
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ask") {
    try {
      const rawBody = await getRequestBody(request);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const result = await handleInput(body.message);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, {
        response: { type: "error", content: "Die Anfrage war unvollständig oder fehlerhaft." },
        error: "Ungültige Anfrage.",
      });
    }
    return;
  }

  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: "Zugriff verweigert." });
    return;
  }

  serveStaticFile(response, filePath);
});

server.listen(PORT, () => {
  console.log(`Jarvis läuft auf http://localhost:${PORT}`);
});

module.exports = {
  handleInput,
  buildStatusSnapshot,
};
