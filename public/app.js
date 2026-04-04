const chatLog = document.getElementById("chat-log");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command-input");
const quickActions = document.getElementById("quick-actions");
const actionLinks = document.getElementById("action-links");
const highlight = document.getElementById("highlight");
const linksPanel = document.getElementById("links-panel");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const settingsAmazon = document.getElementById("setting-auto-open-amazon");
const settingsUrl = document.getElementById("setting-auto-open-url");
const settingsActionFeed = document.getElementById("setting-show-action-feed");

const SETTINGS_KEY = "jarvis-ui-settings";

const defaultSettings = {
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

function syncSettingsUi() {
  settingsAmazon.checked = uiSettings.autoOpenAmazonLinks;
  settingsUrl.checked = uiSettings.autoOpenUrlLinks;
  settingsActionFeed.checked = uiSettings.showActionFeed;
  linksPanel.hidden = !uiSettings.showActionFeed;
}

function setSettingsOpen(isOpen) {
  settingsPanel.classList.toggle("is-open", isOpen);
  settingsPanel.setAttribute("aria-hidden", String(!isOpen));
  settingsToggle.setAttribute("aria-expanded", String(isOpen));
}

function buildMessageActions(links) {
  if (!links.length) {
    return "";
  }

  return `
    <div class="message-actions">
      ${links
        .map(
          (link) => `<a class="message-action" href="${link.url}" target="_blank" rel="noreferrer noopener">${link.label}</a>`
        )
        .join("")}
    </div>
  `;
}

function addMessage(role, text, links = []) {
  const entry = document.createElement("article");
  entry.className = `message ${role}`;
  entry.innerHTML = `
    <span class="message-label">${role === "user" ? "Operator" : "Jarvis"}</span>
    <div class="message-body">${text}</div>
    ${buildMessageActions(links)}
  `;
  chatLog.appendChild(entry);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updateStatus(status) {
  statusFields.time.textContent = status.time;
  statusFields.date.textContent = status.date;
  statusFields.light.textContent = status.lightsOn ? "ONLINE" : "OFFLINE";
  statusFields.focus.textContent = status.focusMode ? "ENGAGED" : "STANDBY";
  statusFields.alarm.textContent = status.alarmArmed ? "ARMED" : "DISARMED";
  statusFields.note.textContent = status.lastNote;

  if (status.latestNotification && status.latestNotification !== latestNotification) {
    latestNotification = status.latestNotification;
    addMessage("jarvis", status.latestNotification);
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

function renderQuickActions(items) {
  quickActions.innerHTML = "";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item;
    button.addEventListener("click", () => submitCommand(item));
    quickActions.appendChild(button);
  });
}

function renderLinks(links) {
  actionLinks.innerHTML = "";

  if (!links.length) {
    actionLinks.innerHTML = '<p class="placeholder">Noch keine externen Aktionen erzeugt.</p>';
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
    throw new Error(data.detail || data.error || "Fehler bei der Anfrage.");
  }

  return data;
}

async function submitCommand(command) {
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return;
  }

  addMessage("user", trimmedCommand);

  try {
    const data = await fetchJson("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: trimmedCommand }),
    });

    addMessage("jarvis", data.reply, data.links);
    updateStatus(data.status);
    renderQuickActions(data.quickActions);
    renderLinks(data.links);
    highlight.textContent = data.highlight;

    if (shouldAutoOpenLinks(data)) {
      tryOpenLinks(data.links);
    }
  } catch (error) {
    addMessage("jarvis", `Fehler: ${error.message}`);
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
    addMessage("jarvis", "Jarvis online. Gib einen Befehl ein oder nutze die Quick Commands.");

    tickClock();
    setInterval(tickClock, 1000);
    setInterval(refreshStatus, 5000);
  } catch (error) {
    addMessage("jarvis", `Initialisierung fehlgeschlagen: ${error.message}`);
  }
}

bootstrap();