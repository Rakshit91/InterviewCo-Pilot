/**
 * Background Service Worker - InterviewCo-Pilot (Manifest V3)
 * Orchestrates Chrome Offscreen Document creation and Tab Capture MediaStreamId delegation.
 */

console.log('[Background] Service worker initialized.');

const OFFSCREEN_PATH = 'offscreen/offscreen.html';

// Lifecycle: Extension installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  chrome.storage.local.set({
    sidebarEnabled: true,
    backendUrl: 'http://localhost:5000'
  });
});

/**
 * Ensure an Offscreen Document is active for audio processing
 */
async function ensureOffscreenDocument() {
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const existing = await chrome.offscreen.hasDocument();
    if (existing) {
      console.log('[Background] Offscreen document already exists.');
      return;
    }
  }

  console.log('[Background] Creating new Offscreen Document at:', OFFSCREEN_PATH);
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Capture Google Meet tab audio stream and process for live Gemini transcription'
  });
  console.log('[Background] ✅ Offscreen document created successfully.');
}

/**
 * Stop & Close Offscreen Document
 */
async function closeOffscreenDocument() {
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
      console.log('[Background] Offscreen document closed.');
    }
  }
}

// -------------------------------------------------------------
// Auto Hot-Reloader Client (Listens to local Node server)
// -------------------------------------------------------------
const DEV_RELOAD_WS_URL = 'ws://localhost:5000/api/dev/extension-reload';
let reloadWs = null;

function connectDevHotReloader() {
  try {
    reloadWs = new WebSocket(DEV_RELOAD_WS_URL);

    reloadWs.onopen = () => {
      console.log('[HotReload] Connected to InterviewCo-Pilot dev reloader.');
    };

    reloadWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'EXTENSION_RELOAD') {
          console.log(`[HotReload] File changed: ${msg.file}. Automatically reloading extension...`);
          chrome.runtime.reload();
        }
      } catch (e) {}
    };

    reloadWs.onclose = () => {
      setTimeout(connectDevHotReloader, 3000);
    };

    reloadWs.onerror = () => {
      try { reloadWs.close(); } catch (e) {}
    };
  } catch (err) {
    setTimeout(connectDevHotReloader, 5000);
  }
}

connectDevHotReloader();

let activeMeetTabId = null;

// -------------------------------------------------------------
// Message Listener for Tab Capture & Offscreen Delegation
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message.type, 'target:', message.target, 'from:', sender.tab?.id || sender.url);

  // Relay messages from Offscreen document to the active Google Meet tab's Content Script
  if (message.target === 'content') {
    const targetTabId = message.tabId || activeMeetTabId;
    if (targetTabId) {
      chrome.tabs.sendMessage(targetTabId, message).catch(() => {});
    } else {
      chrome.tabs.query({ url: '*://meet.google.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        });
      });
    }
    return false;
  }

  switch (message.type) {
    case 'PING':
      sendResponse({ status: 'PONG', timestamp: Date.now() });
      break;

    case 'GET_STATUS':
      chrome.storage.local.get(['sidebarEnabled', 'backendUrl', 'activeInterview'], (data) => {
        sendResponse({ status: 'OK', config: data });
      });
      return true;

    case 'START_CAPTURE_SESSION_POPUP':
    case 'START_CAPTURE_SESSION': {
      (async () => {
        try {
          let tabId = message.tabId || sender.tab?.id;
          if (!tabId) {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = activeTab?.id;
          }
          if (!tabId) {
            throw new Error('No active Google Meet tab found for audio capture.');
          }

          activeMeetTabId = tabId;
          console.log('[Background] Step 1: Requesting tab mediaStreamId for tab:', tabId);

          // Get mediaStreamId for the active Google Meet tab
          const streamId = await new Promise((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
              if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
              }
              if (!id) {
                return reject(new Error('chrome.tabCapture.getMediaStreamId returned empty stream ID.'));
              }
              resolve(id);
            });
          });

          console.log('[Background] ✅ Step 1 Success: Obtained streamId:', streamId);

          // Step 2: Ensure Offscreen Document exists
          console.log('[Background] Step 2: Initializing Offscreen Document...');
          await ensureOffscreenDocument();

          // Step 3: Send streamId & candidate context to Offscreen Document
          console.log('[Background] Step 3: Delegating audio capture to Offscreen Document...');
          const result = await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'START_AUDIO_RECORDING',
            streamId: streamId,
            candidateData: message.candidateData || {},
            tabId: tabId
          });

          console.log('[Background] ✅ Step 3 Success: Offscreen audio pipeline started:', result);
          sendResponse({ success: true, streamId });
        } catch (err) {
          console.error('[Background] ❌ Audio capture delegation failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();

      return true; // async response
    }

    case 'STOP_CAPTURE_SESSION': {
      (async () => {
        try {
          await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'STOP_AUDIO_RECORDING'
          }).catch(() => {});

          await closeOffscreenDocument().catch(() => {});
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    case 'REQUEST_NEXT_QUESTION_OFFSCREEN': {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'FORWARD_REQUEST_NEXT_QUESTION',
        payload: message.payload
      }).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    default:
      // Don't intercept other messages
      break;
  }
});
