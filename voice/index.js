const { logger } = require('../core/logger');
const config = require('../core/config');
const stt = require('./stt');
const tts = require('./tts');

const log = logger.child('voice');

class VoiceModule {
  constructor() {
    this.sttAvailable = false;
    this.ttsAvailable = false;
    this.wakeWord = config.voice.wakeWord;
    this.listening = false;
  }

  async init(engine) {
    this.engine = engine;

    if (!config.voice.enabled) {
      log.info('Voice module disabled');
      return;
    }

    this.sttAvailable = await stt.checkHealth();
    this.ttsAvailable = await tts.checkHealth();

    log.info(`Voice initialized — browser wakeword is client-side, server STT: ${this.sttAvailable ? 'available' : 'offline'}, server TTS: ${this.ttsAvailable ? 'available' : 'offline'}`);
  }

  async transcribe(audioBuffer, options = {}) {
    if (!this.sttAvailable) throw new Error('STT service not available');
    const result = await stt.transcribe(audioBuffer, options);
    log.debug(`Transcribed: "${result.text}"`);
    return result;
  }

  async speak(text, options = {}) {
    if (!this.ttsAvailable) throw new Error('TTS service not available');
    const result = await tts.synthesize(text, options);
    log.debug(`Synthesized ${result.audio.length} bytes`);
    return result;
  }

  detectWakeWord(text) {
    return text.toLowerCase().includes(this.wakeWord.toLowerCase());
  }

  stripWakeWord(text) {
    const regex = new RegExp(`\\b${this.wakeWord}\\b[,.]?\\s*`, 'gi');
    return text.replace(regex, '').trim();
  }

  status() {
    return {
      enabled: config.voice.enabled,
      stt: this.sttAvailable,
      tts: this.ttsAvailable,
      wakeWord: this.wakeWord,
      listening: this.listening,
    };
  }

  shutdown() {
    this.listening = false;
  }
}

module.exports = { VoiceModule };
