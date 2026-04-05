const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const defaultMemory = {
  notes: [],
  profile: {
    username: null,
    preferredMode: "standard",
  },
  context: {
    lastResult: null,
    lastCommand: null,
  },
  projects: [],
  preferences: {
    defaultMode: "standard",
    searxngEnabled: false,
    autoWebSearch: false,
  },
  history: [],
};

function ensureMemoryFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultMemory, null, 2));
  }
}

function readMemory(filePath) {
  ensureMemoryFile(filePath);

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    return {
      ...defaultMemory,
      ...parsed,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      profile: {
        ...defaultMemory.profile,
        ...(parsed.profile || {}),
      },
      context: {
        ...defaultMemory.context,
        ...(parsed.context || {}),
      },
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      preferences: {
        ...defaultMemory.preferences,
        ...(parsed.preferences || {}),
      },
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...defaultMemory };
  }
}

function writeMemory(filePath, memory) {
  fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
}

function createMemoryStore(filePath) {
  ensureMemoryFile(filePath);

  return {
    getSnapshot() {
      return readMemory(filePath);
    },
    addNote(note) {
      const snapshot = readMemory(filePath);
      snapshot.notes.unshift(note);
      snapshot.notes = snapshot.notes.slice(0, 20);
      writeMemory(filePath, snapshot);
      return snapshot;
    },
    listNotes() {
      return readMemory(filePath).notes;
    },
    setUsername(username) {
      const snapshot = readMemory(filePath);
      snapshot.profile.username = username;
      writeMemory(filePath, snapshot);
      return snapshot;
    },
    setContext(contextPatch) {
      const snapshot = readMemory(filePath);
      snapshot.context = {
        ...snapshot.context,
        ...contextPatch,
      };
      writeMemory(filePath, snapshot);
      return snapshot;
    },
    // ── v2: Projects ──
    addProject(name, description = "") {
      const snapshot = readMemory(filePath);
      const project = {
        id: crypto.randomUUID(),
        name,
        description,
        createdAt: new Date().toISOString(),
        tags: [],
      };
      snapshot.projects.unshift(project);
      snapshot.projects = snapshot.projects.slice(0, 50);
      writeMemory(filePath, snapshot);
      return project;
    },
    listProjects() {
      return readMemory(filePath).projects;
    },
    getProject(id) {
      return readMemory(filePath).projects.find((p) => p.id === id) || null;
    },
    removeProject(id) {
      const snapshot = readMemory(filePath);
      snapshot.projects = snapshot.projects.filter((p) => p.id !== id);
      writeMemory(filePath, snapshot);
      return snapshot;
    },
    // ── v2: Preferences ──
    setPreference(key, value) {
      const snapshot = readMemory(filePath);
      snapshot.preferences[key] = value;
      writeMemory(filePath, snapshot);
      return snapshot.preferences;
    },
    getPreferences() {
      return readMemory(filePath).preferences;
    },
    // ── v2: History summaries ──
    addHistorySummary(summary) {
      const snapshot = readMemory(filePath);
      snapshot.history.unshift({
        text: summary,
        createdAt: new Date().toISOString(),
      });
      snapshot.history = snapshot.history.slice(0, 200);
      writeMemory(filePath, snapshot);
      return snapshot;
    },
    searchHistory(query) {
      const tokens = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) return [];
      const history = readMemory(filePath).history;
      return history.filter((entry) => {
        const text = entry.text.toLowerCase();
        return tokens.some((t) => text.includes(t));
      }).slice(0, 10);
    },
  };
}

module.exports = {
  createMemoryStore,
};
