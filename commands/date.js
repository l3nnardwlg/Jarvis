module.exports = {
  name: "date",
  triggers: ["datum", "tag"],
  run({ input, helpers, respond }) {
    const wantsOtherLocation = /\bin\b/i.test(input);
    const location = helpers.extractLocation(input, "(?:datum|tag)");
    const content = wantsOtherLocation ? helpers.getDateForLocation(location) : `Heute ist ${helpers.getDate()}.`;

    return respond.text(helpers.pickOne([content, `${content} Kalenderdaten sind aktuell.`, `${content} Alles synchron.`]), {
      highlight: wantsOtherLocation ? `Calendar sync: ${helpers.capitalize(location)}` : "Kalender online",
      quickActions: ["Datum in Berlin", "Datum in Tokio", "Wie spät ist es?"],
    });
  },
};
