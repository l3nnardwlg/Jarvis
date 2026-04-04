const http = require("http");
const fs = require("fs");
const path = require("path");

const { loadCommands } = require("./lib/command-loader");
const { createMemoryStore } = require("./lib/memory-store");
const { findBestCommand, normalizeInput } = require("./lib/parser");
const respond = require("./lib/response");
const helpers = require("./lib/helpers");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const COMMANDS_DIR = path.join(__dirname, "commands");
const MEMORY_FILE = path.join(__dirname, "data", "memory.json");

const memory = createMemoryStore(MEMORY_FILE);
const commands = loadCommands(COMMANDS_DIR);

const state = {
  lightsOn: false,
  focusMode: false,
  alarmArmed: true,
  timers: [],
  notifications: [],
  lastCommandAt: new Date().toISOString(),
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
  const normalizedInput = normalizeInput(input);
  state.lastCommandAt = new Date().toISOString();

  if (!normalizedInput) {
    return finalizeResponse(
      respond.text("Bitte gib einen Befehl ein.", {
        highlight: "Eingabe erwartet",
        quickActions: ["Status", "Wie spät ist es?", "Wetter in Tokio", "Rechne 2+2"],
      })
    );
  }

  const context = {
    input: String(input || ""),
    normalizedInput,
    state,
    memory,
    helpers,
    respond,
  };

  const command = findBestCommand(commands, context);

  if (!command) {
    return finalizeResponse(
      respond.error(
        "Befehl erkannt, aber noch nicht implementiert. Versuch Wetter, Uhrzeit in anderen Orten, Datum, Rechner, Zufallszahl, Timer, Notizen, URL öffnen, Amazon oder Witz erzählen.",
        {
          highlight: "Unknown command pattern",
          quickActions: ["Status", "Uhrzeit in Tokio", "Timer 15 sekunden", "Öffne github.com"],
        }
      )
    );
  }

  try {
    return finalizeResponse(await command.run(context));
  } catch (error) {
    return finalizeResponse(
      respond.error(`Befehl ${command.name} fehlgeschlagen: ${error.message}`, {
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
        response: { type: "error", content: "Ungültige Anfrage." },
        error: "Ungültige Anfrage.",
        detail: error.message,
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
