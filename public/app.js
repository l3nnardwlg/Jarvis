/* ── DOM refs ───────────────────────────────────────── */
const chatLog = document.getElementById("chat-log");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command-input");
const submitButton = commandForm.querySelector('button[type="submit"]');
const quickActions = document.getElementById("quick-actions");
const commandMode = document.getElementById("command-mode");
const modeChip = document.getElementById("mode-chip");
const chatList = document.getElementById("chat-list");
const modeSelector = document.getElementById("mode-selector");
const newChatBtn = document.getElementById("new-chat-btn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const settingsUiSound = document.getElementById("setting-ui-sound");
const settingsVoiceInput = document.getElementById("setting-voice-input");
const settingsVoiceOutput = document.getElementById("setting-voice-output");
const settingsUrl = document.getElementById("setting-auto-open-url");
const voiceToggle = document.getElementById("voice-toggle");
const aiDot = document.getElementById("ai-dot");
const pluginList = document.getElementById("plugin-list");
const appLayout = document.getElementById("app-layout");
const wakeupScreen = document.getElementById("wakeup-screen");
const wakeupButton = document.getElementById("wakeup-button");
const wakeupTitle = document.getElementById("wakeup-title");
const wakeupSubtitle = document.getElementById("wakeup-subtitle");
const wakeupStatus = document.getElementById("wakeup-status");
const wakeupIndicator = document.getElementById("wakeup-indicator");

const sendIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
const spinnerIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

/* ── State ──────────────────────────────────────────── */
const SETTINGS_KEY = "jarvis-v2-settings";
const SESSION_KEY = "jarvis-v2-session";

let currentSessionId = localStorage.getItem(SESSION_KEY) || "default";
let currentMode = "standard";
let audioContext = null;
let isListening = false;
let recognition = null;
let wakeState = "offline";
let wakeBootTimer = null;

const WAKE_WORDS = ["wakeup", "jarvis"];

const historyState = { entries: [], index: -1, draft: "" };

const defaultSettings = {
  uiSound: false,
  voiceInput: false,
  voiceOutput: false,
  autoOpenUrlLinks: true,
};
let uiSettings = loadSettings();

/* ── Settings ──────────────────────────────────────── */
function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") };
  } catch { return { ...defaultSettings }; }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(uiSettings));
}

function syncSettingsUi() {
  settingsUiSound.checked = uiSettings.uiSound;
  if (settingsVoiceInput) settingsVoiceInput.checked = uiSettings.voiceInput;
  if (settingsVoiceOutput) settingsVoiceOutput.checked = uiSettings.voiceOutput;
  if (settingsUrl) settingsUrl.checked = uiSettings.autoOpenUrlLinks;
}

/* ── Markdown renderer ─────────────────────────────── */
function renderMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const tag = lang ? `<span class="code-lang-tag">${lang}</span>` : "";
    return `<pre>${tag}<code>${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/<pre>([\s\S]*?)<\/pre>/g, (match) => match.replace(/<br>/g, "\n"));

  return html;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ── Helpers ────────────────────────────────────────── */
function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setWakePresentation(state, statusText, subtitleText) {
  wakeState = state;

  if (commandMode) {
    commandMode.textContent = state === "online" ? "ONLINE" : state === "listening" ? "LISTENING" : "OFFLINE";
    commandMode.classList.toggle("is-busy", state === "booting");
  }

  if (aiDot) {
    aiDot.classList.toggle("offline", state !== "online");
  }

  if (wakeupTitle) {
    wakeupTitle.textContent = state === "online" ? "Jarvis online" : state === "booting" ? "Booting Jarvis" : "Jarvis offline";
  }

  if (wakeupStatus && statusText) {
    wakeupStatus.textContent = statusText;
  }

  if (wakeupSubtitle && subtitleText) {
    wakeupSubtitle.innerHTML = subtitleText;
  }

  if (wakeupIndicator) {
    wakeupIndicator.classList.remove("is-offline", "is-listening", "is-online");
    wakeupIndicator.classList.add(
      state === "online" ? "is-online" : state === "listening" || state === "booting" ? "is-listening" : "is-offline"
    );
  }

  if (voiceToggle) {
    voiceToggle.classList.toggle("active", state === "listening");
  }
}

function unlockJarvis() {
  setWakePresentation("online", "System aktiv", "Sprich mit Jarvis oder tippe direkt in den Chat.");
  document.body.classList.remove("is-booting");
  wakeupScreen?.classList.add("is-hidden");
  appLayout?.classList.remove("app-layout-hidden");
  appLayout?.classList.add("app-layout-awake");
  renderQuickActions(getModeQuickActions());
  addMessage("jarvis", "Wakeword erkannt. **Jarvis online.** Wie kann ich helfen?", { markdown: true });
  commandInput.focus();
}

function startJarvis() {
  if (wakeState === "online" || wakeState === "booting") return;

  window.clearTimeout(wakeBootTimer);
  document.body.classList.add("is-booting");
  setWakePresentation("booting", "Wakeword erkannt", "Systeme werden hochgefahren. Chat-Schnittstelle wird freigegeben.");
  playUiBeep();

  wakeBootTimer = window.setTimeout(() => {
    unlockJarvis();
  }, 950);
}

function detectWakeWord(text) {
  const transcript = String(text || "").toLowerCase();
  return WAKE_WORDS.some((word) => transcript.includes(word));
}

/* ── Messages ──────────────────────────────────────── */
function addMessage(role, content, options = {}) {
  const entry = document.createElement("article");
  const cssRole = role === "system" ? "system-msg" : role;
  entry.className = `message ${cssRole}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "YOU" : role === "system" ? "SYSTEM" : "JARVIS";

  const body = document.createElement("div");
  body.className = "message-body";

  if (options.html) {
    body.innerHTML = content;
  } else if (options.markdown) {
    body.innerHTML = renderMarkdown(content);
  } else {
    body.textContent = content;
  }

  entry.appendChild(label);
  entry.appendChild(body);

  if (options.tokenInfo) {
    const info = document.createElement("div");
    info.className = "token-info";
    info.textContent = options.tokenInfo;
    entry.appendChild(info);
  }

  chatLog.appendChild(entry);
  scrollToBottom();
  return entry;
}

function addStreamingMessage() {
  const entry = document.createElement("article");
  entry.className = "message jarvis streaming";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = "JARVIS";

  const body = document.createElement("div");
  body.className = "message-body";

  const cursor = document.createElement("span");
  cursor.className = "type-cursor";
  cursor.textContent = "|";

  body.appendChild(cursor);
  entry.appendChild(label);
  entry.appendChild(body);
  chatLog.appendChild(entry);
  scrollToBottom();

  return { entry, body, cursor };
}

function addThinkingIndicator() {
  const entry = document.createElement("article");
  entry.className = "message jarvis thinking";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = "JARVIS";

  const body = document.createElement("div");
  body.className = "message-body message-body-thinking";
  body.innerHTML = '<p>Thinking</p><span class="thinking-dots"><span></span><span></span><span></span></span>';

  entry.appendChild(label);
  entry.appendChild(body);
  chatLog.appendChild(entry);
  scrollToBottom();
  return entry;
}

/* ── UI state ──────────────────────────────────────── */
function setBusyState(busy) {
  commandInput.disabled = busy;
  submitButton.disabled = busy;
  submitButton.innerHTML = busy ? spinnerIcon : sendIcon;
  commandMode.textContent = busy ? "PROCESSING" : "ONLINE";
  commandMode.classList.toggle("is-busy", busy);
}

function setMode(mode) {
  currentMode = mode;
  modeChip.textContent = { standard: "Standard", dev: "Developer", creative: "Creative", analyst: "Analyst" }[mode] || mode;
  modeChip.dataset.mode = mode;

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function renderQuickActions(items = []) {
  quickActions.replaceChildren();
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item;
    btn.addEventListener("click", () => submitMessage(item));
    quickActions.appendChild(btn);
  });
}

/* ── Session management ────────────────────────────── */
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

async function loadSessionList() {
  try {
    const data = await fetchJson("/api/sessions");
    renderSessionList(Array.isArray(data) ? data : []);
  } catch { /* ignore */ }
}

function renderSessionList(sessions) {
  chatList.replaceChildren();
  if (!sessions.length) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "No chats yet.";
    chatList.appendChild(hint);
    return;
  }

  sessions.forEach((s) => {
    const item = document.createElement("div");
    item.className = `chat-item${s.id === currentSessionId ? " active" : ""}`;
    item.dataset.id = s.id;

    const title = document.createElement("span");
    title.className = "chat-item-title";
    title.textContent = s.id;

    item.appendChild(title);
    item.addEventListener("click", () => switchSession(s.id));
    chatList.appendChild(item);
  });
}

async function switchSession(sessionId) {
  if (sessionId === currentSessionId) return;
  currentSessionId = sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
  chatLog.replaceChildren();
  loadSessionList();
}

async function createNewSession() {
  currentSessionId = `session_${Date.now()}`;
  localStorage.setItem(SESSION_KEY, currentSessionId);
  chatLog.replaceChildren();
  addMessage("jarvis", "New session started. Type a message or use `/help` for commands.", { markdown: true });
  renderQuickActions(getModeQuickActions());
  loadSessionList();
}

function getModeQuickActions() {
  const map = {
    standard: ["System status", "What time is it?", "Tell me a joke", "Weather in London"],
    dev: ["Explain async/await", "Generate REST API", "Review my code", "Debug this error"],
    creative: ["Brainstorm ideas", "Write a story", "Design concepts", "Creative names"],
    analyst: ["Analyze data", "SWOT analysis", "Create a plan", "Market research"],
  };
  return map[currentMode] || map.standard;
}

/* ── Streaming chat ────────────────────────────────── */
async function submitMessage(message) {
  if (wakeState !== "online") return;

  const trimmed = String(message || "").trim();
  if (!trimmed) return;

  rememberCommand(trimmed);
  addMessage("user", trimmed);
  setBusyState(true);

  const thinking = addThinkingIndicator();

  try {
    let fullText = "";

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        sessionId: currentSessionId,
        mode: currentMode,
      }),
    });

    thinking.remove();

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream")) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamEl = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;

          let data;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.token) {
            if (!streamEl) streamEl = addStreamingMessage();
            fullText += data.token;
            streamEl.body.innerHTML = renderMarkdown(fullText);
            const cursor = document.createElement("span");
            cursor.className = "type-cursor";
            cursor.textContent = "|";
            streamEl.body.appendChild(cursor);
            scrollToBottom();
          }

          if (data.done && streamEl) {
            streamEl.entry.classList.remove("streaming");
            streamEl.body.innerHTML = renderMarkdown(fullText);
            if (data.full) {
              streamEl.body.innerHTML = renderMarkdown(data.full);
            }
          }
        }
      }

      if (!streamEl && fullText === "") {
        addMessage("jarvis", "No response received.", { markdown: false });
      }
    } else {
      const data = await res.json();
      if (data.response) {
        fullText = data.response;
        addMessage("jarvis", data.response, { markdown: true });
      } else if (data.error) {
        addMessage("jarvis", "Error: " + data.error);
      }
    }

    playUiBeep();
    if (uiSettings.voiceOutput && fullText) speakText(fullText);
  } catch (err) {
    thinking.remove();
    addMessage("jarvis", "Connection error: " + err.message);
  } finally {
    setBusyState(false);
    commandInput.focus();
  }
}

/* ── Dashboard updates ────────────────────────────── */
const statusFields = {
  time: document.getElementById("status-time"),
  date: document.getElementById("status-date"),
  ai: document.getElementById("status-ai"),
  memory: document.getElementById("status-memory"),
  plugins: document.getElementById("status-plugins"),
  voice: document.getElementById("status-voice"),
  tasks: document.getElementById("status-tasks"),
};

async function refreshDashboard() {
  try {
    const data = await fetchJson("/api/status");
    if (data.modules) {
      const ai = data.modules.ai;
      if (ai && statusFields.ai) {
        statusFields.ai.textContent = ai.available ? ai.provider : "Offline";
        aiDot.classList.toggle("offline", wakeState !== "online" || !ai.available);
      }

      const mem = data.modules.memory;
      if (mem && statusFields.memory) {
        statusFields.memory.textContent = `${mem.facts || 0}F / ${mem.vectorEntries || 0}V`;
      }

      const plug = data.modules.plugins;
      if (plug && statusFields.plugins) {
        statusFields.plugins.textContent = `${plug.plugins || 0} loaded`;
      }

      const voice = data.modules.voice;
      if (voice && statusFields.voice) {
        statusFields.voice.textContent = voice.stt || voice.tts ? "Available" : "Offline";
      }

      const sched = data.modules.scheduler;
      if (sched && statusFields.tasks) {
        statusFields.tasks.textContent = `${sched.activeTasks || 0} active`;
      }
    }
  } catch { /* ignore */ }
}

async function refreshPlugins() {
  if (!pluginList) return;
  try {
    const data = await fetchJson("/api/plugins");
    pluginList.replaceChildren();
    const plugins = Array.isArray(data) ? data : [];
    if (plugins.length === 0) {
      pluginList.innerHTML = '<div class="tele-mini-row"><span>None loaded</span></div>';
      return;
    }
    plugins.forEach((p) => {
      const row = document.createElement("div");
      row.className = "tele-mini-row";
      row.innerHTML = `<span>${p.name || p.id}</span><span>${p.enabled !== false ? "Active" : "Off"}</span>`;
      pluginList.appendChild(row);
    });
  } catch { /* ignore */ }
}

function tickClock() {
  const now = new Date();
  if (statusFields.time) {
    statusFields.time.textContent = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  }
  if (statusFields.date) {
    statusFields.date.textContent = now.toLocaleDateString("en-US", {
      weekday: "short", day: "2-digit", month: "short",
    });
  }
}

/* ── Voice I/O ─────────────────────────────────────── */
function initVoiceInput() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;

  if (recognition) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "de-DE";

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const transcript = result?.[0]?.transcript || "";

    if (wakeState !== "online") {
      if (detectWakeWord(transcript)) {
        startJarvis();
      } else {
        setWakePresentation("listening", "Standby hört zu", 'Warte auf <strong>"wakeup"</strong> oder <strong>"jarvis"</strong>.');
      }
      return;
    }

    if (!result?.isFinal) return;

    commandInput.value = transcript;
    submitMessage(transcript);
  };

  recognition.onerror = () => {
    isListening = false;
    if (wakeState !== "online") {
      setWakePresentation("offline", "Mikrofon blockiert", "Erlaube Mikrofonzugriff und starte den Wake Listener erneut.");
    }
  };

  recognition.onend = () => {
    if (!isListening) return;

    try {
      recognition.start();
    } catch {
      setWakePresentation(wakeState === "online" ? "online" : "listening", wakeState === "online" ? "Sprachmodus aktiv" : "Standby hört zu");
    }
  };
}

function startListening() {
  if (!recognition) initVoiceInput();
  if (!recognition) return;

  if (isListening) return;

  isListening = true;
  if (wakeState !== "online") {
    setWakePresentation("listening", "Standby hört zu", 'Warte auf <strong>"wakeup"</strong> oder <strong>"jarvis"</strong>.');
  }

  try {
    recognition.start();
  } catch {}
}

function stopListening() {
  isListening = false;
  if (voiceToggle) voiceToggle.classList.remove("active");

  if (wakeState !== "online") {
    setWakePresentation("offline", "Mikrofon im Standby", 'Sag <strong>"wakeup"</strong> oder <strong>"jarvis"</strong>, um das System zu aktivieren.');
  }
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 500));
  utterance.rate = 1.0;
  utterance.pitch = 0.9;
  speechSynthesis.speak(utterance);
}

/* ── Audio ──────────────────────────────────────────── */
function playUiBeep() {
  if (!uiSettings.uiSound || !window.AudioContext) return;
  try {
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(); osc.stop(audioContext.currentTime + 0.13);
  } catch { /* audio is optional */ }
}

/* ── Command history ───────────────────────────────── */
function rememberCommand(cmd) {
  if (!cmd || historyState.entries[historyState.entries.length - 1] === cmd) {
    historyState.index = historyState.entries.length;
    return;
  }
  historyState.entries.push(cmd);
  historyState.entries = historyState.entries.slice(-30);
  historyState.index = historyState.entries.length;
}

function navigateHistory(dir) {
  if (!historyState.entries.length) return;
  if (historyState.index === historyState.entries.length) historyState.draft = commandInput.value;
  historyState.index = Math.max(0, Math.min(historyState.entries.length, historyState.index + dir));
  commandInput.value = historyState.index === historyState.entries.length
    ? historyState.draft
    : historyState.entries[historyState.index];
}

/* ── Event listeners ───────────────────────────────── */
commandForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = commandInput.value;
  commandInput.value = "";
  submitMessage(msg);
});

commandInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") { e.preventDefault(); navigateHistory(-1); }
  if (e.key === "ArrowDown") { e.preventDefault(); navigateHistory(1); }
});

newChatBtn.addEventListener("click", createNewSession);

modeSelector.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  setMode(btn.dataset.mode);
  renderQuickActions(getModeQuickActions());
});

sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("is-open"));

settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("is-open");
  settingsPanel.setAttribute("aria-hidden", String(!settingsPanel.classList.contains("is-open")));
});

settingsClose.addEventListener("click", () => {
  settingsPanel.classList.remove("is-open");
  settingsPanel.setAttribute("aria-hidden", "true");
});

settingsUiSound.addEventListener("change", () => { uiSettings.uiSound = settingsUiSound.checked; saveSettings(); });
if (settingsVoiceInput) settingsVoiceInput.addEventListener("change", () => { uiSettings.voiceInput = settingsVoiceInput.checked; saveSettings(); });
if (settingsVoiceOutput) settingsVoiceOutput.addEventListener("change", () => { uiSettings.voiceOutput = settingsVoiceOutput.checked; saveSettings(); });
if (settingsUrl) settingsUrl.addEventListener("change", () => { uiSettings.autoOpenUrlLinks = settingsUrl.checked; saveSettings(); });

if (voiceToggle) {
  voiceToggle.addEventListener("click", () => {
    if (isListening) {
      stopListening();
      recognition?.stop();
    } else {
      startListening();
    }
  });
}

if (wakeupButton) {
  wakeupButton.addEventListener("click", () => startListening());
}

document.addEventListener("click", (e) => {
  if (window.innerWidth <= 960 && sidebar.classList.contains("is-open")) {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove("is-open");
    }
  }
});

/* ── Bootstrap ─────────────────────────────────────── */
async function bootstrap() {
  syncSettingsUi();
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(refreshDashboard, 5000);
  setInterval(refreshPlugins, 15000);

  await refreshDashboard();
  await refreshPlugins();
  await loadSessionList();

  setWakePresentation("offline", "Mikrofon im Standby", 'Sag <strong>"wakeup"</strong> oder <strong>"jarvis"</strong>, um das System zu aktivieren.');
  initVoiceInput();

  if (uiSettings.voiceInput) {
    startListening();
  }
}

bootstrap();
