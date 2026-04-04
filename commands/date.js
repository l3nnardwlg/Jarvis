module.exports = {
  name: "date",
  triggers: ["datum", "tag"],
  run({ input, helpers, respond }) {
    const wantsOtherLocation = /\bin\b/i.test(input);
    const location = helpers.extractLocation(input, "(?:datum|tag)");

    return respond.text(
      wantsOtherLocation ? helpers.getDateForLocation(location) : `Heute ist ${helpers.getDate()}.`,
      {
        highlight: wantsOtherLocation ? `Calendar sync: ${helpers.capitalize(location)}` : "Kalender online",
        quickActions: ["Datum in Berlin", "Datum in Tokio", "Wie spät ist es?"],
      }
    );
  },
};
