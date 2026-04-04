module.exports = {
  name: "focus",
  triggers: ["fokus", "focus"],
  run({ state, helpers, respond }) {
    state.focusMode = !state.focusMode;
    return respond.text(
      state.focusMode
        ? helpers.pickOne([
            "Fokusmodus aktiv. Benachrichtigungen gedrosselt, Lichter gedimmt.",
            "Fokus läuft. Ablenkungen wurden reduziert.",
            "Konzentrierter Modus aktiv. Störquellen sind heruntergeregelt.",
          ])
        : helpers.pickOne([
            "Fokusmodus deaktiviert. Normale Betriebsparameter wiederhergestellt.",
            "Fokus beendet. Normale Reizlage ist wieder aktiv.",
            "Konzentrierter Modus aus. Alles läuft wieder normal.",
          ]),
      {
        highlight: state.focusMode ? "Focus Lock engaged" : "Focus Lock released",
        quickActions: ["Status", "Licht an", "Alarm aktivieren"],
      }
    );
  },
};
