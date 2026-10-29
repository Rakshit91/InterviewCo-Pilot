const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * GeminiLiveSession
 * Manages a real-time bidirectional WebSocket session to Google's Gemini Live API
 * with Custom Technical Vocabulary Biasing & Native VAD Signal Relaying
 */
class GeminiLiveSession extends EventEmitter {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    this.model = options.model || process.env.GEMINI_TRANSCRIBE_MODEL || 'models/gemini-2.5-flash-native-audio-latest';
    this.customVocabulary = options.customVocabulary || [];
    this.candidateContext = options.candidateContext || {};
    this.ws = null;
    this.isConnected = false;
    this.isReady = false;
    this.isDestroyed = false;
    this.pendingAudioQueue = [];
    this.currentLanguage = 'English';
  }

  /**
   * Set or update custom vocabulary & candidate domain terms
   */
  setContext({ customVocabulary = [], candidateContext = {} }) {
    this.customVocabulary = customVocabulary;
    this.candidateContext = candidateContext;
  }

  /**
   * Connect to Gemini Live WebSocket
   */
  async connect() {
    if (this.isDestroyed) return;

    if (!this.apiKey || this.apiKey === 'your_api_key_here') {
      const err = new Error('GEMINI_API_KEY is not configured in server/.env');
      this.emit('error', err);
      throw err;
    }

    const host = 'generativelanguage.googleapis.com';
    const path = `/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    const url = `wss://${host}${path}`;

    console.log(`[GeminiLiveSession] Connecting to Gemini Live API (${this.model}) with ${this.customVocabulary.length} custom vocabulary terms.`);

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[GeminiLiveSession] WebSocket connection established. Sending setup frame...');
        this.isConnected = true;
        this.sendSetupFrame();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err) => {
        console.error('[GeminiLiveSession] WebSocket error:', err.message);
        this.emit('error', err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[GeminiLiveSession] WebSocket closed (code: ${code}, reason: ${reason?.toString() || 'none'})`);
        this.isConnected = false;
        this.isReady = false;
        this.emit('close', { code, reason: reason?.toString() });
      });

    } catch (err) {
      console.error('[GeminiLiveSession] Failed to initialize WebSocket:', err);
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Build tailored system instruction with custom technical vocabulary
   */
  buildSystemInstruction() {
    const vocabList = Array.isArray(this.customVocabulary) && this.customVocabulary.length > 0
      ? this.customVocabulary.join(', ')
      : 'Kubernetes, GraphQL, eBPF, gRPC, Kafka, Cassandra, PostgreSQL, Redis, Raft, Docker, Microservices, TypeScript, Next.js, Python, AWS, CI/CD';

    const candidateName = this.candidateContext?.candidateName || 'the candidate';
    const seniority = this.candidateContext?.seniority || 'technical';
    const projectDetails = Array.isArray(this.candidateContext?.projects) && this.candidateContext.projects.length > 0
      ? `Projects / Systems mentioned: ${this.candidateContext.projects.join(', ')}`
      : '';

    return `
You are a real-time verbatim speech-to-text transcription engine for a live technical job interview (${seniority} level) with ${candidateName}.

### MANDATORY DOMAIN VOCABULARY & TECHNICAL TERMS:
The following specific technical terms, frameworks, tools, and project names are expected in this conversation:
${vocabList}
${projectDetails ? `\n${projectDetails}` : ''}

### ACCURACY & TRANSCRIPTION RULES:
1. STRICT TECHNICAL TERM BIASING: Always prioritize the exact technical terms and spellings listed above over phonetically similar common English words.
   Examples:
   - "Kubernetes" (NOT "cooper netties" or "coopernettes")
   - "GraphQL" (NOT "graph QL" or "graphical")
   - "eBPF" (NOT "EB PF" or "epbf")
   - "gRPC" (NOT "G RPC" or "gr PC")
   - "Kafka" (NOT "kafkaesque" or "calf car")
   - "PostgreSQL" or "Postgres" (NOT "post grease" or "postgres cue L")
   - "Raft" (NOT "raft/wrapped")
   - "Redis" (NOT "read this" or "red is")
   - "Cassandra", "Microservices", "CI/CD", "QPS", "p99", "Latency", "Throughput"
2. OUTPUT ONLY VERBATIM SPOKEN DIALOGUE. Do not answer questions, do not explain code, and do not act as a conversational assistant.
3. LANGUAGE DETECTION: If the speaker speaks in a non-English language, prefix the turn with [Lang: LanguageName] (e.g. [Lang: Spanish], [Lang: Hindi], [Lang: French], [Lang: German]).
`;
  }

  /**
   * Send the initial Bidi setup configuration frame
   */
  sendSetupFrame() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const systemText = this.buildSystemInstruction();

    const setupMessage = {
      setup: {
        model: this.model.startsWith('models/') ? this.model : `models/${this.model}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck"
              }
            }
          }
        },
        systemInstruction: {
          parts: [
            {
              text: systemText
            }
          ]
        }
      }
    };

    this.ws.send(JSON.stringify(setupMessage), (err) => {
      if (err) {
        console.error('[GeminiLiveSession] Error sending setup frame:', err);
      } else {
        console.log('[GeminiLiveSession] Setup frame sent with custom vocabulary priming.');
        this.isReady = true;
        this.emit('ready', { vocabularyCount: this.customVocabulary.length });
        this.flushPendingAudio();
      }
    });
  }

  /**
   * Send a base64 encoded 16kHz PCM audio chunk to Gemini Live API
   */
  sendAudioChunk(base64Pcm) {
    if (!base64Pcm || this.isDestroyed) return;

    if (!this.isConnected || !this.isReady || this.ws?.readyState !== WebSocket.OPEN) {
      if (this.pendingAudioQueue.length < 100) {
        this.pendingAudioQueue.push(base64Pcm);
      }
      return;
    }

    const message = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64Pcm
          }
        ]
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      console.warn('[GeminiLiveSession] Error writing audio chunk to socket:', err.message);
      this.pendingAudioQueue.push(base64Pcm);
    }
  }

  /**
   * Flush queued audio chunks after connection/reconnection
   */
  flushPendingAudio() {
    if (this.pendingAudioQueue.length === 0) return;
    console.log(`[GeminiLiveSession] Flushing ${this.pendingAudioQueue.length} buffered audio chunks to Gemini...`);
    
    while (this.pendingAudioQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const chunk = this.pendingAudioQueue.shift();
      this.sendAudioChunk(chunk);
    }
  }

  /**
   * Handle incoming messages from Gemini Live WebSocket
   */
  handleMessage(raw) {
    try {
      const msgStr = typeof raw === 'string' ? raw : raw.toString('utf-8');
      const response = JSON.parse(msgStr);

      if (response.setupComplete) {
        console.log('[GeminiLiveSession] Received setupComplete from Gemini Live API.');
        this.isReady = true;
        this.emit('ready', { vocabularyCount: this.customVocabulary.length });
        this.flushPendingAudio();
        return;
      }

      if (response.serverContent) {
        const modelTurn = response.serverContent.modelTurn;
        if (modelTurn && Array.isArray(modelTurn.parts)) {
          for (const part of modelTurn.parts) {
            if (part.text) {
              let text = part.text;

              // Check for Language Detection Tag (e.g. [Lang: Spanish])
              const langMatch = text.match(/\[Lang:\s*([a-zA-Z\s]+)\]/i);
              if (langMatch && langMatch[1]) {
                const detectedLang = langMatch[1].trim();
                this.currentLanguage = detectedLang;
                text = text.replace(/\[Lang:\s*[a-zA-Z\s]+\]/gi, '').trim();
                this.emit('language_detected', { language: this.currentLanguage });
              }

              if (text.length > 0) {
                this.emit('transcript', {
                  text: text,
                  isFinal: Boolean(response.serverContent.turnComplete),
                  language: this.currentLanguage,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }

        // Native Gemini VAD Signal: turnComplete or interrupted
        if (response.serverContent.turnComplete) {
          console.log('[GeminiLiveSession] Native Gemini VAD: turnComplete signal received.');
          this.emit('turn_complete', {
            source: 'GEMINI_VAD_SIGNAL',
            language: this.currentLanguage,
            timestamp: new Date().toISOString()
          });
        }

        if (response.serverContent.interrupted) {
          console.log('[GeminiLiveSession] Native Gemini VAD: speaker interrupted signal received.');
          this.emit('speaker_interrupted', {
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (err) {
      console.error('[GeminiLiveSession] Error parsing message from Gemini Live API:', err.message);
    }
  }

  /**
   * Cleanly terminate session
   */
  destroy() {
    this.isDestroyed = true;
    this.isConnected = false;
    this.isReady = false;
    this.pendingAudioQueue = [];

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    console.log('[GeminiLiveSession] Session destroyed.');
  }
}

module.exports = {
  GeminiLiveSession
};
