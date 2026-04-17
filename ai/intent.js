const { logger } = require('../core/logger');

const log = logger.child('ai:intent');

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a voice assistant named Jarvis.
Given a user message, classify the intent into exactly one of these categories:

- command: A direct command or request to perform an action (open app, set timer, search, calculate)
- question: A factual question requiring an answer
- conversation: Casual chat, greeting, or small talk
- task: A multi-step task request (create project, write code, manage files)
- system: A request about Jarvis itself (status, settings, help)
- voice: Voice-related (speak, read aloud, stop talking)
- unknown: Cannot determine

Also extract:
- entities: key nouns/values from the message
- confidence: 0.0-1.0

Respond ONLY with valid JSON:
{"intent":"<category>","entities":["<entity1>"],"confidence":0.9}`;

async function detectIntent(aiRouter, text) {
  if (!aiRouter.provider) {
    return fallbackIntentDetection(text);
  }

  try {
    const result = await aiRouter.chat([
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ], { temperature: 0.1 });

    const parsed = JSON.parse(result.content.trim());
    return {
      intent: parsed.intent || 'unknown',
      entities: parsed.entities || [],
      confidence: parsed.confidence || 0.5,
      raw: text,
    };
  } catch (err) {
    log.warn('AI intent detection failed, using fallback', { error: err.message });
    return fallbackIntentDetection(text);
  }
}

function fallbackIntentDetection(text) {
  const lower = text.toLowerCase().trim();

  const commandPatterns = [
    /^(open|launch|start|run|play|stop|close|set|create|delete|remove|send|show|turn)/,
    /^(search|find|look up|google|calculate|convert)/,
    /timer|alarm|reminder|schedule/,
  ];

  const questionPatterns = [
    /^(what|who|where|when|why|how|is|are|was|were|do|does|did|can|could|will|would|should)/,
    /\?$/,
  ];

  const systemPatterns = [
    /^(status|help|settings|config|version|uptime)/,
    /jarvis.*(status|help|settings)/,
  ];

  const voicePatterns = [
    /^(say|speak|read|pronounce|shut up|be quiet|stop talking)/,
  ];

  const greetingPatterns = [
    /^(hi|hello|hey|good morning|good evening|good night|yo|sup|what'?s up)/,
    /^(thanks|thank you|bye|goodbye|see you)/,
  ];

  if (systemPatterns.some(p => p.test(lower))) {
    return { intent: 'system', entities: [], confidence: 0.8, raw: text };
  }
  if (voicePatterns.some(p => p.test(lower))) {
    return { intent: 'voice', entities: [], confidence: 0.8, raw: text };
  }
  if (commandPatterns.some(p => p.test(lower))) {
    return { intent: 'command', entities: [], confidence: 0.7, raw: text };
  }
  if (questionPatterns.some(p => p.test(lower))) {
    return { intent: 'question', entities: [], confidence: 0.7, raw: text };
  }
  if (greetingPatterns.some(p => p.test(lower))) {
    return { intent: 'conversation', entities: [], confidence: 0.8, raw: text };
  }

  return { intent: 'conversation', entities: [], confidence: 0.4, raw: text };
}

module.exports = { detectIntent, fallbackIntentDetection };
