module.exports = {
  name: "time",
  triggers: ["zeit", "uhr", "uhrzeit"],
  run({ input, helpers, respond }) {
    const wantsOtherLocation = /\bin\b/i.test(input);
    const location = helpers.extractLocation(input, "(?:zeit|uhr(?:zeit)?)");
    const content = wantsOtherLocation ? helpers.getTimeForLocation(location) : `Aktuelle Uhrzeit: ${helpers.getTime()}`;
    return respond.text(helpers.pickOne([content, `${content} Zeitsignal stabil.`, `${content} Synchronisierung abgeschlossen.`]), {
      highlight: wantsOtherLocation ? `Clock sync: ${helpers.capitalize(location)}` : "Zeit synchronisiert",
      quickActions: ["Uhrzeit in London", "Uhrzeit in Tokio", "Datum in New York"],
    });
  },
};
