module.exports = {
  name: "random",
  triggers: ["zufall", "random"],
  run({ input, helpers, respond }) {
    const bounds = helpers.extractRandomBounds(input);
    const value = helpers.getRandomNumber(bounds.min, bounds.max);
    return respond.text(`Zufallszahl zwischen ${Math.min(bounds.min, bounds.max)} und ${Math.max(bounds.min, bounds.max)}: ${value}`, {
      highlight: "Random generator online",
      quickActions: ["Zufallszahl bis 10", "Zufallszahl zwischen 50 und 150", "Status"],
    });
  },
};
