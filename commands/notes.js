module.exports = {
  name: "notes",
  triggers: ["notiz", "notizen", "merke", "speicher", "letzte notiz"],
  match({ normalizedInput }) {
    if (/(zeige|zeig|liste|meine notizen)/.test(normalizedInput)) return 170;
    if (/(letzte notiz|meine notiz\b)/.test(normalizedInput)) return 155;
    if (/(notiz|notizen)/.test(normalizedInput)) return 150;
    if (/(merke|speicher|speichere)/.test(normalizedInput)) return 120;
    return 0;
  },
  run({ input, normalizedInput, memory, helpers, respond }) {
    if (/(liste|zeige|zeig|meine notizen)/.test(normalizedInput)) {
      const notes = memory.listNotes();
      return respond.list(notes.length ? "Hier sind deine letzten Notizen:" : "Noch keine Notizen gespeichert.", {
        items: notes.length ? notes : ["Keine Notizen gespeichert."],
        highlight: "Memory index loaded",
        quickActions: ["Speichere Notiz Milch kaufen", "Zeig meine Notizen", "Status"],
      });
    }

    if (/(letzte notiz|meine notiz\b)/.test(normalizedInput)) {
      const notes = memory.listNotes();
      return respond.text(helpers.pickOne([
        `Letzte gespeicherte Notiz: ${notes[0] || "Keine Notizen gespeichert."}`,
        `Ganz oben liegt aktuell: ${notes[0] || "Keine Notizen gespeichert."}`,
        `Zuletzt gemerkt wurde: ${notes[0] || "Keine Notizen gespeichert."}`,
      ]), {
        highlight: "Memory core read",
        quickActions: ["Zeig meine Notizen", "Status", "Speichere Notiz Milch kaufen"],
      });
    }

    const note = helpers.extractNote(input) || "Leere Notiz empfangen.";
    if (note !== "Leere Notiz empfangen.") {
      memory.addNote(note);
    }

    return respond.text(helpers.pickOne([
      `Notiz gespeichert: ${note}`,
      `Gemerkt: ${note}`,
      `Ist notiert: ${note}`,
    ]), {
      highlight: "Memory core updated",
      quickActions: ["Zeig meine Notizen", "Status", "Witz erzählen"],
    });
  },
};
