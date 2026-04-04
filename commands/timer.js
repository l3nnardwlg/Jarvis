module.exports = {
  name: "timer",
  triggers: ["timer"],
  run({ input, normalizedInput, state, helpers, respond }) {
    if (/(liste|status)/.test(normalizedInput)) {
      return respond.text(helpers.listActiveTimers(state), {
        highlight: "Timer monitor",
        quickActions: ["Timer 10 sekunden", "Timer 2 minuten kaffeepause", "Status"],
      });
    }

    const timerConfig = helpers.parseTimerInput(input);
    if (!timerConfig) {
      return respond.error("Timer nicht verstanden. Beispiele: Timer 10 sekunden oder Timer 2 minuten kaffeepause.", {
        highlight: "Timer input missing",
        quickActions: ["Timer 10 sekunden", "Timer 1 minute fokus", "Timer status"],
      });
    }

    const timer = helpers.startTimer(state, timerConfig);
    return respond.text(`Timer gestartet: ${timer.label}. Ende um ${helpers.formatClockTimestamp(timer.endsAt)}.`, {
      highlight: "Timer armed",
      quickActions: ["Timer status", "Timer 30 sekunden stretch", "Status"],
    });
  },
};
