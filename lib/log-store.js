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
      snapshot.entries = snapshot.entries.slice(0, 500);
      writeLog(filePath, snapshot);
      return snapshot;
    },
    getEntries(options = {}) {
      let entries = readLog(filePath).entries;
      if (options.type) {
        entries = entries.filter((e) => e.type === options.type);
      }
      if (options.sessionId) {
        entries = entries.filter((e) => e.sessionId === options.sessionId);
      }
      if (options.limit) {
        entries = entries.slice(0, options.limit);
      }
      return entries;
    },
    getStats() {
      const entries = readLog(filePath).entries;
      const total = entries.length;
      const byType = {};
      const byOutcome = {};
      let totalTokens = 0;
      let tokenEntries = 0;

      entries.forEach((e) => {
        const type = e.type || "command";
        byType[type] = (byType[type] || 0) + 1;

        if (e.outcome) {
          byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1;
        }

        if (e.tokenCount) {
          totalTokens += e.tokenCount;
          tokenEntries++;
        }
      });

      return {
        total,
        byType,
        byOutcome,
        totalTokens,
        averageTokens: tokenEntries > 0 ? Math.round(totalTokens / tokenEntries) : 0,
      };
    },
  };
}

module.exports = {
  createLogStore,
};