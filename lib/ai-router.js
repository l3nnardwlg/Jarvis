const http = require("http");
const https = require("https");

const OLLAMA_ENABLED = !["0", "false", "off", "no"].includes(
  String(process.env.OLLAMA_ENABLED || "true").trim().toLowerCase()
);
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 15000;
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);
const OLLAMA_HEALTH_TTL_MS = Number(process.env.OLLAMA_HEALTH_TTL_MS) || 30000;
const OLLAMA_RETRY_AFTER_FAILURE_MS = Number(process.env.OLLAMA_RETRY_AFTER_FAILURE_MS) || 15000;

const aiHealth = {
  available: null,
  lastCheckedAt: null,
  lastError: null,
  cooldownUntil: 0,
};

const routeAliases = {
  knowledge: "knowledge",
  time: "time",
  date: "date",
  calc: "calc",
  amazon: "amazon",
  random: "random",
  timer: "timer",
  notes_add: "notes",
  notes_list: "notes",
  open_url: "open-url",
  joke: "joke",
  weather: "weather",
  status: "status",
  light: "light",
  focus: "focus",
  alarm: "alarm",
  greeting: "greeting",
};

const routeDescriptions = {
  knowledge: "Allgemeine Wissensfragen, Erklaerungen und Produktwissen",
  time: "Uhrzeit oder Zeit fuer einen Ort",
  date: "Datum oder Tag fuer einen Ort",
  calc: "Rechnungen und Folgeoperationen",
  amazon: "Produktsuche bei Amazon",
  random: "Zufallszahlen",
  timer: "Timer starten oder Timerstatus abfragen",
  notes_add: "Notiz speichern",
  notes_list: "Notizen anzeigen oder letzte Notiz lesen",
  open_url: "Website oder URL oeffnen",
  joke: "Witz erzaehlen",
  weather: "Wetter fuer einen Ort",
  status: "Systemstatus anzeigen",
  light: "Licht ein- oder ausschalten",
  focus: "Fokusmodus umschalten",
  alarm: "Alarm ein- oder ausschalten",
  greeting: "Begruessung oder allgemeiner Jarvis-Aufruf",
};

function buildRoutes(commands) {
  const availableCommands = new Set(commands.map((command) => command.name));

  return Object.entries(routeAliases)
    .filter(([, commandName]) => availableCommands.has(commandName))
    .map(([routeName, commandName]) => ({
      routeName,
      commandName,
      description: routeDescriptions[routeName] || commandName,
    }));
}

function buildPrompt(input, commands) {
  const routes = buildRoutes(commands)
    .map((route) => `- ${route.routeName}: ${route.description}`)
    .join("\n");

  return [
    "Du bist ein Router fuer ein lokales Command-System.",
    "Waehle genau einen passenden Command.",
    "Erzeuge keine Antwort an den Nutzer.",
    "Gib nur JSON zurueck.",
    'Format: {"command":"...","input":"..."}',
    "command muss einer dieser Werte sein:",
    routes,
    "input soll nur den relevanten Kern enthalten.",
    "Bei Notizen verwende notes_add zum Speichern und notes_list zum Anzeigen.",
    "Bei URLs verwende open_url.",
    `Nutzereingabe: ${JSON.stringify(String(input || ""))}`,
  ].join("\n");
}

function deriveHealthEndpoint() {
  const endpointUrl = new URL(OLLAMA_ENDPOINT);
  endpointUrl.pathname = "/api/tags";
  endpointUrl.search = "";
  endpointUrl.hash = "";
  return endpointUrl;
}

function requestJson(endpointUrl, options = {}) {
  const client = endpointUrl.protocol === "https:" ? https : http;
  const requestBody = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const request = client.request(
      endpointUrl,
      {
        method: options.method || "GET",
        headers: requestBody
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(requestBody),
            }
          : undefined,
        timeout: options.timeout ?? OLLAMA_TIMEOUT_MS,
      },
      (response) => {
        let rawData = "";

        response.on("data", (chunk) => {
          rawData += chunk;
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Ollama HTTP ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(rawData));
          } catch {
            reject(new Error("Ollama lieferte kein gueltiges JSON."));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Ollama Anfrage lief in ein Timeout."));
    });

    request.on("error", reject);

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

function markAIAvailable() {
  aiHealth.available = true;
  aiHealth.lastCheckedAt = Date.now();
  aiHealth.lastError = null;
  aiHealth.cooldownUntil = 0;
}

function markAIUnavailable(error) {
  aiHealth.available = false;
  aiHealth.lastCheckedAt = Date.now();
  aiHealth.lastError = error ? error.message : "Ollama ist nicht erreichbar.";
  aiHealth.cooldownUntil = Date.now() + OLLAMA_RETRY_AFTER_FAILURE_MS;
}

async function ensureOllamaAvailable() {
  if (!OLLAMA_ENABLED) {
    return false;
  }

  const now = Date.now();
  if (aiHealth.available === true && aiHealth.lastCheckedAt && now - aiHealth.lastCheckedAt < OLLAMA_HEALTH_TTL_MS) {
    return true;
  }

  if (aiHealth.available === false && now < aiHealth.cooldownUntil) {
    return false;
  }

  try {
    await requestJson(deriveHealthEndpoint(), {
      method: "GET",
      timeout: Math.min(OLLAMA_TIMEOUT_MS, 2500),
    });
    markAIAvailable();
    return true;
  } catch (error) {
    markAIUnavailable(error);
    return false;
  }
}

function primeAIStatus() {
  return ensureOllamaAvailable();
}

function getAIStatus() {
  const now = Date.now();
  const inCooldown = aiHealth.available === false && now < aiHealth.cooldownUntil;
  let state = "disabled";

  if (OLLAMA_ENABLED) {
    if (aiHealth.available === true) {
      state = "online";
    } else if (inCooldown) {
      state = "cooldown";
    } else if (aiHealth.available === false) {
      state = "offline";
    } else {
      state = "unknown";
    }
  }

  return {
    enabled: OLLAMA_ENABLED,
    available: aiHealth.available === true,
    state,
    model: OLLAMA_MODEL,
    endpoint: OLLAMA_ENDPOINT,
    lastError: aiHealth.lastError,
    lastCheckedAt: aiHealth.lastCheckedAt,
  };
}

function askOllama(prompt) {
  return requestJson(new URL(OLLAMA_ENDPOINT), {
    method: "POST",
    timeout: OLLAMA_TIMEOUT_MS,
    body: {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: OLLAMA_TEMPERATURE,
        num_predict: 80,
      },
    },
  });
}

function askOllamaText(prompt, options = {}) {
  return requestJson(new URL(OLLAMA_ENDPOINT), {
    method: "POST",
    timeout: options.timeout ?? OLLAMA_TIMEOUT_MS,
    body: {
      model: options.model || OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.3,
        num_predict: options.numPredict ?? 280,
      },
    },
  });
}

function cleanKnowledgeAnswer(value) {
  return String(value || "")
    .replace(/^hallo!?\s*/i, "")
    .replace(/^hi!?\s*/i, "")
    .replace(/^ich bin jarvis[^.]*\.\s*/i, "")
    .replace(/^ich bin (?:ein|dein) [^.]*\.\s*/i, "")
    .replace(/^gerne\.?\s*/i, "")
    .replace(/\bals ki\b[^.]*\.?/gi, "")
    .replace(/\bich helfe dir gerne\b\.?/gi, "")
    .replace(/\bwie kann ich dir helfen\??/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function rewriteKnowledgeAnswer(question, sourcePreview, sourceNames = []) {
  const available = await ensureOllamaAvailable();
  if (!available) {
    throw new Error("Ollama Rewrite ist aktuell nicht verfuegbar.");
  }

  const prompt = [
    "Schreibe eine natuerliche, knappe Antwort auf Deutsch.",
    "Klinge wie ein normaler technischer Mensch im Chat, nicht wie ein Assistent oder eine KI.",
    "Keine Begruessung. Keine Floskeln. Kein 'ich helfe dir gerne'. Kein 'als KI'.",
    "Antworte direkt auf die Frage in 2 bis 4 Saetzen.",
    "Nutze nur die Informationen aus den Quellen unten.",
    "Wenn etwas in den Quellen nicht klar ist, sage das kurz und sachlich.",
    "Fuege am Ende genau eine Zeile an im Format: Quellen: name1, name2",
    "",
    `Frage: ${String(question || "").trim()}`,
    "",
    "Quellenmaterial:",
    sourcePreview,
    "",
    `Quellennamen: ${sourceNames.join(", ")}`,
  ].join("\n");

  try {
    const rawResponse = await askOllamaText(prompt, {
      temperature: 0.15,
      numPredict: 220,
      timeout: Math.max(OLLAMA_TIMEOUT_MS, 18000),
    });
    markAIAvailable();
    return cleanKnowledgeAnswer(rawResponse.response);
  } catch (error) {
    markAIUnavailable(error);
    throw error;
  }
}

function extractJsonString(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("Ollama lieferte eine leere Antwort.");
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseRouteResponse(rawResponse, commands) {
  const routes = buildRoutes(commands);
  const availableRoutes = new Set(routes.map((route) => route.routeName));
  const jsonString = extractJsonString(rawResponse.response);

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Ollama lieferte kein parsebares Routing-JSON.");
  }

  const routeName = String(parsed.command || "").trim();
  if (!availableRoutes.has(routeName)) {
    throw new Error(`Unbekannter AI-Route-Name: ${routeName || "leer"}`);
  }

  const commandName = routeAliases[routeName];
  const command = commands.find((entry) => entry.name === commandName);
  if (!command) {
    throw new Error(`AI waehlte Command ${commandName}, aber er existiert nicht.`);
  }

  return {
    routeName,
    commandName,
    command,
    input: typeof parsed.input === "string" ? parsed.input.trim() : "",
    rawResponse: rawResponse.response,
    model: rawResponse.model || OLLAMA_MODEL,
  };
}

function isNonSpecificTimeInput(value) {
  return ["", "now", "current", "current time", "aktuell", "jetzt", "heute"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function normalizeUrlInput(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized) || normalized.includes(".")) {
    return normalized;
  }

  if (/^[a-z0-9-]+$/i.test(normalized)) {
    return `${normalized}.com`;
  }

  return normalized;
}

function buildExecutionInput(aiRoute, originalInput) {
  const routedInput = String(aiRoute.input || "").trim();
  if (!routedInput) {
    return String(originalInput || "");
  }

  switch (aiRoute.routeName) {
    case "time":
      if (isNonSpecificTimeInput(routedInput)) {
        return String(originalInput || "");
      }
      return `uhrzeit in ${routedInput}`;
    case "date":
      if (isNonSpecificTimeInput(routedInput)) {
        return String(originalInput || "");
      }
      return `datum in ${routedInput}`;
    case "calc":
      return `rechne ${routedInput}`;
    case "amazon":
      return `such ${routedInput} auf amazon`;
    case "random":
      return `zufallszahl ${routedInput}`;
    case "timer":
      return `timer ${routedInput}`;
    case "notes_add":
      return `speichere notiz ${routedInput}`;
    case "notes_list":
      return routedInput ? `zeige notizen ${routedInput}` : "zeige meine notizen";
    case "open_url":
      return `oeffne ${normalizeUrlInput(routedInput)}`;
    case "weather":
      if (isNonSpecificTimeInput(routedInput)) {
        return String(originalInput || "");
      }
      return `wetter in ${routedInput}`;
    case "knowledge":
      return routedInput || String(originalInput || "");
    case "status":
      return "status";
    case "joke":
      return "witz";
    case "light":
    case "focus":
    case "alarm":
    case "greeting":
      return routedInput || String(originalInput || "");
    default:
      return String(originalInput || "");
  }
}

async function routeWithAI(input, commands) {
  const available = await ensureOllamaAvailable();
  if (!available) {
    throw new Error("Ollama Routing ist aktuell nicht verfuegbar.");
  }

  const prompt = buildPrompt(input, commands);
  try {
    const rawResponse = await askOllama(prompt);
    const parsedRoute = parseRouteResponse(rawResponse, commands);
    markAIAvailable();

    return {
      ...parsedRoute,
      executionInput: buildExecutionInput(parsedRoute, input),
    };
  } catch (error) {
    markAIUnavailable(error);
    throw error;
  }
}

async function answerKnowledgeQuestion(question, knowledgeContext) {
  const available = await ensureOllamaAvailable();
  if (!available) {
    throw new Error("Ollama Wissensmodus ist aktuell nicht verfuegbar.");
  }

  const hasLocalSources = Boolean(knowledgeContext && !/Keine lokalen Wissensquellen gefunden\./.test(knowledgeContext));
  const prompt = [
    "Du bist Jarvis, ein lokaler Assistent.",
    "Beantworte die Frage praezise auf Deutsch.",
    "Keine Begruessung. Keine Einleitung. Keine Rollenspiel-Floskeln.",
    hasLocalSources
      ? "Nutze die lokalen Wissensquellen als primaere Grundlage. Wenn Quellen vorhanden sind, antworte konkret aus diesen Quellen statt allgemein."
      : "Es sind keine lokalen Quellen vorhanden. Du darfst allgemeines Modellwissen nutzen, aber markiere unsichere Punkte klar.",
    hasLocalSources
      ? "Wenn die Quellen nicht reichen, sage das offen. Erfinde keine Fakten und wechsle nicht in generische Assistenten-Antworten."
      : "Erfinde keine konkreten Fakten, wenn du dir unsicher bist.",
    "Antworte kompakt in 1 bis 3 kurzen Absaetzen.",
    "Nenne am Ende, wenn vorhanden, die genutzten lokalen Quellen als Dateinamen in einer Zeile 'Quellen: ...'.",
    "",
    "Lokale Wissensquellen:",
    knowledgeContext || "Keine lokalen Wissensquellen gefunden.",
    "",
    `Frage: ${String(question || "").trim()}`,
  ].join("\n");

  try {
    const rawResponse = await askOllamaText(prompt, {
      temperature: 0.25,
      numPredict: 320,
      timeout: Math.max(OLLAMA_TIMEOUT_MS, 20000),
    });
    markAIAvailable();
    return String(rawResponse.response || "").trim();
  } catch (error) {
    markAIUnavailable(error);
    throw error;
  }
}

module.exports = {
  answerKnowledgeQuestion,
  askOllama,
  buildExecutionInput,
  cleanKnowledgeAnswer,
  getAIStatus,
  primeAIStatus,
  rewriteKnowledgeAnswer,
  routeWithAI,
};