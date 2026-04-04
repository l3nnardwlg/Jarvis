module.exports = {
  name: "time",
  triggers: ["zeit", "uhr", "uhrzeit"],
  run({ input, helpers, respond }) {
    const wantsOtherLocation = /\bin\b/i.test(input);
    const location = helpers.extractLocation(input, "(?:zeit|uhr(?:zeit)?)");
    return respond.text(
      wantsOtherLocation ? helpers.getTimeForLocation(location) : `Aktuelle Uhrzeit: ${helpers.getTime()}`,
      {
        highlight: wantsOtherLocation ? `Clock sync: ${helpers.capitalize(location)}` : "Zeit synchronisiert",
        quickActions: ["Uhrzeit in London", "Uhrzeit in Tokio", "Datum in New York"],
      }
    );
  },
};
