const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "..", "mds");

function listKnowledgeFiles() {
  if (!fs.existsSync(DOCS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DOCS_DIR)
    .filter((file) => file.toLowerCase().endsWith(".md"))
    .sort();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .replace(/[^a-z0-9äöüß\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function chunkMarkdown(content) {
  return String(content || "")
    .split(/\n(?=##?\s+)/)
    .map((section) => section.trim())
    .filter(Boolean)
    .flatMap((section) => {
      if (section.length <= 900) {
        return [section];
      }

      const paragraphs = section.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
      const chunks = [];
      let current = "";

      paragraphs.forEach((paragraph) => {
        const next = current ? `${current}\n\n${paragraph}` : paragraph;
        if (next.length > 900 && current) {
          chunks.push(current);
          current = paragraph;
        } else {
          current = next;
        }
      });

      if (current) {
        chunks.push(current);
      }

      return chunks;
    });
}

function buildKnowledgeIndex() {
  return listKnowledgeFiles().flatMap((fileName) => {
    const filePath = path.join(DOCS_DIR, fileName);
    const content = fs.readFileSync(filePath, "utf8");

    return chunkMarkdown(content).map((chunk, index) => ({
      id: `${fileName}:${index + 1}`,
      fileName,
      text: chunk,
      normalizedText: normalizeText(chunk),
      tokens: tokenize(chunk),
    }));
  });
}

function scoreChunk(queryTokens, chunk) {
  if (!queryTokens.length) {
    return 0;
  }

  let score = 0;
  queryTokens.forEach((token) => {
    const occurrences = chunk.tokens.filter((entry) => entry === token).length;
    if (occurrences > 0) {
      score += 12 + occurrences * 4;
    }

    if (chunk.normalizedText.includes(token)) {
      score += 3;
    }
  });

  return score;
}

function searchKnowledge(query, limit = 4) {
  const queryTokens = tokenize(query);
  const index = buildKnowledgeIndex();

  return index
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTokens, chunk),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ id, fileName, text, score }) => ({ id, fileName, text, score }));
}

function formatKnowledgeContext(matches) {
  if (!Array.isArray(matches) || !matches.length) {
    return "Keine lokalen Wissensquellen gefunden.";
  }

  return matches
    .map((match, index) => [`Quelle ${index + 1}: ${match.fileName}`, match.text].join("\n"))
    .join("\n\n---\n\n");
}

function sentenceScore(queryTokens, sentence) {
  const normalizedSentence = normalizeText(sentence);
  let score = 0;

  queryTokens.forEach((token) => {
    if (normalizedSentence.includes(token)) {
      score += 10;
    }
  });

  return score;
}

function buildExtractiveAnswer(query, matches, limit = 3) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length || !Array.isArray(matches) || !matches.length) {
    return null;
  }

  const rankedSentences = matches
    .flatMap((match) =>
      String(match.text || "")
        .split(/(?<=[.!?])\s+|\n+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 30)
        .map((sentence) => ({
          fileName: match.fileName,
          sentence,
          score: sentenceScore(queryTokens, sentence),
        }))
    )
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const uniqueSentences = [];
  rankedSentences.forEach((entry) => {
    if (uniqueSentences.length >= limit) {
      return;
    }

    const duplicate = uniqueSentences.some((existing) => normalizeText(existing.sentence) === normalizeText(entry.sentence));
    if (!duplicate) {
      uniqueSentences.push(entry);
    }
  });

  if (!uniqueSentences.length) {
    return null;
  }

  const sources = [...new Set(uniqueSentences.map((entry) => entry.fileName))];
  return {
    content: uniqueSentences.map((entry) => entry.sentence).join("\n\n"),
    sources,
  };
}

function buildChunkDigest(matches, limit = 2) {
  if (!Array.isArray(matches) || !matches.length) {
    return null;
  }

  const parts = matches
    .slice(0, limit)
    .map((match) =>
      String(match.text || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line && !/^```/.test(line))
        .slice(0, 5)
        .join(" ")
        .replace(/[*#>`_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  if (!parts.length) {
    return null;
  }

  return {
    content: parts.join("\n\n"),
    sources: [...new Set(matches.slice(0, limit).map((match) => match.fileName))],
  };
}

function buildSourcePreview(matches, limit = 3) {
  if (!Array.isArray(matches) || !matches.length) {
    return "";
  }

  return matches
    .slice(0, limit)
    .map((match, index) => {
      const cleaned = String(match.text || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line && !/^```/.test(line))
        .map((line) => line.replace(/^[*#>-]+\s*/, ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return `Quelle ${index + 1} (${match.fileName}): ${cleaned}`;
    })
    .join("\n\n");
}

module.exports = {
  buildChunkDigest,
  buildExtractiveAnswer,
  buildSourcePreview,
  formatKnowledgeContext,
  listKnowledgeFiles,
  searchKnowledge,
};