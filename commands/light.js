module.exports = {
  name: "light",
  triggers: ["licht an", "licht aus", "licht"],
  match({ normalizedInput }) {
    if (normalizedInput.includes("licht an")) return 160;
    if (normalizedInput.includes("licht aus")) return 160;
    return normalizedInput.includes("licht") ? 80 : 0;
  },
  run({ normalizedInput, state, helpers, respond }) {
    if (normalizedInput.includes("licht aus")) {
      state.lightsOn = false;
    } else if (normalizedInput.includes("licht an")) {
      state.lightsOn = true;
    }

    return respond.text(
      state.lightsOn
        ? helpers.pickOne(["Wohnzimmerbeleuchtung aktiviert.", "Licht ist jetzt an.", "Beleuchtung hochgefahren."])
        : helpers.pickOne(["Wohnzimmerbeleuchtung deaktiviert.", "Licht ist jetzt aus.", "Beleuchtung heruntergefahren."]),
      {
        highlight: state.lightsOn ? "Lichtstatus: AN" : "Lichtstatus: AUS",
        quickActions: state.lightsOn ? ["Licht aus", "Status", "Fokusmodus aktivieren"] : ["Licht an", "Status", "Wetter"],
      }
    );
  },
};
