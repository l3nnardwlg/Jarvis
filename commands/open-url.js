module.exports = {
  name: "open-url",
  triggers: ["öffne", "oeffne", "offne", "open url", "url"],
  run({ input, helpers, respond }) {
    const url = helpers.extractUrl(input);
    if (!url) {
      return respond.error(helpers.pickOne([
        "Ich konnte keine URL erkennen. Beispiel: Öffne github.com",
        "Die Adresse war nicht klar genug. Versuch es zum Beispiel mit Öffne github.com",
        "Ich brauche eine erkennbare URL, zum Beispiel github.com oder youtube.com",
      ]), {
        highlight: "URL parser waiting",
        quickActions: ["Öffne github.com", "Öffne amazon.de", "Status"],
      });
    }

    return respond.link(helpers.pickOne([
      `URL bereit: ${url}`,
      `Die Adresse steht bereit: ${url}`,
      `Ich habe den Link vorbereitet: ${url}`,
    ]), {
      links: [{ label: `Öffnen: ${url}`, url }],
      highlight: "External link staged",
      autoOpenLinks: true,
      linkType: "url",
      quickActions: ["Öffne youtube.com", "Öffne github.com", "Status"],
    });
  },
};
