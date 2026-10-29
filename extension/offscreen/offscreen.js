/**
 * Offscreen Document - InterviewCo-Pilot
 * Handles Chrome tab audio capture, AudioContext processing, 16kHz PCM downsampling,
 * and live streaming to backend Gemini Live WebSocket.
 */

console.log('[Offscreen] Offscreen document loaded and listening for audio capture requests.');

// Configuration
const WS_URL = 'ws://127.0.0.1:5000/api/live-transcript';
const TARGET_SAMPLE_RATE = 16000;

// State
let mediaStream = null;
let audioContext = null;
let sourceNode = null;
let scriptProcessor = null;
let ws = null;
let isCapturing = false;
let isReconnecting = false;
let reconnectAttempts = 0;
let audioBufferQueue = [];
const MAX_BUFFER_CHUNKS = 150;
let candidateContext = {};
let currentTabId = null;

/**
 * Downsample Float32 audio to 16,000Hz Int16 linear PCM
 */
function downsampleToInt16PCM(buffer, inputSampleRate, outputSampleRate = 16000) {
  if (inputSampleRate === outputSampleRate) {
    const pcm = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    const sample = count > 0 ? (accum / count) : 0;
    const s = Math.max(-1, Math.min(1, sample));
    result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function int16ArrayToBase64(int16Array) {
  const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * WebSocket Connection to Gemini Live Proxy
 */
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[Offscreen] Connecting WebSocket to Gemini Live Proxy:', WS_URL);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Offscreen] WebSocket connected to backend.');
    isReconnecting = false;
    reconnectAttempts = 0;

    // Send Init session with candidate context & technical vocabulary
    ws.send(JSON.stringify({
      type: 'INIT_SESSION',
      candidateData: candidateContext
    }));

    flushAudioBuffer();

    // Broadcast status to extension components
    chrome.runtime.sendMessage({
      target: 'content',
      tabId: currentTabId,
      type: 'CAPTURE_STATUS',
      status: 'LISTENING',
      message: 'Tab audio captured and streaming to Gemini Live.'
    }).catch(() => {});
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Relay transcription / suggestion message directly to content script
      chrome.runtime.sendMessage({
        target: 'content',
        tabId: currentTabId,
        ...msg
      }).catch(() => {});
    } catch (err) {
      console.warn('[Offscreen] WebSocket message parse error:', err);
    }
  };

  ws.onclose = (event) => {
    console.log(`[Offscreen] WebSocket closed (code: ${event.code})`);
    if (isCapturing) {
      handleWebSocketReconnect();
    }
  };

  ws.onerror = (err) => {
    console.warn('[Offscreen] WebSocket error:', err);
    if (isCapturing) {
      handleWebSocketReconnect();
    }
  };
}

function handleWebSocketReconnect() {
  if (!isCapturing || isReconnecting) return;

  isReconnecting = true;
  reconnectAttempts++;

  chrome.runtime.sendMessage({
    target: 'content',
    tabId: currentTabId,
    type: 'CAPTURE_STATUS',
    status: 'RECONNECTING',
    message: 'Reconnecting to Gemini Live transcription proxy...'
  }).catch(() => {});

  const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttempts));
  setTimeout(() => {
    if (isCapturing) {
      connectWebSocket();
    }
  }, delay);
}

function sendAudioChunk(base64Chunk) {
  if (!base64Chunk || !isCapturing) return;

  if (ws && ws.readyState === WebSocket.OPEN && !isReconnecting) {
    ws.send(JSON.stringify({
      type: 'AUDIO_CHUNK',
      data: base64Chunk
    }));
  } else {
    if (audioBufferQueue.length < MAX_BUFFER_CHUNKS) {
      audioBufferQueue.push(base64Chunk);
    }
  }
}

function flushAudioBuffer() {
  while (audioBufferQueue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
    const chunk = audioBufferQueue.shift();
    ws.send(JSON.stringify({
      type: 'AUDIO_CHUNK',
      data: chunk
    }));
  }
}

/**
 * Start Audio Capture with Stream ID in Offscreen Document
 */
async function startCapture({ streamId, candidateData = {}, tabId = null }) {
  console.log('[Offscreen] Starting audio capture with streamId:', streamId, 'for tab:', tabId);
  candidateContext = candidateData;
  currentTabId = tabId;

  try {
    // Step 1: getUserMedia with tab capture streamId
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    console.log('[Offscreen] ✅ getUserMedia success. Active audio tracks:', mediaStream.getAudioTracks().length);

    // Step 2: Initialize AudioContext
    audioContext = new AudioContext();
    console.log('[Offscreen] ✅ AudioContext created. Native Sample Rate:', audioContext.sampleRate);

    sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // Step 3: Loop audio to destination so the interviewer can hear the call!
    sourceNode.connect(audioContext.destination);

    // Step 4: High-performance AudioWorklet PCM downsampler
    if (audioContext.audioWorklet) {
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input && input[0] && input[0].length > 0) {
              this.port.postMessage(input[0]);
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      scriptProcessor = new AudioWorkletNode(audioContext, 'pcm-processor');
      scriptProcessor.port.onmessage = (e) => {
        if (!isCapturing) return;
        const inputBuffer = e.data;
        const pcm16 = downsampleToInt16PCM(inputBuffer, audioContext.sampleRate, TARGET_SAMPLE_RATE);
        const base64Chunk = int16ArrayToBase64(pcm16);
        sendAudioChunk(base64Chunk);
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
    } else {
      const bufferSize = 4096;
      scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        if (!isCapturing) return;
        const inputBuffer = e.inputBuffer.getChannelData(0);
        const pcm16 = downsampleToInt16PCM(inputBuffer, audioContext.sampleRate, TARGET_SAMPLE_RATE);
        const base64Chunk = int16ArrayToBase64(pcm16);
        sendAudioChunk(base64Chunk);
      };
      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
    }

    isCapturing = true;
    audioBufferQueue = [];

    // Step 5: Connect WebSocket
    connectWebSocket();

    console.log('[Offscreen] ✅ Full AudioWorklet capture pipeline active and processing.');
    return { success: true };
  } catch (err) {
    console.error('[Offscreen] ❌ getUserMedia or AudioContext failed:', err);
    stopCapture();
    chrome.runtime.sendMessage({
      target: 'content',
      tabId: currentTabId,
      type: 'CAPTURE_STATUS',
      status: 'ERROR',
      error: err.message
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

/**
 * Stop Audio Capture
 */
function stopCapture() {
  console.log('[Offscreen] Stopping audio capture...');
  isCapturing = false;
  isReconnecting = false;
  audioBufferQueue = [];

  if (scriptProcessor) {
    try {
      if (scriptProcessor.port) {
        scriptProcessor.port.onmessage = null;
      }
      scriptProcessor.disconnect();
    } catch (e) {}
    scriptProcessor = null;
  }
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (e) {}
    sourceNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (ws) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'STOP' }));
      }
      ws.close();
    } catch (e) {}
    ws = null;
  }

  console.log('[Offscreen] Audio capture stopped cleanly.');
}

// -------------------------------------------------------------
// Message Listener from Background Script
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  console.log('[Offscreen] Message received from background:', message.type);

  switch (message.type) {
    case 'START_AUDIO_RECORDING':
      startCapture({
        streamId: message.streamId,
        candidateData: message.candidateData,
        tabId: message.tabId
      }).then(sendResponse);
      return true; // async response

    case 'STOP_AUDIO_RECORDING':
      stopCapture();
      sendResponse({ success: true });
      break;

    case 'FORWARD_REQUEST_NEXT_QUESTION':
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'REQUEST_NEXT_QUESTION',
          payload: message.payload
        }));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'WebSocket not open' });
      }
      break;

    default:
      sendResponse({ status: 'UNKNOWN_OFFSCREEN_ACTION' });
      break;
  }
});
