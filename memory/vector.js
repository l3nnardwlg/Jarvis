const { logger } = require('../core/logger');

const log = logger.child('memory:vector');

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function textToVector(text, dim = 384) {
  const vector = new Float32Array(dim);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const hash = simpleHash(word);
    const idx = Math.abs(hash) % dim;
    vector[idx] += 1;

    if (i > 0) {
      const bigramHash = simpleHash(words[i - 1] + ' ' + word);
      vector[Math.abs(bigramHash) % dim] += 0.5;
    }
  }

  let mag = 0;
  for (let i = 0; i < dim; i++) mag += vector[i] * vector[i];
  mag = Math.sqrt(mag);
  if (mag > 0) {
    for (let i = 0; i < dim; i++) vector[i] /= mag;
  }

  return Array.from(vector);
}

class VectorStore {
  constructor() {
    this.entries = [];
    this.useAI = false;
    this._aiRouter = null;
  }

  setAIRouter(router) {
    this._aiRouter = router;
    this.useAI = true;
  }

  async embed(text) {
    if (this.useAI && this._aiRouter) {
      try {
        return await this._aiRouter.embeddings(text);
      } catch (err) {
        log.debug('AI embeddings failed, using local', { error: err.message });
      }
    }
    return textToVector(text);
  }

  async add(id, text, metadata = {}) {
    const vector = await this.embed(text);
    const existing = this.entries.findIndex(e => e.id === id);
    const entry = { id, text, vector, metadata, createdAt: Date.now() };
    if (existing >= 0) {
      this.entries[existing] = entry;
    } else {
      this.entries.push(entry);
    }
    return entry;
  }

  async search(query, topK = 5, minScore = 0.1) {
    if (this.entries.length === 0) return [];
    const queryVector = await this.embed(query);

    const scored = this.entries.map(entry => ({
      ...entry,
      score: cosineSimilarity(queryVector, entry.vector),
    }));

    return scored
      .filter(e => e.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ vector, ...rest }) => rest);
  }

  remove(id) {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx >= 0) { this.entries.splice(idx, 1); return true; }
    return false;
  }

  clear() {
    this.entries = [];
  }

  size() {
    return this.entries.length;
  }

  export() {
    return this.entries.map(({ vector, ...rest }) => rest);
  }

  import(entries) {
    this.entries = entries.map(e => ({
      ...e,
      vector: e.vector || textToVector(e.text),
    }));
  }
}

module.exports = { VectorStore, cosineSimilarity, textToVector };
