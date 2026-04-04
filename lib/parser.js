function normalizeInput(input) {
  return String(input || "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreTrigger(trigger, normalizedInput) {
  if (!normalizedInput) {
    return 0;
  }

  if (typeof trigger === "string") {
    const normalizedTrigger = trigger.toLowerCase();
    const boundaryPattern = new RegExp(`\\b${escapeRegExp(normalizedTrigger)}\\b`, "i");

    if (normalizedInput === normalizedTrigger) {
      return 140;
    }

    if (boundaryPattern.test(normalizedInput)) {
      return 100 + Math.min(normalizedTrigger.length, 20);
    }

    if (normalizedInput.includes(normalizedTrigger)) {
      return 70 + Math.min(normalizedTrigger.length, 15);
    }

    return 0;
  }

  if (trigger instanceof RegExp) {
    const match = normalizedInput.match(trigger);
    return match ? 90 + Math.min(match[0].length, 20) : 0;
  }

  return 0;
}

function findBestCommand(commands, context) {
  let bestCommand = null;
  let bestScore = 0;

  commands.forEach((command) => {
    const triggerScore = Math.max(0, ...(command.triggers || []).map((trigger) => scoreTrigger(trigger, context.normalizedInput)));
    const customScore = typeof command.match === "function" ? command.match(context) || 0 : 0;
    const score = Math.max(triggerScore, customScore);

    if (score > bestScore) {
      bestScore = score;
      bestCommand = command;
    }
  });

  return bestScore > 0 ? bestCommand : null;
}

module.exports = {
  findBestCommand,
  normalizeInput,
};
