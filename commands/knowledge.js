const { answerKnowledgeQuestion, getAIStatus, rewriteKnowledgeAnswer } = require("../lib/ai-router");
const { buildChunkDigest, buildExtractiveAnswer, buildSourcePreview, formatKnowledgeContext, searchKnowledge } = require("../lib/knowledge-base");

function isLikelyMathQuestion(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /\d/.test(normalized) && /[+\-*/%=()]/.test(normalized);
}

function normalizeKnowledgeQuery(value) {
  return String(value || "")
    .replace(/^(frage|wissen|erklaere|erkläre|erzaehl mir|erzähl mir|was weißt du über|was weisst du ueber)\s+/i, "")
    .trim();
}

module.exports = {
  name: "knowledge",
  triggers: ["erklaere", "erkläre", "wissen", "wer ist", "was bedeutet", "wie funktioniert"],
  match({ input, normalizedInput }) {
    if (isLikelyMathQuestion(input)) {
      return 0;
    }

    if (/^(wer ist|was bedeutet|wie funktioniert|erklaere|erkläre|was weißt du über|was weisst du ueber)\b/i.test(normalizedInput)) {
      return 155;
    }

    if (/\b(erkl[aä]r|wissen|hintergrund|details)\b/i.test(normalizedInput)) {
      return 120;
    }

    return 0;
  },
  async run({ input, respond }) {
    const question = normalizeKnowledgeQuery(input);
    if (!question) {
      return respond.error("Ich brauche eine konkrete Wissensfrage, zum Beispiel: Erkläre mir Ollama oder Wie funktioniert Jarvis aktuell?", {
        highlight: "Knowledge query missing",
        quickActions: ["Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?", "Was bedeutet lokales AI-Routing?"],
      });
    }

    const matches = searchKnowledge(question, 4);
    const extractiveAnswer = buildExtractiveAnswer(question, matches, 3);
    const chunkDigest = buildChunkDigest(matches, 2);
    const sourcePreview = buildSourcePreview(matches, 3);
    const knowledgeContext = formatKnowledgeContext(matches);
    const aiStatus = getAIStatus();

    if (matches.length && aiStatus.enabled) {
      try {
        const rewritten = await rewriteKnowledgeAnswer(
          question,
          sourcePreview,
          [...new Set(matches.map((match) => match.fileName))]
        );

        if (rewritten) {
          return respond.text(rewritten, {
            highlight: `Knowledge local: ${matches.length} Quellen`,
            quickActions: ["Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?", "Status"],
          });
        }
      } catch {
        // Faellt auf lokalen Rohmodus oder generative Antwort zurueck.
      }
    }

    if (extractiveAnswer) {
      return respond.text(`${extractiveAnswer.content}\n\nQuellen: ${extractiveAnswer.sources.join(", ")}`, {
        highlight: `Knowledge local: ${matches.length} Quellen`,
        quickActions: ["Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?", "Status"],
      });
    }

    if (chunkDigest) {
      return respond.text(`${chunkDigest.content}\n\nQuellen: ${chunkDigest.sources.join(", ")}`, {
        highlight: `Knowledge local: ${matches.length} Quellen`,
        quickActions: ["Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?", "Status"],
      });
    }

    if (!aiStatus.enabled) {
      return respond.list("Der Wissensmodus ist deaktiviert. Ich habe aber lokale Treffer gefunden:", {
        items: matches.length
          ? matches.map((match) => `${match.fileName}: ${match.text.slice(0, 180).replace(/\s+/g, " ")}...`)
          : ["Keine passende lokale Wissensquelle gefunden."],
        highlight: "Knowledge mode disabled",
        quickActions: ["Status", "Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?"],
      });
    }

    try {
      const answer = await answerKnowledgeQuestion(question, knowledgeContext);
      return respond.text(answer || "Ich konnte dazu gerade keine belastbare Antwort erzeugen.", {
        highlight: `Knowledge sync: ${matches.length} Quellen`,
        quickActions: ["Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?", "Status"],
      });
    } catch (error) {
      return respond.list("Die Wissens-AI war nicht erreichbar. Ich habe dir die besten lokalen Treffer zusammengestellt:", {
        items: matches.length
          ? matches.map((match) => `${match.fileName}: ${match.text.slice(0, 220).replace(/\s+/g, " ")}...`)
          : ["Keine passende lokale Wissensquelle gefunden."],
        highlight: "Knowledge fallback active",
        quickActions: ["Status", "Erkläre mir Ollama", "Wie funktioniert Jarvis aktuell?"],
      });
    }
  },
};