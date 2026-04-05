## 🚀 Jarvis – Phase: Ollama Integration (AI Routing)

## Status

- Im Code umgesetzt:
  - Ollama-API-Anbindung ueber `http://localhost:11434/api/generate`
  - AI-Router mit JSON-Parsing und Alias-Mapping
  - Integration in den Hauptfluss vor dem bestehenden Parser
  - Sauberer Fallback auf das bisherige lokale Command-Matching
  - Getestet fuer Zeit, Rechnen, Amazon und URL-Oeffnen
- Manuelle Voraussetzung:
  - Ollama muss lokal laufen
  - Modell `llama3` muss vorhanden sein

---

### 🎯 Ziel

AI wird NUR genutzt für:
→ Input verstehen
→ passenden Command auswählen

KEINE direkte Antwortgenerierung durch AI.

---

## 1. 🧠 Ollama API Integration

* Endpoint: `http://localhost:11434/api/generate`
* Model: `llama3`
* `stream: false`
* Funktion bauen: `askOllama(prompt)`

---

## 2. 🧩 System Prompt definieren

* Rolle: „AI Router“

* Liste aller Commands übergeben:

  * time
  * date
  * calc
  * amazon
  * random
  * timer
  * notes_add
  * notes_list
  * open_url
  * joke

* Output IMMER JSON:

```json
{
  "command": "...",
  "input": "..."
}
```

---

## 3. 🔍 Routing Funktion bauen

* Funktion: `routeWithAI(input)`
* sendet Prompt an Ollama
* parst JSON Antwort
* Fehler abfangen (`try/catch`)

---

## 4. ⚙️ Integration in Hauptsystem

Flow:

```text
User Input
→ AI Routing
→ passender Command wird gesucht
→ Command.run() wird ausgeführt
→ Response zurück
```

---

## 5. ⚠️ Fallback System (WICHTIG)

* Wenn AI:

  * kein JSON liefert
  * falsches Format liefert
    → fallback auf bestehendes Command-System

---

## 6. 🛡️ Error Handling

* JSON Parsing absichern
* wenn Command nicht existiert:

  * saubere Fehlermeldung zurückgeben

---

## 7. ⚡ Performance Optimierung

* Prompt kurz halten
* optional:

  * `temperature: 0.2` setzen (stabilere Antworten)

---

## 8. 🧪 Testing

Test Inputs:

* „wie spät ist es“
* „rechne 5+5“
* „such maus auf amazon“
* „öffne youtube“

→ prüfen:

* korrekter Command gewählt?
* Input sauber übergeben?

---

## 9. 🎯 Erwartetes Verhalten

User Input:

> „wie spät ist es in berlin“

AI Output:

```json
{
  "command": "time",
  "input": "berlin"
}
```

System:
→ führt `time` Command aus

---

## 🔥 Ziel dieser Phase

* natürliche Sprache funktioniert
* System bleibt stabil (Commands bleiben Core)
* AI = nur „Brain“, nicht „Executor“

---

## Manuell zu tun

1. Ollama lokal gestartet lassen.
2. Sicherstellen, dass `llama3` installiert ist.
3. Jarvis normal starten und echte Eingaben im UI pruefen.

---

## Aktueller Integrationsstandard

Ollama ist jetzt als optionale Routing-Schicht gedacht:

* Jarvis bleibt immer lokal funktionsfaehig.
* AI wird nur fuer Intent-Erkennung genutzt.
* Wenn Ollama nicht erreichbar ist, faellt Jarvis sofort auf den lokalen Parser zurueck.
* Wiederholte Timeouts werden durch einen kurzen Health-Cache und Cooldown vermieden.

### Relevante Umgebungsvariablen

* `OLLAMA_ENABLED=true|false`
* `OLLAMA_ENDPOINT=http://localhost:11434/api/generate`
* `OLLAMA_MODEL=llama3`
* `OLLAMA_TIMEOUT_MS=15000`
* `OLLAMA_HEALTH_TTL_MS=30000`
* `OLLAMA_RETRY_AFTER_FAILURE_MS=15000`

### Empfehlung fuer den Betrieb

* Lokal mit AI: `OLLAMA_ENABLED=true`
* Rein lokal ohne Modell: `OLLAMA_ENABLED=false`
* UI und `/api/status` zeigen jetzt, ob der AI Router online ist.
