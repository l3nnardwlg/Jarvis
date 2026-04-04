const fs = require("fs");
const path = require("path");

const defaultMemory = {
  notes: [],
  profile: {
    username: null,
  },
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
  };
}

module.exports = {
  createMemoryStore,
};
