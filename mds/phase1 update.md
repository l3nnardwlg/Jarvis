## 🚀 Jarvis – Next Steps (Dev Tasks)

### 1. 🧱 Commands modularisieren

* Alle Commands in `/commands` Ordner auslagern
* Pro Command eine Datei (z. B. `time.js`, `calc.js`)
* Einheitliches Format:

  * `name`
  * `triggers`
  * `run(input)`

---

### 2. 🧠 Command Loader bauen

* Alle Dateien aus `/commands` automatisch laden
* Commands in Array speichern
* Dynamisch erweiterbar (kein Hardcoding)

---

### 3. 🔍 Parser verbessern

* Input → lowercase
* Matching über `triggers`
* Best match auswählen (kein reines `includes` Chaos)

---

### 4. ⚙️ Parameter Handling

* Input bereinigen (`replace`, `trim`)
* Werte extrahieren (z. B. bei „rechne 5+5“)
* In `run()` sauber übergeben

---

### 5. 📦 Response System einführen

* Einheitliches Response Format:

```json
{
  "type": "text",
  "content": "..."
}
```

* Erweiterbar für:

  * `link`
  * `card`
  * `error`

---

### 6. 🎨 Frontend Integration

* Response Type auswerten
* Unterschiedlich rendern:

  * Text → Chat Bubble
  * Link → Button
  * später → Cards

---

### 7. 📝 Memory System (basic)

* Lokale JSON Datei
* speichern:

  * Notizen
  * ggf. Username
* Commands:

  * „merk dir …“
  * „zeige notizen“

---

### 8. 🧪 Testing

* Jeder Command einzeln testen
* Edge Cases prüfen (leerer Input etc.)

---

### 9. ⚡ Git Workflow

* Standard:

```bash
git add .
git commit -m "update"
git push
```

* Optional: `update.bat` nutzen

---

### 10. 🔮 Vorbereitung für Phase 2

* Code so strukturieren, dass später AI (Ollama) einfach integriert werden kann
* klare Trennung:

  * Parser
  * Commands
  * Response

---
