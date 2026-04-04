const chatLog = document.getElementById("chat-log");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command-input");
const submitButton = commandForm.querySelector('button[type="submit"]');
const quickActions = document.getElementById("quick-actions");
const actionLinks = document.getElementById("action-links");
const highlight = document.getElementById("highlight");
const commandMode = document.getElementById("command-mode");
const linksPanel = document.getElementById("links-panel");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const settingsDarkMode = document.getElementById("setting-dark-mode");
const settingsUiSound = document.getElementById("setting-ui-sound");
const settingsAmazon = document.getElementById("setting-auto-open-amazon");
const settingsUrl = document.getElementById("setting-auto-open-url");
const settingsActionFeed = document.getElementById("setting-show-action-feed");

const SETTINGS_KEY = "jarvis-ui-settings";

const defaultSettings = {
  darkMode: true,
  uiSound: false,
  autoOpenAmazonLinks: false,
  autoOpenUrlLinks: true,
  showActionFeed: true,
};

const statusFields = {
  time: document.getElementById("status-time"),
  date: document.getElementById("status-date"),
  light: document.getElementById("status-light"),
  focus: document.getElementById("status-focus"),
  alarm: document.getElementById("status-alarm"),
  note: document.getElementById("status-note"),
  result: document.getElementById("status-result"),
};

const moduleElements = {
  time: document.getElementById("module-time"),
  calc: document.getElementById("module-calc"),
  amazon: document.getElementById("module-amazon"),
  core: document.getElementById("module-core"),
};

const historyState = {
  entries: [],
  index: -1,
  draft: "",
};

let latestNotification = null;
let audioContext = null;
let uiSettings = loadSettings();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return { ...defaultSettings, ...saved };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(uiSettings));
}

function applyTheme() {
  document.body.dataset.theme = uiSettings.darkMode ? "dark" : "light";
}

function syncSettingsUi() {
  settingsDarkMode.checked = uiSettings.darkMode;
  settingsUiSound.checked = uiSettings.uiSound;
  settingsAmazon.checked = uiSettings.autoOpenAmazonLinks;
  settingsUrl.checked = uiSettings.autoOpenUrlLinks;
  settingsActionFeed.checked = uiSettings.showActionFeed;
  linksPanel.hidden = !uiSettings.showActionFeed;
  applyTheme();
}

function setSettingsOpen(isOpen) {
  settingsPanel.classList.toggle("is-open", isOpen);
  settingsPanel.setAttribute("aria-hidden", String(!isOpen));
  settingsToggle.setAttribute("aria-expanded", String(isOpen));
}

function normalizeResponsePayload(payload) {
  if (typeof payload === "string") {
    return { type: "text", content: payload, items: [] };
  }

  return {
    type: payload?.type || "text",
    content: payload?.content || "",
    items: Array.isArray(payload?.items) ? payload.items : [],
  };
}

function scrollChatToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function createMessageActions(links) {
  if (!Array.isArray(links) || !links.length) {
    return null;
  }

  const actions = document.createElement("div");
  actions.className = "message-actions";

  links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.className = "message-action";
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
    anchor.textContent = link.label;
    actions.appendChild(anchor);
  });

  return actions;
}

function createCursor() {
  const cursor = document.createElement("span");
  cursor.className = "type-cursor";
  cursor.textContent = "|";
  cursor.setAttribute("aria-hidden", "true");
  return cursor;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function typeIntoElement(element, text, speed = 10) {
  const cursor = createCursor();
  element.appendChild(cursor);

  for (const character of text) {
    cursor.before(character);
    scrollChatToBottom();
    await wait(speed);
  }

  cursor.remove();
}

async function renderResponseContent(wrapper, response, shouldType) {
  if (response.content) {
    const paragraph = document.createElement("p");
    wrapper.appendChild(paragraph);

    if (shouldType) {
      await typeIntoElement(paragraph, response.content, response.type === "error" ? 12 : 9);
    } else {
      paragraph.textContent = response.content;
    }
  }

  if (response.type === "list" && response.items.length) {
    const list = document.createElement("ul");
    list.className = "message-list";
    wrapper.appendChild(list);

    for (const item of response.items) {
      const listItem = document.createElement("li");
      list.appendChild(listItem);

      if (shouldType) {
        await typeIntoElement(listItem, item, 6);
        await wait(30);
      } else {
        listItem.textContent = item;
      }
    }
  }
}

async function addMessage(role, payload, links = [], options = {}) {
  const response = normalizeResponsePayload(payload);
  const entry = document.createElement("article");
  entry.className = `message ${role} message-type-${response.type}${response.type === "error" ? " error" : ""}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "Du" : "Jarvis";

  const body = document.createElement("div");
  body.className = `message-body message-body-${response.type}`;

  entry.appendChild(label);
  entry.appendChild(body);
  chatLog.appendChild(entry);
  scrollChatToBottom();

  await renderResponseContent(body, response, Boolean(options.typewriter && role === "jarvis"));

  const actions = createMessageActions(links);
  if (actions) {
    entry.appendChild(actions);
  }

  scrollChatToBottom();
  return entry;
}

function addThinkingIndicator() {
  const entry = document.createElement("article");
  entry.className = "message jarvis thinking";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = "Jarvis";

  const body = document.createElement("div");
  body.className = "message-body message-body-thinking";
  body.innerHTML = '<p>Verarbeitung laeuft</p><span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>';

  entry.appendChild(label);
  entry.appendChild(body);
  chatLog.appendChild(entry);
  scrollChatToBottom();
  return entry;
}

function removeElement(element) {
  if (element?.parentNode) {
    element.parentNode.removeChild(element);
  }
}

function setModeLabel(mode, isBusy = false) {
  commandMode.textContent = mode;
  commandMode.classList.toggle("is-busy", isBusy);
}

function markModuleState(moduleName, state) {
  Object.values(moduleElements).forEach((element) => {
    element.classList.remove("is-active", "is-error", "is-pulse");
    element.classList.add("is-active");
  });

  const moduleElement = moduleElements[moduleName] || moduleElements.core;

  if (state === "error") {
    moduleElement.classList.remove("is-active");
    moduleElement.classList.add("is-error", "is-pulse");
    return;
  }

  moduleElement.classList.add("is-pulse");
}

function detectModuleName(command, data) {
  const value = String(command || "").toLowerCase();

  if (/(zeit|uhr|datum|tag)/.test(value)) {
    return "time";
  }

  if (/(rechne|berechne|was ist|mal\s+\d|plus\s+\d|minus\s+\d|durch\s+\d|geteilt)/.test(value)) {
    return "calc";
  }

  if ((data?.linkType || "") === "amazon" || /(amazon|such|suche|bestell|kauf)/.test(value)) {
    return "amazon";
  }

  return "core";
}

function updateStatus(status) {
  statusFields.time.textContent = status.time;
  statusFields.date.textContent = status.date;
  statusFields.light.textContent = status.lightsOn ? "ONLINE" : "OFFLINE";
  statusFields.focus.textContent = status.focusMode ? "ENGAGED" : "STANDBY";
  statusFields.alarm.textContent = status.alarmArmed ? "ARMED" : "DISARMED";
  statusFields.note.textContent = status.lastNote;
  statusFields.result.textContent = status.lastResult ?? "--";

  if (status.latestNotification && status.latestNotification !== latestNotification) {
    latestNotification = status.latestNotification;
    void addMessage("jarvis", { type: "text", content: status.latestNotification }, [], { typewriter: true });
  }
}

function tryOpenLinks(links) {
  links.forEach((link) => {
    window.open(link.url, "_blank", "noopener,noreferrer");
  });
}

function shouldAutoOpenLinks(data) {
  if (!data.links.length) {
    return false;
  }

  if (data.linkType === "amazon") {
    return uiSettings.autoOpenAmazonLinks;
  }

  if (data.linkType === "url") {
    return uiSettings.autoOpenUrlLinks && data.autoOpenLinks;
  }

  return data.autoOpenLinks;
}

function renderQuickActions(items = []) {
  quickActions.replaceChildren();

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item;
    button.addEventListener("click", () => submitCommand(item));
    quickActions.appendChild(button);
  });
}

function renderLinks(links = []) {
  actionLinks.replaceChildren();

  if (!links.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder";
    placeholder.textContent = "Noch keine externen Aktionen erzeugt.";
    actionLinks.appendChild(placeholder);
    return;
  }

  links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
    anchor.textContent = link.label;
    actionLinks.appendChild(anchor);
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.response?.content || data.error || "Fehler bei der Anfrage.");
  }

  return data;
}

function setBusyState(isBusy) {
  commandInput.disabled = isBusy;
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "LAEUFT" : "SENDEN";
  setModeLabel(isBusy ? "AKTIV" : "BEREIT", isBusy);
}

function rememberCommand(command) {
  if (!command || historyState.entries[historyState.entries.length - 1] === command) {
    historyState.index = historyState.entries.length;
    return;
  }

  historyState.entries.push(command);
  historyState.entries = historyState.entries.slice(-30);
  historyState.index = historyState.entries.length;
}

function handleHistoryNavigation(direction) {
  if (!historyState.entries.length) {
    return;
  }

  if (historyState.index === historyState.entries.length) {
    historyState.draft = commandInput.value;
  }

  historyState.index = Math.max(0, Math.min(historyState.entries.length, historyState.index + direction));

  if (historyState.index === historyState.entries.length) {
    commandInput.value = historyState.draft;
    return;
  }

  commandInput.value = historyState.entries[historyState.index];
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playUiBeep() {
  if (!uiSettings.uiSound || !window.AudioContext) {
    return;
  }

  try {
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.09);

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.13);
  } catch {
    // Audio ist optional und darf das UI nicht stoeren.
  }
}

async function submitCommand(command) {
  const trimmedCommand = String(command || "").trim();
  if (!trimmedCommand) {
    return;
  }

  rememberCommand(trimmedCommand);
  await addMessage("user", trimmedCommand);
  setBusyState(true);
  markModuleState(detectModuleName(trimmedCommand), "active");

  let thinkingIndicator = null;
  const thinkingDelay = 300 + Math.floor(Math.random() * 501);
  const thinkingTimeout = window.setTimeout(() => {
    thinkingIndicator = addThinkingIndicator();
  }, thinkingDelay);

  try {
    const data = await fetchJson("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: trimmedCommand }),
    });

    window.clearTimeout(thinkingTimeout);
    removeElement(thinkingIndicator);
    highlight.textContent = data.highlight;
    updateStatus(data.status);
    renderQuickActions(data.quickActions);
    renderLinks(data.links);
    markModuleState(detectModuleName(trimmedCommand, data), data.response?.type === "error" ? "error" : "active");
    await addMessage("jarvis", data.response || data.reply, data.links, { typewriter: true });
    playUiBeep();

    if (shouldAutoOpenLinks(data)) {
      tryOpenLinks(data.links);
    }
  } catch (error) {
    console.error(error);
    window.clearTimeout(thinkingTimeout);
    removeElement(thinkingIndicator);
    highlight.textContent = "Eingabe konnte nicht verarbeitet werden";
    markModuleState(detectModuleName(trimmedCommand), "error");
    await addMessage("jarvis", {
      type: "error",
      content: "Das hat gerade nicht geklappt. Versuch es bitte noch einmal anders.",
    }, [], { typewriter: true });
  } finally {
    setBusyState(false);
    historyState.index = historyState.entries.length;
    commandInput.focus();
  }
}

commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const command = commandInput.value;
  commandInput.value = "";
  await submitCommand(command);
});

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    handleHistoryNavigation(-1);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    handleHistoryNavigation(1);
  }
});

settingsToggle.addEventListener("click", () => {
  setSettingsOpen(!settingsPanel.classList.contains("is-open"));
});

settingsClose.addEventListener("click", () => {
  setSettingsOpen(false);
});

settingsDarkMode.addEventListener("change", () => {
  uiSettings.darkMode = settingsDarkMode.checked;
  applyTheme();
  saveSettings();
});

settingsUiSound.addEventListener("change", () => {
  uiSettings.uiSound = settingsUiSound.checked;
  if (uiSettings.uiSound) {
    playUiBeep();
  }
  saveSettings();
});

settingsAmazon.addEventListener("change", () => {
  uiSettings.autoOpenAmazonLinks = settingsAmazon.checked;
  saveSettings();
});

settingsUrl.addEventListener("change", () => {
  uiSettings.autoOpenUrlLinks = settingsUrl.checked;
  saveSettings();
});

settingsActionFeed.addEventListener("change", () => {
  uiSettings.showActionFeed = settingsActionFeed.checked;
  syncSettingsUi();
  saveSettings();
});

function tickClock() {
  const now = new Date();
  statusFields.time.textContent = now.toLocaleTimeString("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  statusFields.date.textContent = now.toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function refreshStatus() {
  try {
    const data = await fetchJson("/api/status");
    updateStatus(data.status);
    highlight.textContent = data.highlight;
  } catch {
    // Status-Polling soll die UI nicht mit Fehlern fluten.
  }
}

async function bootstrap() {
  try {
    syncSettingsUi();
    const data = await fetchJson("/api/status");
    updateStatus(data.status);
    renderQuickActions(data.quickActions);
    renderLinks(data.links);
    highlight.textContent = data.highlight;
    setModeLabel("BEREIT");
    await addMessage("jarvis", data.response || "Jarvis online. Gib einen Befehl ein oder nutze die Quick Commands.", [], { typewriter: true });

    tickClock();
    setInterval(tickClock, 1000);
    setInterval(refreshStatus, 5000);
    commandInput.focus();
  } catch (error) {
    console.error(error);
    setModeLabel("FEHLER");
    await addMessage("jarvis", {
      type: "error",
      content: "Die Oberfläche konnte nicht vollständig starten. Lade die Seite bitte neu.",
    }, [], { typewriter: true });
  }
}

bootstrap();