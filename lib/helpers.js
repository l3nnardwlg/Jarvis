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
  return timeZones[normalizeLocation(location)] || "Europe/Berlin";
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

function getTime() {
  return formatTimeForZone("Europe/Berlin");
}

function getDate() {
  return formatDateForZone("Europe/Berlin");
}

function getTimeForLocation(location = "Berlin") {
  return `Uhrzeit in ${capitalize(location)}: ${formatTimeForZone(resolveTimeZone(location))}`;
}

function getDateForLocation(location = "Berlin") {
  return `Datum in ${capitalize(location)}: ${formatDateForZone(resolveTimeZone(location))}`;
}

function getWeather(city = "Wolgast") {
  const forecast = weatherProfiles[normalizeLocation(city)] || "15°C, ruhig, trocken und klarer Himmel.";
  return `Wetter für ${capitalize(city)}: ${forecast}`;
}

function extractLocation(input, keyword) {
  const pattern = new RegExp(`${keyword}(?:\\s+in)?\\s+([a-zA-ZäöüÄÖÜß\\-\\s]+)`, "i");
  const match = input.match(pattern);
  return match ? match[1].trim() : "Berlin";
}

function extractMathExpression(input) {
  return input.replace(/rechne|berechne|calc|rechner|was ist/gi, "").replace(/\?/g, "").trim();
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
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function extractRandomBounds(input) {
  const betweenMatch = input.match(/(?:zwischen|von)\s+(\d+)\s+(?:und|bis)\s+(\d+)/i);
  if (betweenMatch) {
    return { min: Number(betweenMatch[1]), max: Number(betweenMatch[2]) };
  }

  const uptoMatch = input.match(/(?:bis|max(?:imal)?)\s+(\d+)/i);
  if (uptoMatch) {
    return { min: 1, max: Number(uptoMatch[1]) };
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
    durationMs,
    label: labelMatch && labelMatch[1] ? labelMatch[1].trim() : "",
  };
}

function startTimer(state, timerConfig) {
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

function listActiveTimers(state) {
  const activeTimers = state.timers.filter((timer) => timer.active);
  if (!activeTimers.length) {
    return "Aktuell laufen keine Timer.";
  }

  return activeTimers
    .map((timer) => `${timer.label}: noch ${Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))}s`)
    .join(" | ");
}

function extractNote(input) {
  return input.replace(/speichere|speicher|notiz|notizen|merke dir|merke/gi, "").replace(/:/g, "").trim();
}

function extractAmazonProduct(input) {
  return input
    .replace(/\b(?:auf|bei)\s+amazon\b/gi, " ")
    .replace(/\bamazon\b/gi, " ")
    .replace(/\b(?:such|suche|find|finde|bestell|bestelle|kauf|kaufe|hol|hole)(?:\s+mir)?(?:\s+bitte)?(?:\s+mal)?\b/gi, " ")
    .replace(/\b(?:bitte|mal|doch|gerne|für mich)\b/gi, " ")
    .replace(/\b(?:den|die|das|dem|der|ein|eine|einen|einem|einer|nen|ne|n)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "smart home gadget";
}

function searchAmazon(product) {
  return `https://www.amazon.de/s?k=${encodeURIComponent(product.trim())}`;
}

function extractUrl(input) {
  const match = input.match(/((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?)/i);
  if (!match) {
    return null;
  }

  const rawUrl = match[1].trim();
  return rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
}

function pickJoke() {
  return jokes[Math.floor(Math.random() * jokes.length)];
}

module.exports = {
  calculateExpression,
  capitalize,
  extractAmazonProduct,
  extractLocation,
  extractMathExpression,
  extractNote,
  extractRandomBounds,
  extractUrl,
  formatClockTimestamp,
  formatDateForZone,
  formatTimeForZone,
  getDate,
  getDateForLocation,
  getRandomNumber,
  getTime,
  getTimeForLocation,
  getWeather,
  listActiveTimers,
  parseTimerInput,
  pickJoke,
  searchAmazon,
  startTimer,
};
