module.exports = {
  name: "timer",
  triggers: ["timer"],
  run({ input, normalizedInput, state, helpers, respond }) {
    if (/(liste|status)/.test(normalizedInput)) {
      return respond.text(helpers.pickOne([
        helpers.listActiveTimers(state),
        `Timerstatus: ${helpers.listActiveTimers(state)}`,
        `Aktueller Überblick: ${helpers.listActiveTimers(state)}`,
      ]), {
        highlight: "Timer monitor",
        quickActions: ["Timer 10 sekunden", "Timer 2 minuten kaffeepause", "Status"],
      });
    }

    const timerConfig = helpers.parseTimerInput(input);
    if (!timerConfig) {
      return respond.error(helpers.pickOne([
        "Timer nicht verstanden. Beispiele: Timer 10 sekunden oder Timer 2 minuten kaffeepause.",
        "Ich brauche beim Timer eine Dauer, zum Beispiel 10 sekunden oder 2 minuten kaffeepause.",
        "Der Timerbefehl war nicht eindeutig. Versuch es mit Timer 30 sekunden stretch.",
      ]), {
        highlight: "Timer input missing",
        quickActions: ["Timer 10 sekunden", "Timer 1 minute fokus", "Timer status"],
      });
    }

    const timer = helpers.startTimer(state, timerConfig);
    return respond.text(helpers.pickOne([
      `Timer gestartet: ${timer.label}. Ende um ${helpers.formatClockTimestamp(timer.endsAt)}.`,
      `Läuft: ${timer.label}. Geplantes Ende ist ${helpers.formatClockTimestamp(timer.endsAt)}.`,
      `Timer aktiv. ${timer.label} endet um ${helpers.formatClockTimestamp(timer.endsAt)}.`,
    ]), {
      highlight: "Timer armed",
      quickActions: ["Timer status", "Timer 30 sekunden stretch", "Status"],
    });
  },
};
