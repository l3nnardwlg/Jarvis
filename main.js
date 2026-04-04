const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const state = {
  lightsOn: false,
  focusMode: false,
  alarmArmed: true,
  lastNote: "Keine Notizen gespeichert.",
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

function getTime() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function getDate() {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

async function getWeather(city = "Wolgast") {
  const sampleForecasts = {
    wolgast: "12°C, leicht bewölkt, schwacher Wind aus Nordwest.",
    berlin: "17°C, trocken, gute Sicht und angenehme Abendluft.",
    hamburg: "14°C, einzelne Schauer, frische Brise von der Elbe.",
  };
  const normalizedCity = city.trim().toLowerCase();
  const forecast = sampleForecasts[normalizedCity] || "15°C, ruhig, trocken und klarer Himmel.";

  return `Wetter für ${capitalize(city)}: ${forecast}`;
}

function searchAmazon(product) {
  return `https://www.amazon.de/s?k=${encodeURIComponent(product.trim())}`;
}

function capitalize(value) {
  if (!value) {
    return "Wolgast";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildStatusSnapshot() {
  return {
    time: getTime(),
    date: getDate(),
    lightsOn: state.lightsOn,
    focusMode: state.focusMode,
    alarmArmed: state.alarmArmed,
    lastNote: state.lastNote,
    lastCommandAt: state.lastCommandAt,
  };
}

function buildResponse(reply, extras = {}) {
  return {
    reply,
    status: buildStatusSnapshot(),
    quickActions: extras.quickActions || [
      "Status",
      "Licht an",
      "Fokusmodus aktivieren",
      "Wetter in Berlin",
    ],
    links: extras.links || [],
    highlight: extras.highlight || "System nominal",
  };
}

function extractNote(input) {
  return input
    .replace(/notiz|speicher|merke dir/gi, "")
    .replace(/:/g, "")
    .trim();
}

function extractCity(input) {
  const match = input.match(/wetter(?:\s+in)?\s+([a-zA-ZäöüÄÖÜß\-\s]+)/i);
  return match ? match[1].trim() : "Wolgast";
}

function extractAmazonProduct(input) {
  return input
    .replace(/such|suche|amazon|kaufen|bestell/gi, "")
    .trim() || "smart home gadget";
}

async function handleInput(input) {
  const normalizedInput = String(input || "").trim();
  const lowerInput = normalizedInput.toLowerCase();
  state.lastCommandAt = new Date().toISOString();

  if (!normalizedInput) {
    return buildResponse("Bitte gib einen Befehl ein.", {
      highlight: "Eingabe erwartet",
      quickActions: ["Status", "Wie spät ist es?", "Licht an", "Wetter"],
    });
  }

  if (lowerInput.includes("zeit") || lowerInput.includes("uhr")) {
    return buildResponse(`Aktuelle Uhrzeit: ${getTime()}`, {
      highlight: "Zeit synchronisiert",
    });
  }

  if (lowerInput.includes("datum") || lowerInput.includes("tag")) {
    return buildResponse(`Heute ist ${getDate()}.`, {
      highlight: "Kalender online",
    });
  }

  if (lowerInput.includes("wetter")) {
    const city = extractCity(normalizedInput);
    const forecast = await getWeather(city);
    return buildResponse(forecast, {
      highlight: `Wetterscan für ${capitalize(city)}`,
    });
  }

  if (lowerInput.includes("amazon") || lowerInput.includes("kaufen") || lowerInput.includes("suche")) {
    const product = extractAmazonProduct(normalizedInput);
    const url = searchAmazon(product);
    return buildResponse(`Ich habe eine Amazon-Suche für "${product}" vorbereitet.`, {
      links: [{ label: `Amazon: ${product}`, url }],
      highlight: "Shopping-Link erzeugt",
      quickActions: ["Such Tastatur auf Amazon", "Such ESP32 auf Amazon", "Status"],
    });
  }

  if (lowerInput.includes("licht an")) {
    state.lightsOn = true;
    return buildResponse("Wohnzimmerbeleuchtung aktiviert.", {
      highlight: "Lichtstatus: AN",
      quickActions: ["Licht aus", "Status", "Fokusmodus aktivieren"],
    });
  }

  if (lowerInput.includes("licht aus")) {
    state.lightsOn = false;
    return buildResponse("Wohnzimmerbeleuchtung deaktiviert.", {
      highlight: "Lichtstatus: AUS",
      quickActions: ["Licht an", "Status", "Wetter"],
    });
  }

  if (lowerInput.includes("fokus") || lowerInput.includes("focus")) {
    state.focusMode = !state.focusMode;
    return buildResponse(
      state.focusMode
        ? "Fokusmodus aktiv. Benachrichtigungen gedrosselt, Lichter gedimmt."
        : "Fokusmodus deaktiviert. Normale Betriebsparameter wiederhergestellt.",
      {
        highlight: state.focusMode ? "Focus Lock engaged" : "Focus Lock released",
        quickActions: ["Status", "Licht an", "Alarm aktivieren"],
      }
    );
  }

  if (lowerInput.includes("alarm")) {
    state.alarmArmed = !lowerInput.includes("aus");
    return buildResponse(
      state.alarmArmed ? "Alarmanlage scharf geschaltet." : "Alarmanlage entschärft.",
      {
        highlight: state.alarmArmed ? "Perimeter secured" : "Perimeter relaxed",
        quickActions: ["Alarm aus", "Alarm an", "Status"],
      }
    );
  }

  if (lowerInput.includes("notiz") || lowerInput.includes("merke") || lowerInput.includes("speicher")) {
    const note = extractNote(normalizedInput);
    state.lastNote = note || "Leere Notiz empfangen.";
    return buildResponse(`Notiz gespeichert: ${state.lastNote}`, {
      highlight: "Memory core updated",
      quickActions: ["Status", "Zeig meine Notiz", "Licht an"],
    });
  }

  if (lowerInput.includes("meine notiz") || lowerInput.includes("letzte notiz")) {
    return buildResponse(`Letzte gespeicherte Notiz: ${state.lastNote}`, {
      highlight: "Memory core read",
    });
  }

  if (lowerInput.includes("status") || lowerInput.includes("system")) {
    return buildResponse("Systemstatus geladen. Alle Kernmodule reagieren im Soll.", {
      highlight: "Statusscan abgeschlossen",
      quickActions: ["Wie spät ist es?", "Licht an", "Wetter in Hamburg"],
    });
  }

  if (lowerInput.includes("hallo") || lowerInput.includes("jarvis")) {
    return buildResponse("Jarvis online. Ich überwache Zeit, Wetter, Licht, Fokusmodus und deine Schnellbefehle.", {
      highlight: "Voice core ready",
      quickActions: ["Status", "Wie spät ist es?", "Licht an", "Wetter in Berlin"],
    });
  }

  return buildResponse("Befehl erkannt, aber noch nicht implementiert. Versuch Status, Wetter, Licht, Alarm, Fokus oder Amazon.", {
    highlight: "Unknown command pattern",
    quickActions: ["Status", "Wetter", "Licht an", "Such Raspberry Pi auf Amazon"],
  });
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
    sendJson(response, 200, buildResponse("Jarvis online."));
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

