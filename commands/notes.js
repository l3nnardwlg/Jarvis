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
      const noteList = notes.length ? notes.map((note, index) => `${index + 1}. ${note}`).join(" | ") : "Keine Notizen gespeichert.";
      return respond.text(noteList, {
        highlight: "Memory index loaded",
        quickActions: ["Speichere Notiz Milch kaufen", "Zeig meine Notizen", "Status"],
      });
    }

    if (/(letzte notiz|meine notiz\b)/.test(normalizedInput)) {
      const notes = memory.listNotes();
      return respond.text(`Letzte gespeicherte Notiz: ${notes[0] || "Keine Notizen gespeichert."}`, {
        highlight: "Memory core read",
        quickActions: ["Zeig meine Notizen", "Status", "Speichere Notiz Milch kaufen"],
      });
    }

    const note = helpers.extractNote(input) || "Leere Notiz empfangen.";
    if (note !== "Leere Notiz empfangen.") {
      memory.addNote(note);
    }

    return respond.text(`Notiz gespeichert: ${note}`, {
      highlight: "Memory core updated",
      quickActions: ["Zeig meine Notizen", "Status", "Witz erzählen"],
    });
  },
};
