module.exports = {
  name: "alarm",
  triggers: ["alarm"],
  run({ normalizedInput, state, helpers, respond }) {
    state.alarmArmed = !normalizedInput.includes("aus");
    return respond.text(
      state.alarmArmed
        ? helpers.pickOne(["Alarmanlage scharf geschaltet.", "Perimeter aktiv. Alarm ist jetzt an.", "Alarm aktiviert. Alle Sensoren sind bereit."])
        : helpers.pickOne(["Alarmanlage entschärft.", "Alarm ist jetzt aus.", "Perimeter entspannt. Alarm wurde deaktiviert."]),
      {
        highlight: state.alarmArmed ? "Perimeter secured" : "Perimeter relaxed",
        quickActions: ["Alarm aus", "Alarm an", "Status"],
      }
    );
  },
};
