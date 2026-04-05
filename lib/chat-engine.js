const {
  ensureOllamaAvailable,
  streamOllamaChat,
  markAIAvailable,
  markAIUnavailable,
  OLLAMA_MODEL,
} = require("./ai-router");
const sessionStore = require("./session-store");
const { searchWeb, formatSearchContext, isSearchAvailable } = require("./search");
const taskStore = require("./task-store");

const MODE_PROMPTS = {
  standard: [
    "Du bist Jarvis, ein lokaler technischer Assistent.",
    "Antworte praezise und direkt auf Deutsch.",
    "Keine Floskeln, keine Rollenspielsaetze wie 'als KI' oder 'ich helfe dir gerne'.",
    "Formatiere wichtige Begriffe mit **fett** und nutze Aufzaehlungen wo sinnvoll.",
  ].join(" "),
  dev: [
    "Du bist Jarvis im Entwicklermodus.",
    "Du schreibst Code, analysierst Fehler, erklaerst Konzepte und generierst Terminal-Befehle.",
    "Formatiere Code immer in Markdown-Codeblocks mit Sprachkennung (```js, ```python, etc.).",
    "Antworte auf Deutsch. Sei technisch praezise und kompakt.",
    "Wenn der User Code zeigt, analysiere ihn direkt ohne Nachfragen.",
  ].join(" "),
  business: [
    "Du bist Jarvis im Business-Modus.",
    "Du analysierst Geschaeftsideen, erstellst Plaene, bewertest Marktchancen und formulierst professionell.",
    "Nutze Struktur: Ueberschriften, Aufzaehlungen, klare Abschnitte.",
    "Antworte auf Deutsch. Denke strategisch und ergebnisorientiert.",
  ].join(" "),
  hacker: [
    "Du bist Jarvis im Hacker-Modus.",
    "Du erklaerst Netzwerke, Sicherheit, Kryptographie und Systeme.",
    "Technisch praezise, kompakt, mit Code-Beispielen wo noetig.",
    "Antworte auf Deutsch. Fokus auf Verstaendnis und praktisches Wissen.",
    "Hinweis: Nur fuer Lernzwecke und legale Sicherheitsforschung.",
  ].join(" "),
};

const VALID_MODES = Object.keys(MODE_PROMPTS);

const SLASH_COMMANDS = {
  mode: { args: true, description: "Modus wechseln (standard/dev/business/hacker)" },
  search: { args: true, description: "Websuche ausfuehren" },
  web: { args: true, description: "Websuche ausfuehren (Alias)" },
  task: { args: true, description: "Task erstellen" },
  clear: { args: false, description: "Chat leeren" },
  help: { args: false, description: "Verfuegbare Befehle anzeigen" },
};

const MODE_QUICK_ACTIONS = {
  standard: ["Status", "Wetter in Berlin", "Wie spaet ist es?", "Rechne 12*12"],
  dev: ["/search Node.js streams", "Erklaere async/await", "REST API generieren", "Code reviewen"],
  business: ["Geschaeftsidee analysieren", "SWOT Analyse", "Plan erstellen", "Marktanalyse"],
  hacker: ["Netzwerke erklaeren", "Was ist SQL Injection?", "Portscanner erklaeren", "HTTPS erklaeren"],
};

function getModePrompt(mode) {
  return MODE_PROMPTS[mode] || MODE_PROMPTS.standard;
}

function detectSlashCommand(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIndex = trimmed.indexOf(" ");
  const command = (spaceIndex > 0 ? trimmed.slice(1, spaceIndex) : trimmed.slice(1)).toLowerCase();
  const args = spaceIndex > 0 ? trimmed.slice(spaceIndex + 1).trim() : "";

  if (!SLASH_COMMANDS[command]) return null;
  return { command, args };
}

function shouldRouteToCommand(input, commands) {
  const normalized = String(input || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith("/")) return false;

  const commandTriggers = [
    "wetter", "zeit", "uhr", "uhrzeit", "datum", "tag",
    "rechne", "berechne", "rechner", "was ist",
    "amazon", "such ", "suche ",
    "timer", "alarm", "fokus", "focus",
    "licht an", "licht aus", "licht",
    "notiz", "merke", "speicher",
    "oeffne", "open url",
    "witz", "status", "system",
    "zufall", "random",
    "hallo jarvis", "hey jarvis",
  ];

  return commandTriggers.some((trigger) => normalized.includes(trigger));
}

function buildMessages(session, userMessage) {
  const systemPrompt = getModePrompt(session.mode);
  const messages = [{ role: "system", content: systemPrompt }];

  for (const msg of session.messages) {
    if (msg.role === "system") continue;
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamOllamaAndForward(ollamaMessages, session, res) {
  let fullContent = "";
  let tokenCount = 0;
  let totalDuration = 0;

  try {
    const { request, response: ollamaRes } = await streamOllamaChat(ollamaMessages, {
      temperature: session.mode === "dev" ? 0.3 : 0.4,
      numPredict: session.mode === "dev" ? 2048 : 1024,
    });

    markAIAvailable();
    let buffer = "";

    await new Promise((resolve, reject) => {
      ollamaRes.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message && parsed.message.content) {
              fullContent += parsed.message.content;
              sendSSE(res, { type: "token", content: parsed.message.content });
            }
            if (parsed.done) {
              tokenCount = parsed.eval_count || 0;
              totalDuration = parsed.total_duration || 0;
            }
          } catch { /* partial JSON */ }
        }
      });
      ollamaRes.on("end", resolve);
      ollamaRes.on("error", reject);
    });

    if (fullContent) {
      sessionStore.addMessage(session.id, "assistant", fullContent);
    }

    sendSSE(res, {
      type: "done",
      tokenCount,
      duration: Math.round(totalDuration / 1e6),
      model: OLLAMA_MODEL,
      sessionId: session.id,
      mode: session.mode,
      quickActions: MODE_QUICK_ACTIONS[session.mode] || MODE_QUICK_ACTIONS.standard,
    });
    res.end();
  } catch (error) {
    markAIUnavailable(error);
    sendSSE(res, { type: "error", message: `Ollama Fehler: ${error.message}` });
    sendSSE(res, { type: "done" });
    res.end();
  }
}

async function handleSlashCommand(slashCmd, session, res) {
  if (slashCmd.command === "mode") {
    const newMode = slashCmd.args.toLowerCase();
    if (!VALID_MODES.includes(newMode)) {
      sendSSE(res, {
        type: "error",
        message: `Unbekannter Modus: "${slashCmd.args}". Verfuegbar: ${VALID_MODES.join(", ")}`,
      });
      sendSSE(res, { type: "done" });
      res.end();
      return;
    }

    sessionStore.setMode(session.id, newMode);
    const label = { standard: "Standard", dev: "Entwickler", business: "Business", hacker: "Hacker" };
    sendSSE(res, {
      type: "mode-changed",
      mode: newMode,
      message: `Modus gewechselt: ${label[newMode] || newMode}`,
      quickActions: MODE_QUICK_ACTIONS[newMode] || MODE_QUICK_ACTIONS.standard,
    });
    sendSSE(res, { type: "done" });
    res.end();
    return;
  }

  if (slashCmd.command === "help") {
    const helpText = [
      "**Verfuegbare Befehle:**",
      "- `/mode <standard|dev|business|hacker>` - Modus wechseln",
      "- `/search <query>` - Websuche ausfuehren",
      "- `/task <beschreibung>` - Task erstellen",
      "- `/clear` - Chat leeren",
      "- `/help` - Diese Hilfe anzeigen",
      "",
      "Ausserdem funktionieren alle bisherigen Jarvis-Befehle (Wetter, Rechnen, Timer, etc.)",
    ].join("\n");

    sendSSE(res, { type: "token", content: helpText });
    sendSSE(res, { type: "done" });
    res.end();
    return;
  }

  if (slashCmd.command === "clear") {
    sendSSE(res, { type: "clear" });
    sendSSE(res, { type: "done" });
    res.end();
    return;
  }

  // /search and /web: Web search via SearXNG
  if (slashCmd.command === "search" || slashCmd.command === "web") {
    if (!slashCmd.args) {
      sendSSE(res, { type: "error", message: "Bitte gib einen Suchbegriff an: /search <query>" });
      sendSSE(res, { type: "done" });
      res.end();
      return;
    }

    const available = await isSearchAvailable();
    if (!available) {
      sendSSE(res, { type: "error", message: "SearXNG ist nicht erreichbar. Stelle sicher, dass SearXNG lokal laeuft." });
      sendSSE(res, { type: "done" });
      res.end();
      return;
    }

    try {
      const results = await searchWeb(slashCmd.args);
      const searchContext = formatSearchContext(results);

      // Add search results as context to the chat
      const searchMessage = `Basierend auf der Websuche nach "${slashCmd.args}", fasse die folgenden Ergebnisse zusammen und beantworte die Frage:\n\n${searchContext}`;
      sessionStore.addMessage(session.id, "user", `/search ${slashCmd.args}`);

      const ollamaAvailable = await ensureOllamaAvailable();
      if (!ollamaAvailable) {
        // Return raw search results without AI synthesis
        sendSSE(res, { type: "token", content: searchContext });
        sendSSE(res, { type: "done", sessionId: session.id, mode: session.mode });
        res.end();
        return;
      }

      // Stream AI synthesis of search results
      const ollamaMessages = [
        { role: "system", content: getModePrompt(session.mode) + "\nDu hast Zugriff auf aktuelle Websuchergebnisse. Nutze sie fuer deine Antwort." },
        { role: "user", content: searchMessage },
      ];

      return await streamOllamaAndForward(ollamaMessages, session, res, slashCmd.args);
    } catch (error) {
      sendSSE(res, { type: "error", message: `Suchfehler: ${error.message}` });
      sendSSE(res, { type: "done" });
      res.end();
      return;
    }
  }

  // /task: Create a new task
  if (slashCmd.command === "task") {
    if (!slashCmd.args) {
      sendSSE(res, { type: "error", message: "Bitte gib eine Beschreibung an: /task <beschreibung>" });
      sendSSE(res, { type: "done" });
      res.end();
      return;
    }

    const task = taskStore.createTask(slashCmd.args);
    const msg = `**Task erstellt:** ${task.title}\nID: \`${task.id}\`\nStatus: ${task.status}`;
    sendSSE(res, { type: "token", content: msg });
    sendSSE(res, { type: "done", sessionId: session.id, mode: session.mode });
    res.end();
    return;
  }

  sendSSE(res, { type: "error", message: `Slash-Command /${slashCmd.command} ist nicht bekannt. Nutze /help.` });
  sendSSE(res, { type: "done" });
  res.end();
}

async function streamChat(options, res, clientReq) {
  const { sessionId, message, mode } = options;

  let session = sessionStore.getSession(sessionId);
  if (!session) {
    session = sessionStore.createSession(mode || "standard");
  }

  if (mode && mode !== session.mode && VALID_MODES.includes(mode)) {
    sessionStore.setMode(session.id, mode);
    session = sessionStore.getSession(session.id);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Session-Id": session.id,
  });

  sendSSE(res, { type: "session", id: session.id, mode: session.mode });

  const slashCmd = detectSlashCommand(message);
  if (slashCmd) {
    await handleSlashCommand(slashCmd, session, res);
    return;
  }

  const available = await ensureOllamaAvailable();
  if (!available) {
    sendSSE(res, {
      type: "error",
      message: "Ollama ist aktuell nicht erreichbar. Starte Ollama und versuche es erneut.",
    });
    sendSSE(res, { type: "done" });
    res.end();
    return;
  }

  sessionStore.addMessage(session.id, "user", message);
  const ollamaMessages = buildMessages(session, message);

  const onClientClose = () => {};
  clientReq.on("close", onClientClose);

  try {
    await streamOllamaAndForward(ollamaMessages, session, res);
  } finally {
    clientReq.removeListener("close", onClientClose);
  }
}

module.exports = {
  streamChat,
  detectSlashCommand,
  shouldRouteToCommand,
  getModePrompt,
  VALID_MODES,
  MODE_QUICK_ACTIONS,
  SLASH_COMMANDS,
};
