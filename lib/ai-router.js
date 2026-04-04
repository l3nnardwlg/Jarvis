const http = require("http");
const https = require("https");

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 15000;
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);

const routeAliases = {
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

function askOllama(prompt) {
  const endpointUrl = new URL(OLLAMA_ENDPOINT);
  const client = endpointUrl.protocol === "https:" ? https : http;
  const requestBody = JSON.stringify({
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    format: "json",
    options: {
      temperature: OLLAMA_TEMPERATURE,
      num_predict: 80,
    },
  });

  return new Promise((resolve, reject) => {
    const request = client.request(
      endpointUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
        timeout: OLLAMA_TIMEOUT_MS,
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
    request.write(requestBody);
    request.end();
  });
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
  const prompt = buildPrompt(input, commands);
  const rawResponse = await askOllama(prompt);
  const parsedRoute = parseRouteResponse(rawResponse, commands);

  return {
    ...parsedRoute,
    executionInput: buildExecutionInput(parsedRoute, input),
  };
}

module.exports = {
  askOllama,
  buildExecutionInput,
  routeWithAI,
};