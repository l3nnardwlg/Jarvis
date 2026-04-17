const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { logger } = require('../core/logger');
const { VectorStore } = require('./vector');

const log = logger.child('memory');

class MemorySystem {
  constructor() {
    this.shortTerm = new Map();
    this.longTerm = { facts: [], conversations: [], preferences: {}, notes: [] };
    this.vectorStore = new VectorStore();
    this._dirty = false;
  }

  async init(engine) {
    this.engine = engine;
    this._loadLongTerm();

    const aiRouter = engine.get('ai');
    if (aiRouter) {
      this.vectorStore.setAIRouter(aiRouter);
    }

    this._loadVectorStore();
    log.info(`Memory initialized: ${this.longTerm.facts.length} facts, ${this.vectorStore.size()} vectors`);
  }

  _loadLongTerm() {
    try {
      if (fs.existsSync(config.memory.longTermFile)) {
        const data = JSON.parse(fs.readFileSync(config.memory.longTermFile, 'utf8'));
        this.longTerm = { ...this.longTerm, ...data };
      }
    } catch (err) {
      log.error('Failed to load long-term memory', { error: err.message });
    }
  }

  _saveLongTerm() {
    try {
      const dir = path.dirname(config.memory.longTermFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(config.memory.longTermFile, JSON.stringify(this.longTerm, null, 2));
    } catch (err) {
      log.error('Failed to save long-term memory', { error: err.message });
    }
  }

  _loadVectorStore() {
    try {
      if (fs.existsSync(config.memory.vectorFile)) {
        const data = JSON.parse(fs.readFileSync(config.memory.vectorFile, 'utf8'));
        this.vectorStore.import(data);
      }
    } catch (err) {
      log.error('Failed to load vector store', { error: err.message });
    }
  }

  _saveVectorStore() {
    try {
      const dir = path.dirname(config.memory.vectorFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = this.vectorStore.entries.map(e => ({
        id: e.id, text: e.text, vector: e.vector, metadata: e.metadata, createdAt: e.createdAt,
      }));
      fs.writeFileSync(config.memory.vectorFile, JSON.stringify(data));
    } catch (err) {
      log.error('Failed to save vector store', { error: err.message });
    }
  }

  // --- Short-term (session) memory ---

  remember(sessionId, key, value) {
    if (!this.shortTerm.has(sessionId)) this.shortTerm.set(sessionId, new Map());
    this.shortTerm.get(sessionId).set(key, { value, timestamp: Date.now() });
  }

  recall(sessionId, key) {
    const session = this.shortTerm.get(sessionId);
    if (!session) return null;
    return session.get(key)?.value ?? null;
  }

  forgetSession(sessionId) {
    this.shortTerm.delete(sessionId);
  }

  // --- Long-term memory ---

  async storeFact(content, metadata = {}) {
    const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fact = { id, content, metadata, createdAt: Date.now() };
    this.longTerm.facts.push(fact);
    await this.vectorStore.add(id, content, { type: 'fact', ...metadata });
    this._saveLongTerm();
    this._saveVectorStore();
    return fact;
  }

  async storeNote(title, content, tags = []) {
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const note = { id, title, content, tags, createdAt: Date.now(), updatedAt: Date.now() };
    this.longTerm.notes.push(note);
    await this.vectorStore.add(id, `${title} ${content}`, { type: 'note', tags });
    this._saveLongTerm();
    this._saveVectorStore();
    return note;
  }

  async storeConversationSummary(sessionId, summary) {
    const id = `conv_${Date.now()}`;
    const entry = { id, sessionId, summary, createdAt: Date.now() };
    this.longTerm.conversations.push(entry);
    if (this.longTerm.conversations.length > 200) {
      this.longTerm.conversations = this.longTerm.conversations.slice(-200);
    }
    await this.vectorStore.add(id, summary, { type: 'conversation', sessionId });
    this._saveLongTerm();
    this._saveVectorStore();
    return entry;
  }

  setPreference(key, value) {
    this.longTerm.preferences[key] = value;
    this._saveLongTerm();
  }

  getPreference(key, defaultValue = null) {
    return this.longTerm.preferences[key] ?? defaultValue;
  }

  // --- Recall / Search ---

  async searchMemory(query, topK = 5) {
    return this.vectorStore.search(query, topK);
  }

  async getRelevantContext(query, maxItems = 3) {
    const results = await this.vectorStore.search(query, maxItems, 0.2);
    if (results.length === 0) return '';
    return results.map(r => `[${r.metadata?.type || 'memory'}] ${r.text}`).join('\n');
  }

  getFacts(limit = 20) {
    return this.longTerm.facts.slice(-limit);
  }

  getNotes(limit = 20) {
    return this.longTerm.notes.slice(-limit);
  }

  deleteFact(id) {
    this.longTerm.facts = this.longTerm.facts.filter(f => f.id !== id);
    this.vectorStore.remove(id);
    this._saveLongTerm();
    this._saveVectorStore();
  }

  deleteNote(id) {
    this.longTerm.notes = this.longTerm.notes.filter(n => n.id !== id);
    this.vectorStore.remove(id);
    this._saveLongTerm();
    this._saveVectorStore();
  }

  status() {
    return {
      shortTermSessions: this.shortTerm.size,
      facts: this.longTerm.facts.length,
      notes: this.longTerm.notes.length,
      conversations: this.longTerm.conversations.length,
      vectorEntries: this.vectorStore.size(),
    };
  }

  shutdown() {
    this._saveLongTerm();
    this._saveVectorStore();
  }
}

module.exports = { MemorySystem };
