const fs = require("fs");
const path = require("path");

const defaultLog = {
  entries: [],
};

function ensureLogFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultLog, null, 2));
  }
}

function readLog(filePath) {
  ensureLogFile(filePath);

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    return {
      ...defaultLog,
      ...parsed,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { ...defaultLog };
  }
}

function writeLog(filePath, log) {
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
}

function createLogStore(filePath) {
  ensureLogFile(filePath);

  return {
    addEntry(entry) {
      const snapshot = readLog(filePath);
      snapshot.entries.unshift({
        timestamp: new Date().toISOString(),
        ...entry,
      });
      snapshot.entries = snapshot.entries.slice(0, 50);
      writeLog(filePath, snapshot);
      return snapshot;
    },
    getEntries() {
      return readLog(filePath).entries;
    },
  };
}

module.exports = {
  createLogStore,
};