You are a senior AI systems architect and full-stack engineer with expertise in building production-grade AI assistants.

Your task is to take an existing project called "Jarvis" and transform it into a highly advanced, modular, extensible AI assistant system comparable to early-stage versions of Iron Man’s JARVIS.

IMPORTANT:
- Do NOT explain what you are doing.
- Do NOT summarize.
- Directly produce architecture, code, and improvements.
- Think deeply and expand aggressively.

-----------------------------------
CORE OBJECTIVE
-----------------------------------

Upgrade Jarvis into a multi-modal AI system with:

1. Advanced conversational AI
2. Voice input (speech-to-text)
3. Voice output (text-to-speech)
4. Autonomous task handling
5. Modular plugin system
6. Memory (short-term + long-term)
7. API integrations
8. Local + cloud hybrid intelligence
9. Developer-friendly architecture
10. Real-world usability

-----------------------------------
SYSTEM ARCHITECTURE
-----------------------------------

Redesign the entire system using a modular architecture:

- Core Engine
- AI Processing Layer
- Voice Module
- Memory System
- Plugin System
- API Layer
- UI Layer (CLI + optional Web UI)

Use modern best practices.

-----------------------------------
FEATURE EXPANSION (MANDATORY)
-----------------------------------

Add and implement ALL of the following:

### AI / INTELLIGENCE
- Multi-model support (local models + API fallback)
- Context-aware conversations
- Persistent memory system (vector DB or similar)
- Task planning system (basic agent loop)
- Command understanding (intent detection)

### VOICE SYSTEM
- Speech-to-Text (real-time capable)
- Text-to-Speech (natural voice)
- Wake word detection (e.g. "Jarvis")

### AUTOMATION
- Execute system commands (safe sandboxed)
- File system interaction
- Web requests & scraping
- Scheduled tasks

### PLUGIN SYSTEM
- Fully dynamic plugin loader
- Example plugins:
  - Weather
  - System monitoring
  - Discord / API bot
  - Code execution

### UI
- CLI interface
- Optional modern web dashboard (React or similar)

### PERFORMANCE
- Async architecture
- Caching where useful
- Logging + debugging tools

-----------------------------------
TECH STACK (PREFERRED)
-----------------------------------

You may choose optimal technologies, but prefer:

- Backend: Python (FastAPI) OR Node.js (Express)
- AI: OpenAI / local LLM (Ollama)
- Voice:
  - STT: Whisper or equivalent
  - TTS: Coqui / ElevenLabs-style
- Memory: vector DB (FAISS / Chroma)
- Frontend: React (optional)

-----------------------------------
OUTPUT FORMAT
-----------------------------------

Produce:

1. Full system architecture (clear and structured)
2. Folder structure
3. Core implementation files
4. Example plugin system
5. Voice integration code
6. Memory system implementation
7. Instructions to run locally
8. Suggestions for further scaling

-----------------------------------
QUALITY REQUIREMENTS
-----------------------------------

- Production-ready code
- Clean structure
- Modular design
- No placeholders like "TODO"
- No vague explanations

-----------------------------------
FINAL GOAL
-----------------------------------

By the end, Jarvis should feel like a real AI assistant that can:
- Talk
- Listen
- Remember
- Execute tasks
- Be extended infinitely

Start now.