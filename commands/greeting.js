module.exports = {
  name: "greeting",
  triggers: ["hallo", "jarvis"],
  run({ respond }) {
    return respond.text(
      "Jarvis online. Ich steuere Zeit, Datum, Wetter, Rechner, Zufallszahlen, Timer, Notizen, URLs, Amazon-Suche und Witze lokal für dich.",
      {
        highlight: "Voice core ready",
        quickActions: ["Status", "Wetter in Berlin", "Rechne 12*12", "Witz erzählen"],
      }
    );
  },
};
