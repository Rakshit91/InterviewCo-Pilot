const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

// Services & Store
const { extractTextFromPDF } = require('./src/services/pdfService');
const { analyzeResume, generateQuestionBank, isRateLimitError } = require('./src/services/geminiService');
const { GeminiLiveSession } = require('./src/services/geminiLiveService');
const { generateNextQuestionStream } = require('./src/services/suggestionService');
const interviewStore = require('./src/store/interviewStore');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = http.createServer(app);

// Configure Multer for memory storage (max 10MB PDF)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF resume files are supported.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'interview-copilot-backend',
    storage: 'SQLite (file-backed)',
    timestamp: new Date().toISOString(),
    port: PORT,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY),
    liveModel: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe-live'
  });
});

// -------------------------------------------------------------
// Interview Endpoints (SQLite Backed)
// -------------------------------------------------------------

/**
 * POST /api/interviews/analyze
 */
app.post('/api/interviews/analyze', upload.single('resume'), async (req, res) => {
  try {
    const file = req.file;
    const seniority = req.body.seniority || 'Mid';
    const jobDescription = req.body.jobDescription || '';

    if (!file) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Please upload a valid PDF resume file.'
      });
    }

    console.log(`[Server] Received resume analysis request: ${file.originalname} (${file.size} bytes), Seniority: ${seniority}`);

    // Step 1: Extract text from PDF
    let resumeText = '';
    try {
      resumeText = await extractTextFromPDF(file.buffer);
    } catch (pdfErr) {
      return res.status(400).json({
        error: 'PDF_PARSE_ERROR',
        message: pdfErr.message || 'Failed to read text from uploaded PDF.'
      });
    }

    // Step 2: Stage 1 - Gemini structured resume analysis
    let analysis;
    try {
      console.log('[Server] Running Stage 1: Resume Analysis...');
      analysis = await analyzeResume({
        resumeText,
        seniority,
        jobDescription
      });
    } catch (aiErr) {
      if (aiErr.status === 429 || isRateLimitError(aiErr)) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Gemini API free-tier rate limit reached. Please try again in a moment.'
        });
      }
      throw aiErr;
    }

    // Step 3: Stage 2 - Gemini Question Bank generation (8-10 questions)
    let questionBank;
    try {
      console.log('[Server] Running Stage 2: Question Bank Generation...');
      questionBank = await generateQuestionBank({
        candidateAnalysis: analysis,
        seniority,
        jobDescription
      });
    } catch (qbErr) {
      console.warn('[Server] Stage 2 Question Bank generation warning:', qbErr.message);
      if (qbErr.status === 429 || isRateLimitError(qbErr)) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Gemini API free-tier rate limit reached during question generation. Please try again in a moment.'
        });
      }
      questionBank = { totalQuestions: 0, questions: [] };
    }

    // Step 4: Generate Interview ID & store in persistent SQLite database
    const interviewId = crypto.randomUUID();
    const storedRecord = interviewStore.saveInterview(interviewId, {
      filename: file.originalname,
      seniority,
      jobDescription,
      resumeText,
      analysis,
      questionBank
    });

    console.log(`[Server] Interview session created & persisted to SQLite: ${interviewId}`);

    return res.status(200).json({
      success: true,
      interviewId,
      analysis: storedRecord.analysis,
      questionBank: storedRecord.questionBank,
      metadata: storedRecord.metadata
    });

  } catch (error) {
    console.error('[Server] Error in /api/interviews/analyze:', error);

    if (error.status === 429 || isRateLimitError(error)) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Gemini API free-tier rate limit reached. Please try again in a moment.'
      });
    }

    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred during resume analysis.'
    });
  }
});

/**
 * GET /api/interviews/:id
 */
app.get('/api/interviews/:id', (req, res) => {
  const { id } = req.params;
  const interview = interviewStore.getInterview(id);

  if (!interview) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Interview session with ID '${id}' not found.`
    });
  }

  res.json({
    success: true,
    interview
  });
});

/**
 * GET /api/interviews
 */
app.get('/api/interviews', (req, res) => {
  const interviews = interviewStore.listInterviews();
  res.json({
    success: true,
    count: interviews.length,
    interviews
  });
});

/**
 * POST /api/interviews/:id/transcripts (Add transcript turn)
 */
app.post('/api/interviews/:id/transcripts', (req, res) => {
  const { id } = req.params;
  const { speaker, text, language, source, timestamp } = req.body;

  interviewStore.addTranscriptTurn(id, {
    speaker,
    text,
    language,
    source,
    timestamp
  });

  res.json({ success: true, message: 'Transcript turn recorded in SQLite.' });
});

/**
 * POST /api/interviews/:id/questions (Record asked question)
 */
app.post('/api/interviews/:id/questions', (req, res) => {
  const { id } = req.params;
  const { question, reasoning, source, timestamp } = req.body;

  interviewStore.addAskedQuestion(id, {
    question,
    reasoning,
    source,
    timestamp
  });

  res.json({ success: true, message: 'Asked question recorded in SQLite.' });
});

/**
 * GET /api/interviews/:id/debrief (Full Interview Summary)
 */
app.get('/api/interviews/:id/debrief', (req, res) => {
  const { id } = req.params;
  const debrief = interviewStore.getInterviewDebrief(id);

  if (!debrief) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Interview session with ID '${id}' not found.`
    });
  }

  res.json({
    success: true,
    debrief
  });
});

/**
 * GET /api/interviews/:id/export (Markdown or Plain Text export)
 */
app.get('/api/interviews/:id/export', (req, res) => {
  const { id } = req.params;
  const format = (req.query.format || 'markdown').toLowerCase();

  if (format === 'text' || format === 'txt') {
    const textContent = interviewStore.generateTextExport(id);
    if (!textContent) {
      return res.status(404).send('Interview not found.');
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="interview-${id}.txt"`);
    return res.send(textContent);
  } else {
    const mdContent = interviewStore.generateMarkdownExport(id);
    if (!mdContent) {
      return res.status(404).send('Interview not found.');
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="interview-${id}.md"`);
    return res.send(mdContent);
  }
});

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'FILE_UPLOAD_ERROR',
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      error: 'UPLOAD_ERROR',
      message: err.message
    });
  }
  next();
});

// Root fallback
app.get('/', (req, res) => {
  res.json({
    message: 'InterviewCo-Pilot Server is running with SQLite storage. Access /health for service status.'
  });
});

// -------------------------------------------------------------
// Dev Extension Hot-Reloader (Automatic Extension Refresh)
// -------------------------------------------------------------
const devReloadWss = new WebSocket.Server({ noServer: true });
const devReloadClients = new Set();

devReloadWss.on('connection', (ws) => {
  devReloadClients.add(ws);
  ws.on('close', () => devReloadClients.delete(ws));
});

// Watch extension folder
const EXTENSION_DIR = path.join(__dirname, '..', 'extension');
let debounceReloadTimer = null;

if (fs.existsSync(EXTENSION_DIR)) {
  fs.watch(EXTENSION_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.includes('.git') || filename.includes('node_modules')) return;

    if (debounceReloadTimer) clearTimeout(debounceReloadTimer);
    debounceReloadTimer = setTimeout(() => {
      console.log(`[Dev HotReload] Detected change in extension file: ${filename}. Broadcasting auto-reload...`);
      for (const client of devReloadClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'EXTENSION_RELOAD', file: filename, timestamp: Date.now() }));
        }
      }
    }, 250);
  });
  console.log(`[Dev HotReload] Watching extension directory for auto-reloading: ${EXTENSION_DIR}`);
}

// -------------------------------------------------------------
// WebSocket Server for Gemini Live Transcription & Streaming Suggestions
// -------------------------------------------------------------
const liveTranscribeWss = new WebSocket.Server({ noServer: true });

liveTranscribeWss.on('connection', (clientWs, req) => {
  console.log('[WebSocket Server] New client connected for live transcription proxy.');

  let geminiSession = null;
  let sessionInitialized = false;

  function initSession(customVocabulary = [], candidateContext = {}) {
    if (geminiSession) {
      geminiSession.destroy();
    }

    sessionInitialized = true;
    geminiSession = new GeminiLiveSession({
      apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY,
      customVocabulary,
      candidateContext
    });

    geminiSession.on('ready', (info) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'STATUS',
          status: 'READY',
          vocabularyCount: info?.vocabularyCount || customVocabulary.length,
          message: 'Gemini Live transcription session ready with custom vocabulary priming.'
        }));
      }
    });

    geminiSession.on('transcript', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'TRANSCRIPT_CHUNK',
          text: data.text,
          isFinal: data.isFinal,
          language: data.language,
          timestamp: data.timestamp
        }));
      }
    });

    geminiSession.on('language_detected', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'LANGUAGE_DETECTED',
          language: data.language
        }));
      }
    });

    geminiSession.on('turn_complete', (data) => {
      console.log('[WebSocket Server] Relaying TURN_COMPLETE (Source: GEMINI_VAD_SIGNAL) to client.');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'TURN_COMPLETE',
          source: 'GEMINI_VAD_SIGNAL',
          language: data.language,
          timestamp: data.timestamp
        }));
      }
    });

    geminiSession.on('speaker_interrupted', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'SPEAKER_INTERRUPTED',
          timestamp: data.timestamp
        }));
      }
    });

    geminiSession.on('error', (err) => {
      console.warn('[WebSocket Server] GeminiLiveSession error:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'ERROR',
          message: err.message
        }));
      }
    });

    geminiSession.connect().catch((err) => {
      console.error('[WebSocket Server] Failed to connect Gemini Live session:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'ERROR',
          message: `Failed to connect to Gemini Live: ${err.message}`
        }));
      }
    });
  }

  const defaultInitTimeout = setTimeout(() => {
    if (!sessionInitialized) {
      console.log('[WebSocket Server] No INIT_SESSION received within 600ms. Initializing with default vocabulary.');
      initSession();
    }
  }, 600);

  // Handle messages from client
  clientWs.on('message', async (message) => {
    try {
      const parsed = JSON.parse(message.toString('utf-8'));

      if (parsed.type === 'INIT_SESSION') {
        clearTimeout(defaultInitTimeout);
        const candidateData = parsed.candidateData || {};
        const skills = candidateData.skills || [];
        const projectTitles = (candidateData.projects || []).map(p => typeof p === 'string' ? p : p.title).filter(Boolean);
        const vocab = Array.from(new Set([...skills, ...projectTitles]));
        
        console.log(`[WebSocket Server] Priming Gemini Live session with ${vocab.length} candidate vocabulary terms.`);
        initSession(vocab, candidateData);

      } else if (parsed.type === 'AUDIO_CHUNK' && parsed.data) {
        if (!sessionInitialized) {
          clearTimeout(defaultInitTimeout);
          initSession();
        }
        if (geminiSession) {
          geminiSession.sendAudioChunk(parsed.data);
        }

      } else if (parsed.type === 'REQUEST_NEXT_QUESTION') {
        const payload = parsed.payload || {};
        console.log(`[WebSocket Server] Generating next question stream for candidate: ${payload.resumeSummary?.candidateName || 'Candidate'}`);

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'SUGGESTION_START',
            timestamp: new Date().toISOString()
          }));
        }

        try {
          const fullResult = await generateNextQuestionStream({
            lastAnswerTranscript: payload.lastAnswerTranscript || '',
            resumeSummary: payload.resumeSummary || {},
            questionBank: payload.questionBank || {},
            alreadyAskedQuestions: payload.alreadyAskedQuestions || [],
            onChunk: (chunkText) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'SUGGESTION_CHUNK',
                  text: chunkText
                }));
              }
            }
          });

          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'SUGGESTION_DONE',
              fullText: fullResult,
              timestamp: new Date().toISOString()
            }));
          }
        } catch (err) {
          console.error('[WebSocket Server] Error streaming suggestion:', err.message);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'SUGGESTION_ERROR',
              message: err.message || 'Could not generate follow-up at this time. Pick a question from your Question Bank.'
            }));
          }
        }

      } else if (parsed.type === 'STOP') {
        if (geminiSession) {
          geminiSession.destroy();
        }
      }
    } catch (e) {
      console.error('[WebSocket Server] Error processing client message:', e.message);
    }
  });

  clientWs.on('close', () => {
    clearTimeout(defaultInitTimeout);
    console.log('[WebSocket Server] Client disconnected. Destroying Gemini Live session...');
    if (geminiSession) {
      geminiSession.destroy();
      geminiSession = null;
    }
  });

  clientWs.on('error', (err) => {
    clearTimeout(defaultInitTimeout);
    console.error('[WebSocket Server] Client connection error:', err.message);
    if (geminiSession) {
      geminiSession.destroy();
      geminiSession = null;
    }
  });
});

// Route HTTP Upgrade to correct WebSocket Server
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;

  if (pathname === '/api/live-transcript') {
    liveTranscribeWss.handleUpgrade(request, socket, head, (ws) => {
      liveTranscribeWss.emit('connection', ws, request);
    });
  } else if (pathname === '/api/dev/extension-reload') {
    devReloadWss.handleUpgrade(request, socket, head, (ws) => {
      devReloadWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`[InterviewCo-Pilot Server] Running at http://localhost:${PORT}`);
  console.log(`[InterviewCo-Pilot Server] SQLite Database active at server/data/interview_copilot.db`);
  console.log(`[InterviewCo-Pilot Server] Live Transcription WebSocket: ws://localhost:${PORT}/api/live-transcript`);
  console.log(`[InterviewCo-Pilot Server] Dev Hot-Reload WebSocket: ws://localhost:${PORT}/api/dev/extension-reload`);
});
