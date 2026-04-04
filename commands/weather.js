module.exports = {
  name: "weather",
  triggers: ["wetter"],
  run({ input, helpers, respond }) {
    const match = input.match(/wetter(?:\s+in)?\s+([a-zA-ZäöüÄÖÜß\-\s]+)/i);
    const city = match ? match[1].trim() : "Wolgast";
    return respond.text(helpers.getWeather(city), {
      highlight: `Wetterscan für ${helpers.capitalize(city)}`,
      quickActions: ["Wetter in Hamburg", "Wetter in London", "Status"],
    });
  },
};
