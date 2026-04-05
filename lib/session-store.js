const crypto = require("crypto");

const MAX_SESSIONS = 100;
const MAX_MESSAGES = 50;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const sessions = new Map();

function createSession(mode = "standard") {
  if (sessions.size >= MAX_SESSIONS) {
    cleanupStaleSessions();
    if (sessions.size >= MAX_SESSIONS) {
      const oldest = [...sessions.values()].sort(
        (a, b) => new Date(a.lastActivityAt) - new Date(b.lastActivityAt)
      )[0];
      if (oldest) sessions.delete(oldest.id);
    }
  }

  const session = {
    id: crypto.randomUUID(),
    title: "Neuer Chat",
    mode,
    messages: [],
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id) || null;
}

function listSessions() {
  return [...sessions.values()]
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
    .map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }));
}

function deleteSession(id) {
  return sessions.delete(id);
}

function addMessage(sessionId, role, content) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.messages.push({ role, content });
  session.lastActivityAt = new Date().toISOString();

  if (role === "user" && session.title === "Neuer Chat") {
    session.title = content.length > 60 ? content.slice(0, 57) + "..." : content;
  }

  if (session.messages.length > MAX_MESSAGES) {
    const systemMessages = session.messages.filter((m) => m.role === "system");
    const nonSystemMessages = session.messages.filter((m) => m.role !== "system");
    session.messages = [...systemMessages, ...nonSystemMessages.slice(-(MAX_MESSAGES - systemMessages.length))];
  }

  return session;
}

function setMode(sessionId, mode) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.mode = mode;
  session.lastActivityAt = new Date().toISOString();
  return session;
}

function getMessageHistory(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.messages;
}

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - new Date(session.lastActivityAt).getTime() > STALE_THRESHOLD_MS) {
      sessions.delete(id);
    }
  }
}

module.exports = {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  addMessage,
  setMode,
  getMessageHistory,
  cleanupStaleSessions,
};
