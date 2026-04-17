const config = require('../core/config');
const { logger } = require('../core/logger');

const log = logger.child('ai:context');

const MODES = {
  standard: {
    name: 'Standard',
    systemPrompt: `You are Jarvis, an advanced AI assistant. You are helpful, precise, and capable.
You have access to tools, memory, and can perform tasks autonomously.
Be concise but thorough. Use a professional yet friendly tone.
If you don't know something, say so honestly.`,
  },
  dev: {
    name: 'Developer',
    systemPrompt: `You are Jarvis in Developer Mode. You are a senior software engineer assistant.
Focus on code quality, best practices, and technical accuracy.
Provide code examples when relevant. Be direct and technical.
Reference documentation and standards when applicable.`,
  },
  creative: {
    name: 'Creative',
    systemPrompt: `You are Jarvis in Creative Mode. You are imaginative and expressive.
Help with writing, brainstorming, design ideas, and creative problem-solving.
Think outside the box while remaining practical and actionable.`,
  },
  analyst: {
    name: 'Analyst',
    systemPrompt: `You are Jarvis in Analyst Mode. You are precise, data-driven, and methodical.
Break down complex problems systematically. Provide structured analysis.
Use numbers, comparisons, and evidence-based reasoning.`,
  },
};

class ContextManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(sessionId, mode = 'standard') {
    const session = {
      id: sessionId,
      mode,
      messages: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
      metadata: {},
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getOrCreateSession(sessionId, mode = 'standard') {
    return this.sessions.get(sessionId) || this.createSession(sessionId, mode);
  }

  addMessage(sessionId, role, content) {
    const session = this.getOrCreateSession(sessionId);
    session.messages.push({ role, content, timestamp: Date.now() });
    session.lastActive = Date.now();

    if (session.messages.length > config.memory.shortTermMaxItems) {
      session.messages = session.messages.slice(-config.memory.shortTermMaxItems);
    }
    return session;
  }

  buildMessages(sessionId, userMessage, options = {}) {
    const session = this.getOrCreateSession(sessionId);
    const mode = MODES[session.mode] || MODES.standard;

    const messages = [{ role: 'system', content: mode.systemPrompt }];

    if (options.memoryContext) {
      messages.push({
        role: 'system',
        content: `Relevant memory context:\n${options.memoryContext}`,
      });
    }

    const recentMessages = session.messages.slice(-20);
    messages.push(...recentMessages);
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  setMode(sessionId, mode) {
    const session = this.getOrCreateSession(sessionId);
    if (MODES[mode]) {
      session.mode = mode;
      return true;
    }
    return false;
  }

  listModes() {
    return Object.entries(MODES).map(([key, val]) => ({ key, name: val.name }));
  }

  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  listSessions() {
    return [...this.sessions.values()].map(s => ({
      id: s.id,
      mode: s.mode,
      messageCount: s.messages.length,
      lastActive: s.lastActive,
    }));
  }

  cleanupStaleSessions(maxAgeMs = 3600000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, session] of this.sessions) {
      if (session.lastActive < cutoff) this.sessions.delete(id);
    }
  }
}

module.exports = { ContextManager, MODES };
