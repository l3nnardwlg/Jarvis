const chatLog = document.getElementById("chat-log");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command-input");
const quickActions = document.getElementById("quick-actions");
const actionLinks = document.getElementById("action-links");
const highlight = document.getElementById("highlight");

const statusFields = {
  time: document.getElementById("status-time"),
  date: document.getElementById("status-date"),
  light: document.getElementById("status-light"),
  focus: document.getElementById("status-focus"),
  alarm: document.getElementById("status-alarm"),
  note: document.getElementById("status-note"),
};

function addMessage(role, text) {
  const entry = document.createElement("article");
  entry.className = `message ${role}`;
  entry.innerHTML = `
    <span class="message-label">${role === "user" ? "Operator" : "Jarvis"}</span>
    <div>${text}</div>
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

    addMessage("jarvis", data.reply);
    updateStatus(data.status);
    renderQuickActions(data.quickActions);
    renderLinks(data.links);
    highlight.textContent = data.highlight;
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

async function bootstrap() {
  try {
    const data = await fetchJson("/api/status");
    updateStatus(data.status);
    renderQuickActions(data.quickActions);
    renderLinks(data.links);
    highlight.textContent = data.highlight;
    addMessage("jarvis", "Jarvis online. Gib einen Befehl ein oder nutze die Quick Commands.");

    tickClock();
    setInterval(tickClock, 1000);
  } catch (error) {
    addMessage("jarvis", `Initialisierung fehlgeschlagen: ${error.message}`);
  }
}

bootstrap();