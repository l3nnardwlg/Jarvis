module.exports = {
  name: "focus",
  triggers: ["fokus", "focus"],
  run({ state, respond }) {
    state.focusMode = !state.focusMode;
    return respond.text(
      state.focusMode
        ? "Fokusmodus aktiv. Benachrichtigungen gedrosselt, Lichter gedimmt."
        : "Fokusmodus deaktiviert. Normale Betriebsparameter wiederhergestellt.",
      {
        highlight: state.focusMode ? "Focus Lock engaged" : "Focus Lock released",
        quickActions: ["Status", "Licht an", "Alarm aktivieren"],
      }
    );
  },
};
