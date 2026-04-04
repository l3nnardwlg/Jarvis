module.exports = {
  name: "alarm",
  triggers: ["alarm"],
  run({ normalizedInput, state, respond }) {
    state.alarmArmed = !normalizedInput.includes("aus");
    return respond.text(
      state.alarmArmed ? "Alarmanlage scharf geschaltet." : "Alarmanlage entschärft.",
      {
        highlight: state.alarmArmed ? "Perimeter secured" : "Perimeter relaxed",
        quickActions: ["Alarm aus", "Alarm an", "Status"],
      }
    );
  },
};
