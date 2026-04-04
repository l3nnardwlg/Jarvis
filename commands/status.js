module.exports = {
  name: "status",
  triggers: ["status", "system"],
  run({ state, helpers, respond }) {
    return respond.list(helpers.pickOne([
      "Systemstatus geladen. Alle Kernmodule reagieren im Soll.",
      "Statusscan abgeschlossen. Die wichtigsten Module wirken stabil.",
      "Überblick ist da. Kernfunktionen antworten normal.",
    ]), {
      items: [
        `Licht: ${state.lightsOn ? "an" : "aus"}`,
        `Fokus: ${state.focusMode ? "aktiv" : "inaktiv"}`,
        `Alarm: ${state.alarmArmed ? "aktiv" : "inaktiv"}`,
        `Letztes Ergebnis: ${state.context.lastResult ?? "keins"}`,
      ],
      highlight: "Statusscan abgeschlossen",
      quickActions: ["Wie spät ist es?", "Rechne 42/6", "Timer status"],
    });
  },
};
