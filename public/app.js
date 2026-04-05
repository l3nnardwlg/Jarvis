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
const settingsAmazon = document.getElementById("setting-auto-open-amazon");
const settingsUrl = document.getElementById("setting-auto-open-url");
const aiDot = document.getElementById("ai-dot");

const sendIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
const spinnerIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';

/* ── State ──────────────────────────────────────────── */
const SETTINGS_KEY = "jarvis-v2-settings";
const SESSION_KEY = "jarvis-v2-session";

let currentSessionId = localStorage.getItem(SESSION_KEY) || null;
let currentMode = "standard";
let audioContext = null;

const historyState = { entries: [], index: -1, draft: "" };

const defaultSettings = {
  uiSound: false,
  autoOpenAmazonLinks: false,
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
  settingsAmazon.checked = uiSettings.autoOpenAmazonLinks;
  settingsUrl.checked = uiSettings.autoOpenUrlLinks;
}

/* ── Markdown renderer ─────────────────────────────── */
function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Code blocks: ```lang\ncode\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const tag = lang ? `<span class="code-lang-tag">${lang}</span>` : "";
    return `<pre>${tag}<code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Line breaks (outside of pre blocks)
  html = html.replace(/\n/g, "<br>");

  // Clean up extra <br> in pre blocks
  html = html.replace(/<pre>([\s\S]*?)<\/pre>/g, (match) => {
    return match.replace(/<br>/g, "\n");
  });

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

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── Messages ──────────────────────────────────────── */
function addMessage(role, content, options = {}) {
  const entry = document.createElement("article");
  const cssRole = role === "system" ? "system-msg" : role;
  entry.className = `message ${cssRole}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "DU" : role === "system" ? "SYSTEM" : "JARVIS";

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
  body.innerHTML = '<p>Denkt nach</p><span class="thinking-dots"><span></span><span></span><span></span></span>';

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
  commandMode.textContent = busy ? "PROCESSING" : "BEREIT";
  commandMode.classList.toggle("is-busy", busy);
}

function setMode(mode) {
  currentMode = mode;
  modeChip.textContent = { standard: "Standard", dev: "Entwickler", business: "Business", hacker: "Hacker" }[mode] || mode;
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
    renderSessionList(data.sessions || []);
  } catch { /* ignore */ }
}

function renderSessionList(sessions) {
  chatList.replaceChildren();
  if (!sessions.length) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "Noch keine Chats.";
    chatList.appendChild(hint);
    return;
  }

  sessions.forEach((s) => {
    const item = document.createElement("div");
    item.className = `chat-item${s.id === currentSessionId ? " active" : ""}`;
    item.dataset.id = s.id;

    const title = document.createElement("span");
    title.className = "chat-item-title";
    title.textContent = s.title;

    const del = document.createElement("button");
    del.className = "chat-item-delete";
    del.textContent = "\u2715";
    del.title = "Chat loeschen";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
      if (s.id === currentSessionId) {
        currentSessionId = null;
        localStorage.removeItem(SESSION_KEY);
        chatLog.replaceChildren();
      }
      loadSessionList();
    });

    item.appendChild(title);
    item.appendChild(del);
    item.addEventListener("click", () => switchSession(s.id));
    chatList.appendChild(item);
  });
}

async function switchSession(sessionId) {
  if (sessionId === currentSessionId) return;
  currentSessionId = sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
  chatLog.replaceChildren();

  try {
    const data = await fetchJson(`/api/sessions/${sessionId}/messages`);
    const messages = data.messages || [];
    messages.forEach((msg) => {
      if (msg.role === "system") return;
      addMessage(msg.role === "assistant" ? "jarvis" : msg.role, msg.content, { markdown: msg.role === "assistant" });
    });
  } catch { /* ignore */ }

  loadSessionList();
}

async function createNewSession() {
  currentSessionId = null;
  localStorage.removeItem(SESSION_KEY);
  chatLog.replaceChildren();
  addMessage("jarvis", "Neuer Chat gestartet. Schreib einfach los oder nutze `/help` fuer Befehle.", { markdown: true });
  renderQuickActions(getModeQuickActions());
  loadSessionList();
}

function getModeQuickActions() {
  const map = {
    standard: ["Status", "Wetter in Berlin", "Wie spaet ist es?", "Rechne 12*12"],
    dev: ["/search Node.js", "Erklaere async/await", "REST API generieren", "Code reviewen"],
    business: ["Geschaeftsidee analysieren", "SWOT Analyse", "Plan erstellen", "Marktanalyse"],
    hacker: ["Netzwerke erklaeren", "SQL Injection?", "Portscanner erklaeren", "HTTPS erklaeren"],
  };
  return map[currentMode] || map.standard;
}

/* ── Streaming chat ────────────────────────────────── */
async function submitMessage(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) return;

  rememberCommand(trimmed);
  addMessage("user", trimmed);
  setBusyState(true);

  const thinking = addThinkingIndicator();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        sessionId: currentSessionId,
        mode: currentMode,
      }),
    });

    // Remove thinking indicator
    thinking.remove();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamEl = null;
    let fullText = "";

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
        try {
          data = JSON.parse(line.slice(6));
        } catch { continue; }

        if (data.type === "session") {
          if (data.id && data.id !== currentSessionId) {
            currentSessionId = data.id;
            localStorage.setItem(SESSION_KEY, data.id);
          }
          if (data.mode) setMode(data.mode);
          continue;
        }

        if (data.type === "token") {
          if (!streamEl) {
            streamEl = addStreamingMessage();
          }
          fullText += data.content;
          // Render accumulated markdown
          streamEl.body.innerHTML = renderMarkdown(fullText);
          // Re-add cursor
          const cursor = document.createElement("span");
          cursor.className = "type-cursor";
          cursor.textContent = "|";
          streamEl.body.appendChild(cursor);
          scrollToBottom();
          continue;
        }

        if (data.type === "done") {
          if (streamEl) {
            streamEl.entry.classList.remove("streaming");
            // Final render without cursor
            streamEl.body.innerHTML = renderMarkdown(fullText);
            if (data.tokenCount) {
              const info = document.createElement("div");
              info.className = "token-info";
              info.textContent = `${data.tokenCount} tokens · ${data.duration || 0}ms · ${data.model || ""}`;
              streamEl.entry.appendChild(info);
            }
          }
          if (data.quickActions) renderQuickActions(data.quickActions);
          if (data.sessionId) {
            currentSessionId = data.sessionId;
            localStorage.setItem(SESSION_KEY, data.sessionId);
          }
          playUiBeep();
          loadSessionList();
          continue;
        }

        if (data.type === "command-result") {
          // Legacy command response
          const resp = data.response || {};
          const content = resp.content || data.reply || "";
          addMessage("jarvis", content, { markdown: true });
          if (data.quickActions) renderQuickActions(data.quickActions);
          if (data.status) updateStatus(data.status);
          playUiBeep();
          loadSessionList();
          continue;
        }

        if (data.type === "mode-changed") {
          setMode(data.mode);
          addMessage("system", data.message);
          if (data.quickActions) renderQuickActions(data.quickActions);
          loadSessionList();
          continue;
        }

        if (data.type === "clear") {
          chatLog.replaceChildren();
          addMessage("system", "Chat wurde geleert.");
          continue;
        }

        if (data.type === "error") {
          addMessage("jarvis", data.message || "Ein Fehler ist aufgetreten.");
          continue;
        }
      }
    }
  } catch (err) {
    thinking.remove();
    addMessage("jarvis", "Verbindungsfehler: " + err.message);
  } finally {
    setBusyState(false);
    commandInput.focus();
  }
}

/* ── Status updates ────────────────────────────────── */
const statusFields = {
  time: document.getElementById("status-time"),
  date: document.getElementById("status-date"),
  light: document.getElementById("status-light"),
  focus: document.getElementById("status-focus"),
  alarm: document.getElementById("status-alarm"),
  result: document.getElementById("status-result"),
  ai: document.getElementById("status-ai"),
};

function updateStatus(status) {
  if (statusFields.time) statusFields.time.textContent = status.time;
  if (statusFields.date) statusFields.date.textContent = status.date;
  if (statusFields.light) statusFields.light.textContent = status.lightsOn ? "An" : "Aus";
  if (statusFields.focus) statusFields.focus.textContent = status.focusMode ? "Aktiv" : "Ruhig";
  if (statusFields.alarm) statusFields.alarm.textContent = status.alarmArmed ? "Aktiv" : "Aus";
  if (statusFields.result) statusFields.result.textContent = status.lastResult ?? "--";

  if (status.ai && statusFields.ai) {
    statusFields.ai.textContent = status.ai.available ? status.ai.model : "Offline";
    aiDot.classList.toggle("offline", !status.ai.available);
  }
}

function tickClock() {
  const now = new Date();
  if (statusFields.time) {
    statusFields.time.textContent = now.toLocaleTimeString("de-DE", {
      timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }
  if (statusFields.date) {
    statusFields.date.textContent = now.toLocaleDateString("de-DE", {
      timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "short",
    });
  }
}

async function refreshStatus() {
  try {
    const data = await fetchJson("/api/status");
    if (data.status) updateStatus(data.status);
  } catch { /* ignore */ }
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
  const mode = btn.dataset.mode;
  setMode(mode);
  // Send mode change to server if we have a session
  if (currentSessionId) {
    submitMessage(`/mode ${mode}`);
  }
});

sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("is-open");
});

settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("is-open");
  settingsPanel.setAttribute("aria-hidden", String(!settingsPanel.classList.contains("is-open")));
});

settingsClose.addEventListener("click", () => {
  settingsPanel.classList.remove("is-open");
  settingsPanel.setAttribute("aria-hidden", "true");
});

settingsUiSound.addEventListener("change", () => { uiSettings.uiSound = settingsUiSound.checked; saveSettings(); });
settingsAmazon.addEventListener("change", () => { uiSettings.autoOpenAmazonLinks = settingsAmazon.checked; saveSettings(); });
settingsUrl.addEventListener("change", () => { uiSettings.autoOpenUrlLinks = settingsUrl.checked; saveSettings(); });

// Close sidebar on mobile when clicking outside
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
  setInterval(refreshStatus, 5000);

  await loadSessionList();
  await refreshStatus();

  // If we have a saved session, load its messages
  if (currentSessionId) {
    try {
      const data = await fetchJson(`/api/sessions/${currentSessionId}/messages`);
      const messages = data.messages || [];
      if (messages.length > 0) {
        messages.forEach((msg) => {
          if (msg.role === "system") return;
          addMessage(msg.role === "assistant" ? "jarvis" : msg.role, msg.content, { markdown: msg.role === "assistant" });
        });
      } else {
        addMessage("jarvis", "Jarvis v2 ist bereit. Schreib einfach los oder nutze `/help`.", { markdown: true });
      }
    } catch {
      addMessage("jarvis", "Jarvis v2 ist bereit. Schreib einfach los oder nutze `/help`.", { markdown: true });
    }
  } else {
    addMessage("jarvis", "Willkommen bei **Jarvis v2**. Schreib einfach los, wechsle den Modus in der Sidebar oder nutze `/help`.", { markdown: true });
  }

  renderQuickActions(getModeQuickActions());
  commandInput.focus();
}

bootstrap();
