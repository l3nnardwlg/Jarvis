module.exports = {
  name: "greeting",
  triggers: ["hallo", "jarvis"],
  run({ helpers, respond }) {
    return respond.text(helpers.pickOne([
      "Jarvis online. Ich steuere Zeit, Datum, Wetter, Rechner, Zufallszahlen, Timer, Notizen, URLs, Amazon-Suche und Witze lokal für dich.",
      "System bereit. Du kannst mich nach Zeit, Wetter, Rechnen, Notizen, Timern oder Links fragen.",
      "Bereit für Eingaben. Lokal, direkt und ohne Cloud-Zwang für Standardbefehle.",
    ]), {
      highlight: "Voice core ready",
      quickActions: ["Status", "Wetter in Berlin", "Rechne 12*12", "Witz erzählen"],
    });
  },
};
