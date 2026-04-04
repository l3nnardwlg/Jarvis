module.exports = {
  name: "random",
  triggers: ["zufall", "random"],
  run({ input, state, memory, helpers, respond }) {
    const bounds = helpers.extractRandomBounds(input);
    const value = helpers.getRandomNumber(bounds.min, bounds.max);
    state.context.lastResult = value;
    memory.setContext({ lastResult: value, lastCommand: "random" });

    return respond.text(helpers.pickOne([
      `Zufallszahl zwischen ${Math.min(bounds.min, bounds.max)} und ${Math.max(bounds.min, bounds.max)}: ${value}`,
      `Ich habe ${value} gezogen im Bereich ${Math.min(bounds.min, bounds.max)} bis ${Math.max(bounds.min, bounds.max)}.`,
      `Der Zufall liefert ${value}. Bereich: ${Math.min(bounds.min, bounds.max)}-${Math.max(bounds.min, bounds.max)}.`,
    ]), {
      highlight: "Random generator online",
      quickActions: ["Zufallszahl bis 10", "Zufallszahl zwischen 50 und 150", "Status"],
    });
  },
};
