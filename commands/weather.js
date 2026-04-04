module.exports = {
  name: "weather",
  triggers: ["wetter"],
  run({ input, helpers, respond }) {
    const match = input.match(/wetter(?:\s+in)?\s+([a-zA-ZäöüÄÖÜß\-\s]+)/i);
    const city = match ? match[1].trim() : "Wolgast";
    const content = helpers.getWeather(city);
    return respond.text(helpers.pickOne([content, `${content} Wetterdaten sind frisch.`, `${content} Keine Warnlage erkannt.`]), {
      highlight: `Wetterscan für ${helpers.capitalize(city)}`,
      quickActions: ["Wetter in Hamburg", "Wetter in London", "Status"],
    });
  },
};
