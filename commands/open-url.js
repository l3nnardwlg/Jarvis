module.exports = {
  name: "open-url",
  triggers: ["öffne", "oeffne", "offne", "open url", "url"],
  run({ input, helpers, respond }) {
    const url = helpers.extractUrl(input);
    if (!url) {
      return respond.error("Ich konnte keine URL erkennen. Beispiel: Öffne github.com", {
        highlight: "URL parser waiting",
        quickActions: ["Öffne github.com", "Öffne amazon.de", "Status"],
      });
    }

    return respond.link(`URL bereit: ${url}`, {
      links: [{ label: `Öffnen: ${url}`, url }],
      highlight: "External link staged",
      autoOpenLinks: true,
      linkType: "url",
      quickActions: ["Öffne youtube.com", "Öffne github.com", "Status"],
    });
  },
};
