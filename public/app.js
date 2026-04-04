const chatLog = document.getElementById("chat-log");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command-input");
const submitButton = commandForm.querySelector('button[type="submit"]');
const quickActions = document.getElementById("quick-actions");
const actionLinks = document.getElementById("action-links");
const highlight = document.getElementById("highlight");
const linksPanel = document.getElementById("links-panel");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const settingsDarkMode = document.getElementById("setting-dark-mode");
const settingsAmazon = document.getElementById("setting-auto-open-amazon");
const settingsUrl = document.getElementById("setting-auto-open-url");
const settingsActionFeed = document.getElementById("setting-show-action-feed");

const SETTINGS_KEY = "jarvis-ui-settings";

const defaultSettings = {
  darkMode: true,
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

let latestNotification = null;
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

function createResponseBody(response) {
  const wrapper = document.createElement("div");
  wrapper.className = `message-body message-body-${response.type}`;

  if (response.content) {
    const paragraph = document.createElement("p");
    paragraph.textContent = response.content;
    wrapper.appendChild(paragraph);
  }

  if (response.type === "list" && response.items.length) {
    const list = document.createElement("ul");
    list.className = "message-list";

    response.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.appendChild(listItem);
    });

    wrapper.appendChild(list);
  }

  return wrapper;
}

function addMessage(role, payload, links = []) {
  const response = normalizeResponsePayload(payload);
  const entry = document.createElement("article");
  entry.className = `message ${role} message-type-${response.type}${response.type === "error" ? " error" : ""}`;

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "Operator" : "Jarvis";

  entry.appendChild(label);
  entry.appendChild(createResponseBody(response));

  const actions = createMessageActions(links);
  if (actions) {
    entry.appendChild(actions);
  }

  chatLog.appendChild(entry);
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

  const text = document.createElement("p");
  text.textContent = "Jarvis denkt";

  const dots = document.createElement("span");
  dots.className = "thinking-dots";
  dots.setAttribute("aria-hidden", "true");
  dots.innerHTML = "<span></span><span></span><span></span>";

  body.appendChild(text);
  body.appendChild(dots);
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
    addMessage("jarvis", { type: "text", content: status.latestNotification });
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
  submitButton.textContent = isBusy ? "WAIT" : "EXECUTE";
}

async function submitCommand(command) {
  const trimmedCommand = String(command || "").trim();
  if (!trimmedCommand) {
    return;
  }

  addMessage("user", trimmedCommand);
  setBusyState(true);

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

    addMessage("jarvis", data.response || data.reply, data.links);
    updateStatus(data.status);
    renderQuickActions(data.quickActions);
    renderLinks(data.links);
    highlight.textContent = data.highlight;

    if (shouldAutoOpenLinks(data)) {
      tryOpenLinks(data.links);
    }
  } catch (error) {
    console.error(error);
    addMessage("jarvis", {
      type: "error",
      content: "Das hat gerade nicht geklappt. Versuch es bitte noch einmal anders.",
    });
  } finally {
    window.clearTimeout(thinkingTimeout);
    removeElement(thinkingIndicator);
    setBusyState(false);
    commandInput.focus();
  }
}

commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const command = commandInput.value;
  commandInput.value = "";
  await submitCommand(command);
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
    addMessage("jarvis", data.response || "Jarvis online. Gib einen Befehl ein oder nutze die Quick Commands.");

    tickClock();
    setInterval(tickClock, 1000);
    setInterval(refreshStatus, 5000);
    commandInput.focus();
  } catch (error) {
    console.error(error);
    addMessage("jarvis", {
      type: "error",
      content: "Die Oberfläche konnte nicht vollständig starten. Lade die Seite bitte neu.",
    });
  }
}

bootstrap();