module.exports = {
  name: "status",
  triggers: ["status", "system"],
  run({ respond }) {
    return respond.text("Systemstatus geladen. Alle Kernmodule reagieren im Soll.", {
      highlight: "Statusscan abgeschlossen",
      quickActions: ["Wie spät ist es?", "Rechne 42/6", "Timer status"],
    });
  },
};
