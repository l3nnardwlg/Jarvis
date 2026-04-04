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
  notes: [],
  timers: [],
  notifications: [],
  lastCommandAt: new Date().toISOString(),
};

const weatherProfiles = {
  wolgast: "12°C, leicht bewölkt, schwacher Wind aus Nordwest.",
  berlin: "17°C, trocken, gute Sicht und angenehme Abendluft.",
  hamburg: "14°C, einzelne Schauer, frische Brise von der Elbe.",
  muenchen: "19°C, sonnige Abschnitte, warme Luft und klare Sicht auf die Alpen.",
  münchen: "19°C, sonnige Abschnitte, warme Luft und klare Sicht auf die Alpen.",
  london: "11°C, bedeckt, kühler Wind und leichter Nieselregen möglich.",
  "new york": "21°C, trocken, urban warm und klarer Himmel.",
  tokio: "18°C, mild, leicht bewölkt und trockene Nachtluft.",
  paris: "16°C, freundlich, kaum Wind und gute Sicht.",
};

const timeZones = {
  berlin: "Europe/Berlin",
  hamburg: "Europe/Berlin",
  wolgast: "Europe/Berlin",
  paris: "Europe/Paris",
  london: "Europe/London",
  lissabon: "Europe/Lisbon",
  newyork: "America/New_York",
  "new york": "America/New_York",
  losangeles: "America/Los_Angeles",
  "los angeles": "America/Los_Angeles",
  tokio: "Asia/Tokyo",
  tokyo: "Asia/Tokyo",
  dubai: "Asia/Dubai",
  sydney: "Australia/Sydney",
};

const jokes = [
  "Warum mögen Entwickler dunkle Oberflächen? Weil das Licht Bugs anzieht.",
  "Ich habe meinem Smart Home gesagt, es soll chillen. Jetzt ist die Heizung im Energiesparmodus.",
  "Warum arbeitet Jarvis lokal? Weil auch KIs nicht jeden Gedanken in die Cloud tragen sollten.",
  "Was sagt ein ESP32 zum WLAN? Ohne dich bin ich nur ein sehr teurer Stein.",
];

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
  return formatTimeForZone("Europe/Berlin");
}

function getDate() {
  return formatDateForZone("Europe/Berlin");
}

function formatTimeForZone(timeZone) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function formatDateForZone(timeZone) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

async function getWeather(city = "Wolgast") {
  const normalizedCity = city.trim().toLowerCase();
  const forecast = weatherProfiles[normalizedCity] || "15°C, ruhig, trocken und klarer Himmel.";

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

function normalizeLocation(value) {
  return value.trim().toLowerCase();
}

function resolveTimeZone(location = "Berlin") {
  const normalizedLocation = normalizeLocation(location);
  return timeZones[normalizedLocation] || "Europe/Berlin";
}

function getTimeForLocation(location = "Berlin") {
  const timeZone = resolveTimeZone(location);
  return `Uhrzeit in ${capitalize(location)}: ${formatTimeForZone(timeZone)}`;
}

function getDateForLocation(location = "Berlin") {
  const timeZone = resolveTimeZone(location);
  return `Datum in ${capitalize(location)}: ${formatDateForZone(timeZone)}`;
}

function extractLocation(input, keyword) {
  const pattern = new RegExp(`${keyword}(?:\\s+in)?\\s+([a-zA-ZäöüÄÖÜß\\-\\s]+)`, "i");
  const match = input.match(pattern);
  return match ? match[1].trim() : "Berlin";
}

function extractMathExpression(input) {
  return input
    .replace(/rechne|berechne|calc|rechner|was ist/gi, "")
    .replace(/\?/g, "")
    .trim();
}

function calculateExpression(expression) {
  if (!expression) {
    return null;
  }

  const safeExpression = expression.replace(/,/g, ".");
  if (!/^[0-9+\-*/%.()\s]+$/.test(safeExpression)) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${safeExpression});`)();
    if (!Number.isFinite(result)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

function extractRandomBounds(input) {
  const betweenMatch = input.match(/(?:zwischen|von)\s+(\d+)\s+(?:und|bis)\s+(\d+)/i);
  if (betweenMatch) {
    return {
      min: Number(betweenMatch[1]),
      max: Number(betweenMatch[2]),
    };
  }

  const uptoMatch = input.match(/(?:bis|max(?:imal)?)\s+(\d+)/i);
  if (uptoMatch) {
    return {
      min: 1,
      max: Number(uptoMatch[1]),
    };
  }

  return { min: 1, max: 100 };
}

function getRandomNumber(min, max) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function parseTimerInput(input) {
  const match = input.match(/(\d+)\s*(sekunden|sekunde|sek|minuten|minute|min|stunden|stunde|std|h)/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  let durationMs = amount * 1000;

  if (["minuten", "minute", "min"].includes(unit)) {
    durationMs = amount * 60_000;
  }

  if (["stunden", "stunde", "std", "h"].includes(unit)) {
    durationMs = amount * 3_600_000;
  }

  const labelMatch = input.match(/timer.*?(?:für|zu)?\s*\d+\s*(?:sekunden|sekunde|sek|minuten|minute|min|stunden|stunde|std|h)\s*(.*)$/i);

  return {
    amount,
    unit,
    durationMs,
    label: labelMatch && labelMatch[1] ? labelMatch[1].trim() : "",
  };
}

function startTimer(timerConfig) {
  const timerId = Date.now();
  const endsAt = Date.now() + timerConfig.durationMs;
  const timer = {
    id: timerId,
    label: timerConfig.label || "Timer",
    endsAt,
    active: true,
  };

  state.timers.push(timer);

  setTimeout(() => {
    const currentTimer = state.timers.find((entry) => entry.id === timerId);
    if (!currentTimer) {
      return;
    }

    currentTimer.active = false;
    state.notifications.unshift(`Timer fertig: ${currentTimer.label}`);
    state.notifications = state.notifications.slice(0, 5);
  }, timerConfig.durationMs);

  return timer;
}

function formatClockTimestamp(timestamp, timeZone = "Europe/Berlin") {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function listActiveTimers() {
  const activeTimers = state.timers.filter((timer) => timer.active);
  if (!activeTimers.length) {
    return "Aktuell laufen keine Timer.";
  }

  return activeTimers
    .map((timer) => {
      const secondsLeft = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
      return `${timer.label}: noch ${secondsLeft}s`;
    })
    .join(" | ");
}

function extractUrl(input) {
  const match = input.match(/((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?)/i);
  if (!match) {
    return null;
  }

  const rawUrl = match[1].trim();
  return rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
}

function extractJoke() {
  return jokes[Math.floor(Math.random() * jokes.length)];
}

function consumeNotification() {
  return state.notifications.shift() || null;
}

function buildStatusSnapshot() {
  const finishedNotification = consumeNotification();

  return {
    time: getTime(),
    date: getDate(),
    lightsOn: state.lightsOn,
    focusMode: state.focusMode,
    alarmArmed: state.alarmArmed,
    lastNote: state.lastNote,
    noteCount: state.notes.length,
    activeTimers: state.timers.filter((timer) => timer.active).length,
    latestNotification: finishedNotification,
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
      "Wetter in Berlin",
      "Rechne 12*12",
    ],
    links: extras.links || [],
    highlight: extras.highlight || "System nominal",
    autoOpenLinks: extras.autoOpenLinks || false,
    linkType: extras.linkType || null,
  };
}

function extractNote(input) {
  return input
    .replace(/speichere|speicher|notiz|notizen|merke dir|merke/gi, "")
    .replace(/:/g, "")
    .trim();
}

function extractCity(input) {
  const match = input.match(/wetter(?:\s+in)?\s+([a-zA-ZäöüÄÖÜß\-\s]+)/i);
  return match ? match[1].trim() : "Wolgast";
}

function extractAmazonProduct(input) {
  const cleanedInput = input
    .replace(/\b(?:auf|bei)\s+amazon\b/gi, " ")
    .replace(/\bamazon\b/gi, " ")
    .replace(/\b(?:such|suche|find|finde|bestell|bestelle|kauf|kaufe|hol|hole)(?:\s+mir)?(?:\s+bitte)?(?:\s+mal)?\b/gi, " ")
    .replace(/\b(?:bitte|mal|doch|gerne|für mich)\b/gi, " ")
    .replace(/\b(?:den|die|das|dem|der|ein|eine|einen|einem|einer|nen|ne|n)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedInput || "smart home gadget";
}

async function handleInput(input) {
  const normalizedInput = String(input || "").trim();
  const lowerInput = normalizedInput.toLowerCase();
  state.lastCommandAt = new Date().toISOString();

  if (!normalizedInput) {
    return buildResponse("Bitte gib einen Befehl ein.", {
      highlight: "Eingabe erwartet",
      quickActions: ["Status", "Wie spät ist es?", "Wetter in Tokio", "Rechne 2+2"],
    });
  }

  if (lowerInput.includes("rechner") || lowerInput.includes("rechne") || lowerInput.includes("berechne") || lowerInput.includes("was ist")) {
    const expression = extractMathExpression(normalizedInput);
    const result = calculateExpression(expression);

    if (result === null) {
      return buildResponse("Den Ausdruck konnte ich nicht sicher berechnen. Nutze nur Zahlen und + - * / % Klammern.", {
        highlight: "Calculator input rejected",
        quickActions: ["Rechne 5*9", "Rechne (12+4)/2", "Status"],
      });
    }

    return buildResponse(`Ergebnis: ${expression} = ${result}`, {
      highlight: "Calculator solved",
      quickActions: ["Rechne 19*19", "Zufallszahl bis 50", "Status"],
    });
  }

  if (lowerInput.includes("zeit") || lowerInput.includes("uhr")) {
    const location = extractLocation(normalizedInput, "(?:zeit|uhr(?:zeit)?)");
    const wantsOtherLocation = /\bin\b/i.test(normalizedInput);
    return buildResponse(wantsOtherLocation ? getTimeForLocation(location) : `Aktuelle Uhrzeit: ${getTime()}`, {
      highlight: wantsOtherLocation ? `Clock sync: ${capitalize(location)}` : "Zeit synchronisiert",
      quickActions: ["Uhrzeit in London", "Uhrzeit in Tokio", "Datum in New York"],
    });
  }

  if (lowerInput.includes("datum") || lowerInput.includes("tag")) {
    const location = extractLocation(normalizedInput, "(?:datum|tag)");
    const wantsOtherLocation = /\bin\b/i.test(normalizedInput);
    return buildResponse(wantsOtherLocation ? getDateForLocation(location) : `Heute ist ${getDate()}.`, {
      highlight: wantsOtherLocation ? `Calendar sync: ${capitalize(location)}` : "Kalender online",
      quickActions: ["Datum in Berlin", "Datum in Tokio", "Wie spät ist es?"],
    });
  }

  if (lowerInput.includes("wetter")) {
    const city = extractCity(normalizedInput);
    const forecast = await getWeather(city);
    return buildResponse(forecast, {
      highlight: `Wetterscan für ${capitalize(city)}`,
      quickActions: ["Wetter in Hamburg", "Wetter in London", "Status"],
    });
  }

  if (lowerInput.includes("zufall") || lowerInput.includes("random")) {
    const bounds = extractRandomBounds(normalizedInput);
    const value = getRandomNumber(bounds.min, bounds.max);
    return buildResponse(`Zufallszahl zwischen ${Math.min(bounds.min, bounds.max)} und ${Math.max(bounds.min, bounds.max)}: ${value}`, {
      highlight: "Random generator online",
      quickActions: ["Zufallszahl bis 10", "Zufallszahl zwischen 50 und 150", "Status"],
    });
  }

  if (lowerInput.includes("timer")) {
    if (lowerInput.includes("liste") || lowerInput.includes("status")) {
      return buildResponse(listActiveTimers(), {
        highlight: "Timer monitor",
        quickActions: ["Timer 10 sekunden", "Timer 2 minuten kaffeepause", "Status"],
      });
    }

    const timerConfig = parseTimerInput(normalizedInput);
    if (!timerConfig) {
      return buildResponse("Timer nicht verstanden. Beispiele: Timer 10 sekunden oder Timer 2 minuten kaffeepause.", {
        highlight: "Timer input missing",
        quickActions: ["Timer 10 sekunden", "Timer 1 minute fokus", "Timer status"],
      });
    }

    const timer = startTimer(timerConfig);
    return buildResponse(`Timer gestartet: ${timer.label}. Ende um ${formatClockTimestamp(timer.endsAt)}.`, {
      highlight: "Timer armed",
      quickActions: ["Timer status", "Timer 30 sekunden stretch", "Status"],
    });
  }

  if (lowerInput.includes("notiz") || lowerInput.includes("notizen") || lowerInput.includes("merke") || lowerInput.includes("speicher")) {
    if (lowerInput.includes("liste") || lowerInput.includes("zeige") || lowerInput.includes("meine notizen")) {
      const noteList = state.notes.length ? state.notes.map((note, index) => `${index + 1}. ${note}`).join(" | ") : "Keine Notizen gespeichert.";
      return buildResponse(noteList, {
        highlight: "Memory index loaded",
        quickActions: ["Speichere Notiz Milch kaufen", "Zeig meine Notizen", "Status"],
      });
    }

    const note = extractNote(normalizedInput);
    state.lastNote = note || "Leere Notiz empfangen.";
    if (note) {
      state.notes.unshift(note);
      state.notes = state.notes.slice(0, 10);
    }
    return buildResponse(`Notiz gespeichert: ${state.lastNote}`, {
      highlight: "Memory core updated",
      quickActions: ["Zeig meine Notizen", "Status", "Witz erzählen"],
    });
  }

  if (
    lowerInput.includes("amazon") ||
    lowerInput.includes("kaufen") ||
    lowerInput.includes("suche") ||
    lowerInput.includes("such") ||
    lowerInput.includes("finde") ||
    lowerInput.includes("find") ||
    lowerInput.includes("bestell")
  ) {
    const product = extractAmazonProduct(normalizedInput);
    const url = searchAmazon(product);
    return buildResponse(`Ich habe eine Amazon-Suche für "${product}" vorbereitet.`, {
      links: [{ label: `Amazon: ${product}`, url }],
      highlight: "Shopping-Link erzeugt",
      linkType: "amazon",
      quickActions: ["Such Tastatur auf Amazon", "Such ESP32 auf Amazon", "Öffne amazon.de"],
    });
  }

  if (lowerInput.includes("öffne") || lowerInput.includes("oeffne") || lowerInput.includes("offne") || lowerInput.includes("open url") || lowerInput.includes("url")) {
    const url = extractUrl(normalizedInput);
    if (!url) {
      return buildResponse("Ich konnte keine URL erkennen. Beispiel: Öffne github.com", {
        highlight: "URL parser waiting",
        quickActions: ["Öffne github.com", "Öffne amazon.de", "Status"],
      });
    }

    return buildResponse(`URL bereit: ${url}`, {
      links: [{ label: `Öffnen: ${url}`, url }],
      highlight: "External link staged",
      autoOpenLinks: true,
      linkType: "url",
      quickActions: ["Öffne youtube.com", "Öffne github.com", "Status"],
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

  if (lowerInput.includes("meine notiz") || lowerInput.includes("letzte notiz")) {
    return buildResponse(`Letzte gespeicherte Notiz: ${state.lastNote}`, {
      highlight: "Memory core read",
    });
  }

  if (lowerInput.includes("witz")) {
    return buildResponse(extractJoke(), {
      highlight: "Comedy subroutine online",
      quickActions: ["Erzähl noch einen Witz", "Zufallszahl bis 20", "Status"],
    });
  }

  if (lowerInput.includes("status") || lowerInput.includes("system")) {
    return buildResponse("Systemstatus geladen. Alle Kernmodule reagieren im Soll.", {
      highlight: "Statusscan abgeschlossen",
      quickActions: ["Wie spät ist es?", "Rechne 42/6", "Timer status"],
    });
  }

  if (lowerInput.includes("hallo") || lowerInput.includes("jarvis")) {
    return buildResponse("Jarvis online. Ich steuere Zeit, Datum, Wetter, Rechner, Zufallszahlen, Timer, Notizen, URLs, Amazon-Suche und Witze lokal für dich.", {
      highlight: "Voice core ready",
      quickActions: ["Status", "Wetter in Berlin", "Rechne 12*12", "Witz erzählen"],
    });
  }

  return buildResponse("Befehl erkannt, aber noch nicht implementiert. Versuch Wetter, Uhrzeit in anderen Orten, Datum, Rechner, Zufallszahl, Timer, Notizen, URL öffnen, Amazon oder Witz erzählen.", {
    highlight: "Unknown command pattern",
    quickActions: ["Status", "Uhrzeit in Tokio", "Timer 15 sekunden", "Öffne github.com"],
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

