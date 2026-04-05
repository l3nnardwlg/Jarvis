module.exports = {
  name: "greeting",
  triggers: ["hallo", "jarvis"],
  run({ helpers, respond }) {
    return respond.text(helpers.pickOne([
      "Jarvis online. Ich steuere Zeit, Datum, Wetter, Rechner, Zufallszahlen, Timer, Notizen, URLs, Amazon-Suche, Witze und jetzt auch Wissensfragen für dich.",
      "System bereit. Du kannst mich nach Zeit, Wetter, Rechnen, Notizen, Timern, Links oder Hintergrundwissen fragen.",
      "Bereit für Eingaben. Lokal für Standardbefehle und mit Wissensmodus für Erklärungen und Kontext.",
    ]), {
      highlight: "Voice core ready",
      quickActions: ["Status", "Erkläre mir Ollama", "Wetter in Berlin", "Rechne 12*12"],
    });
  },
};
