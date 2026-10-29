// Configuration
const BACKEND_URL = 'http://localhost:5000';

// Global State
let selectedFile = null;
let currentInterviewData = null;
let checkedQuestionIds = new Set();
let consentAuditLogs = [];

// DOM Elements - Views
const viewHome = document.getElementById('view-home');
const viewNewInterview = document.getElementById('view-new-interview');
const viewSummary = document.getElementById('view-summary');
const viewSettings = document.getElementById('view-settings');

// DOM Elements - Tabs
const tabBtnQuestions = document.getElementById('tab-btn-questions');
const tabBtnBriefing = document.getElementById('tab-btn-briefing');
const tabQuestions = document.getElementById('tab-questions');
const tabBriefing = document.getElementById('tab-briefing');
const tabQuestionsBadge = document.getElementById('tab-questions-badge');
const qbProgressCounter = document.getElementById('qb-progress-counter');
const questionBankContainer = document.getElementById('question-bank-container');

// DOM Elements - Navigation & Actions
const btnGotoNewInterview = document.getElementById('btn-goto-new-interview');
const btnBackToHome = document.getElementById('btn-back-to-home');
const btnBackToSetup = document.getElementById('btn-back-to-setup');
const btnViewSummary = document.getElementById('btn-view-summary');
const btnOpenMeetHome = document.getElementById('btn-open-meet-home');
const btnLaunchCopilot = document.getElementById('btn-launch-copilot');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnBackSettingsToHome = document.getElementById('btn-back-settings-to-home');

// DOM Elements - Settings
const settingsCandidateLabel = document.getElementById('settings-candidate-label');
const settingsQbCount = document.getElementById('settings-qb-count');
const settingsAskedCount = document.getElementById('settings-asked-count');
const settingsConsentCount = document.getElementById('settings-consent-count');
const consentLogsList = document.getElementById('consent-logs-list');
const btnClearActiveInterview = document.getElementById('btn-clear-active-interview');
const btnExportSession = document.getElementById('btn-export-session');
const btnPurgeAllData = document.getElementById('btn-purge-all-data');

// DOM Elements - Status & Alerts
const backendStatusPill = document.getElementById('backend-status-pill');
const backendStatusText = document.getElementById('backend-status-text');
const alertBanner = document.getElementById('alert-banner');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertCloseBtn = document.getElementById('alert-close-btn');
const alertActions = document.getElementById('alert-actions');
const alertBtnRetry = document.getElementById('alert-btn-retry');
const toggleSidebar = document.getElementById('toggle-sidebar');

// DOM Elements - New Interview Form
const formNewInterview = document.getElementById('form-new-interview');
const resumeDropzone = document.getElementById('resume-dropzone');
const resumeFileInput = document.getElementById('resume-file-input');
const dropzoneEmpty = document.getElementById('dropzone-empty');
const dropzoneFilled = document.getElementById('dropzone-filled');
const selectedFileName = document.getElementById('selected-file-name');
const selectedFileSize = document.getElementById('selected-file-size');
const btnRemoveFile = document.getElementById('btn-remove-file');
const jobDescriptionInput = document.getElementById('job-description');
const btnAnalyzeResume = document.getElementById('btn-analyze-resume');
const analyzeSpinner = document.getElementById('analyze-spinner');

// DOM Elements - Summary Briefing
const summarySessionId = document.getElementById('summary-session-id');
const summaryCandidateName = document.getElementById('summary-candidate-name');
const summarySeniorityBadge = document.getElementById('summary-seniority-badge');
const summaryExpBadge = document.getElementById('summary-exp-badge');
const summaryBio = document.getElementById('summary-bio');
const summarySkillsContainer = document.getElementById('summary-skills-container');
const summaryProjectsContainer = document.getElementById('summary-projects-container');
const summaryGapsContainer = document.getElementById('summary-gaps-container');

// DOM Elements - Home Active Session
const activeSessionCard = document.getElementById('active-session-card');
const homeCandidateName = document.getElementById('home-candidate-name');
const homeCandidateSeniority = document.getElementById('home-candidate-seniority');

/**
 * Switch active popup view
 */
function switchView(viewName) {
  if (viewHome) viewHome.classList.remove('active');
  if (viewNewInterview) viewNewInterview.classList.remove('active');
  if (viewSummary) viewSummary.classList.remove('active');
  if (viewSettings) viewSettings.classList.remove('active');

  hideAlert();

  if (viewName === 'home' && viewHome) {
    viewHome.classList.add('active');
  } else if (viewName === 'new-interview' && viewNewInterview) {
    viewNewInterview.classList.add('active');
  } else if (viewName === 'summary' && viewSummary) {
    viewSummary.classList.add('active');
  } else if (viewName === 'settings' && viewSettings) {
    viewSettings.classList.add('active');
    renderSettingsView();
  }
}

/**
 * Switch between Question Bank and Candidate Profile tabs
 */
function switchTab(tabName) {
  if (tabName === 'questions') {
    if (tabBtnQuestions) tabBtnQuestions.classList.add('active');
    if (tabBtnBriefing) tabBtnBriefing.classList.remove('active');
    if (tabQuestions) tabQuestions.classList.add('active');
    if (tabBriefing) tabBriefing.classList.remove('active');
  } else {
    if (tabBtnBriefing) tabBtnBriefing.classList.add('active');
    if (tabBtnQuestions) tabBtnQuestions.classList.remove('active');
    if (tabBriefing) tabBriefing.classList.add('active');
    if (tabQuestions) tabQuestions.classList.remove('active');
  }
}

let healthCheckTimer = null;
let consecutiveHealthFailures = 0;

/**
 * Show notification alert banner with optional retry action
 */
function showAlert(title, message, isError = false, showRetry = false) {
  if (!alertBanner) return;
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertBanner.className = isError ? 'alert-banner error' : 'alert-banner';
  
  if (alertActions && alertBtnRetry) {
    if (showRetry) {
      alertActions.classList.remove('hidden');
    } else {
      alertActions.classList.add('hidden');
    }
  }

  alertBanner.classList.remove('hidden');
}

function hideAlert() {
  if (alertBanner) {
    alertBanner.classList.add('hidden');
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function handleFileSelect(file) {
  if (!file) return;

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    showAlert('Invalid Document Format', 'Please upload a valid candidate resume in PDF format (.pdf).', true);
    return;
  }

  if (file.size === 0) {
    showAlert('Empty Document', 'The selected PDF file is 0 bytes. Please select a valid resume.', true);
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showAlert('File Exceeds Limit', 'Resume PDF must be smaller than 10MB.', true);
    return;
  }

  selectedFile = file;
  selectedFileName.textContent = file.name;
  selectedFileSize.textContent = formatFileSize(file.size);

  dropzoneEmpty.classList.add('hidden');
  dropzoneFilled.classList.remove('hidden');
  hideAlert();
}

function clearSelectedFile() {
  selectedFile = null;
  resumeFileInput.value = '';
  dropzoneFilled.classList.add('hidden');
  dropzoneEmpty.classList.remove('hidden');
}

/**
 * Check backend server health with exponential auto-retry
 */
async function checkBackendHealth() {
  if (!backendStatusPill || !backendStatusText) return;

  backendStatusPill.className = 'status-pill checking';
  backendStatusText.textContent = 'Checking';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      consecutiveHealthFailures = 0;
      backendStatusPill.className = 'status-pill online';
      backendStatusText.textContent = 'Online';
      
      // Auto-dismiss offline connection alert if it was active
      if (alertTitle.textContent.includes('Backend Offline') || alertTitle.textContent.includes('Connection Failed')) {
        hideAlert();
      }
    } else {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
  } catch (err) {
    consecutiveHealthFailures++;
    backendStatusPill.className = 'status-pill offline';
    backendStatusText.textContent = 'Offline';

    if (consecutiveHealthFailures >= 2) {
      showAlert(
        'Backend Offline',
        'Backend server is not reachable on localhost:5000. Start it with `npm run dev` in the /server directory.',
        true,
        true
      );
    }
  } finally {
    // Schedule periodic liveness check (every 10s if online, every 5s if offline)
    if (healthCheckTimer) clearTimeout(healthCheckTimer);
    const delay = consecutiveHealthFailures > 0 ? 5000 : 15000;
    healthCheckTimer = setTimeout(checkBackendHealth, delay);
  }
}

/**
 * Render Question Bank categorized checklist
 */
function renderQuestionBank(questionBank) {
  questionBankContainer.innerHTML = '';
  const questions = questionBank?.questions || [];

  tabQuestionsBadge.textContent = `${questions.length}`;
  updateProgressCounter(questions);

  if (questions.length === 0) {
    questionBankContainer.innerHTML = `
      <div class="qb-category-card">
        <div style="text-align:center; color:var(--text-secondary); font-size:12px; padding:10px;">
          No generated questions available.
        </div>
      </div>
    `;
    return;
  }

  const groups = {};
  questions.forEach(q => {
    const cat = q.category || 'General Technical';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(q);
  });

  Object.keys(groups).forEach(category => {
    const card = document.createElement('div');
    card.className = 'qb-category-group';

    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'qb-category-title';
    categoryTitle.innerHTML = `<span>📌</span> <span>${escapeHTML(category)}</span>`;
    card.appendChild(categoryTitle);

    const list = document.createElement('div');
    list.className = 'qb-questions-list';

    groups[category].forEach(q => {
      const isChecked = checkedQuestionIds.has(q.id);
      const item = document.createElement('div');
      item.className = `qb-question-item ${isChecked ? 'checked' : ''}`;
      item.id = `qb-item-${q.id}`;

      item.innerHTML = `
        <div class="qb-item-main">
          <input type="checkbox" class="qb-checkbox" id="check-${q.id}" ${isChecked ? 'checked' : ''}>
          <label for="check-${q.id}" class="qb-question-text">${escapeHTML(q.question)}</label>
        </div>
      `;

      const checkbox = item.querySelector('.qb-checkbox');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          checkedQuestionIds.add(q.id);
          item.classList.add('checked');
        } else {
          checkedQuestionIds.delete(q.id);
          item.classList.remove('checked');
        }
        updateProgressCounter(questions);
        persistCheckedQuestions();
      });

      list.appendChild(item);
    });

    card.appendChild(list);
    questionBankContainer.appendChild(card);
  });
}

function updateProgressCounter(questions) {
  const total = questions.length;
  const count = checkedQuestionIds.size;
  qbProgressCounter.textContent = `${count} / ${total} Asked`;
}

function persistCheckedQuestions() {
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      checkedQuestionIds: Array.from(checkedQuestionIds)
    });
  }
}

/**
 * Render structured interview summary in the briefing view
 */
function renderSummary(data) {
  if (!data || !data.analysis) return;
  const { analysis, metadata, interviewId, questionBank } = data;

  summarySessionId.textContent = `#${interviewId.slice(0, 8)}`;
  summaryCandidateName.textContent = analysis.candidateName || 'Candidate';
  summarySeniorityBadge.textContent = metadata?.seniority || 'Senior';
  summaryExpBadge.textContent = analysis.yearsOfExperience || 'Experienced';
  summaryBio.textContent = analysis.summary || 'Summary unavailable.';

  // Skills
  summarySkillsContainer.innerHTML = '';
  if (Array.isArray(analysis.skills) && analysis.skills.length > 0) {
    analysis.skills.forEach(skill => {
      const tag = document.createElement('span');
      tag.className = 'skill-tag';
      tag.textContent = skill;
      summarySkillsContainer.appendChild(tag);
    });
  } else {
    summarySkillsContainer.innerHTML = '<span class="skill-tag">General Software Engineering</span>';
  }

  // Notable Projects
  summaryProjectsContainer.innerHTML = '';
  if (Array.isArray(analysis.notableProjects) && analysis.notableProjects.length > 0) {
    analysis.notableProjects.forEach(proj => {
      const projItem = document.createElement('div');
      projItem.className = 'project-item';
      
      const techTags = (proj.technologies || [])
        .map(t => `<span class="tech-tag">${escapeHTML(t)}</span>`)
        .join('');

      projItem.innerHTML = `
        <div class="project-title">${escapeHTML(proj.title || 'Project')}</div>
        <div class="project-desc">${escapeHTML(proj.description || '')}</div>
        ${techTags ? `<div class="project-tech">${techTags}</div>` : ''}
      `;
      summaryProjectsContainer.appendChild(projItem);
    });
  } else {
    summaryProjectsContainer.innerHTML = '<div class="project-item"><div class="project-desc">No specific projects highlighted.</div></div>';
  }

  // Probing Gaps
  summaryGapsContainer.innerHTML = '';
  if (Array.isArray(analysis.knowledgeGapsAndProbingAreas) && analysis.knowledgeGapsAndProbingAreas.length > 0) {
    analysis.knowledgeGapsAndProbingAreas.forEach((gap, idx) => {
      const gapItem = document.createElement('div');
      gapItem.className = 'gap-item';
      gapItem.innerHTML = `
        <div class="gap-header">
          <span class="gap-topic">${idx + 1}. ${escapeHTML(gap.topic || 'Area')}</span>
        </div>
        <div class="gap-reason">${escapeHTML(gap.reasonToProbe || '')}</div>
        <div class="gap-question-box">
          <div class="gap-question-label">Suggested Question</div>
          <div class="gap-question-text">"${escapeHTML(gap.suggestedQuestion || '')}"</div>
        </div>
      `;
      summaryGapsContainer.appendChild(gapItem);
    });
  }

  renderQuestionBank(questionBank);
  updateHomeSessionCard(data);
}

function updateHomeSessionCard(data) {
  if (!data || !data.analysis) {
    activeSessionCard.classList.add('hidden');
    return;
  }
  homeCandidateName.textContent = data.analysis.candidateName || 'Candidate';
  homeCandidateSeniority.textContent = data.metadata?.seniority || 'Mid';
  activeSessionCard.classList.remove('hidden');
}

// -------------------------------------------------------------
// Settings & Stored Data Management View
// -------------------------------------------------------------

function renderSettingsView() {
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['activeInterview', 'alreadyAskedQuestions', 'consentAuditLogs'], (items) => {
      const candidate = items.activeInterview?.analysis?.candidateName || 'None';
      const qbTotal = items.activeInterview?.questionBank?.questions?.length || 0;
      const askedTotal = items.alreadyAskedQuestions?.length || 0;
      const logs = items.consentAuditLogs || [];

      if (settingsCandidateLabel) settingsCandidateLabel.textContent = candidate;
      if (settingsQbCount) settingsQbCount.textContent = `${qbTotal} questions`;
      if (settingsAskedCount) settingsAskedCount.textContent = `${askedTotal} questions`;
      if (settingsConsentCount) settingsConsentCount.textContent = `${logs.length} Logs`;

      // Render Consent Logs
      if (consentLogsList) {
        if (logs.length === 0) {
          consentLogsList.innerHTML = '<div class="consent-empty">No consent records logged yet.</div>';
        } else {
          consentLogsList.innerHTML = logs.map(log => `
            <div class="consent-log-item">
              <div>
                <span class="consent-log-candidate">👤 ${escapeHTML(log.candidateName || 'Candidate')}</span>
                <div style="font-size:9.5px; color:#059669; margin-top:1px;">✅ Consent Confirmed (Disclosure acknowledged)</div>
              </div>
              <span class="consent-log-time">${new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          `).join('');
        }
      }
    });
  }
}

// Clear Active Interview Action
if (btnClearActiveInterview) {
  btnClearActiveInterview.addEventListener('click', () => {
    if (confirm('Clear the active interview session? This resets current questions and candidate profile.')) {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['activeInterview', 'checkedQuestionIds', 'alreadyAskedQuestions'], () => {
          currentInterviewData = null;
          checkedQuestionIds.clear();
          updateHomeSessionCard(null);
          renderSettingsView();
          showAlert('Session Cleared', 'Active interview session removed.', false);
        });
      }
    }
  });
}

// Export Session JSON
if (btnExportSession) {
  btnExportSession.addEventListener('click', () => {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['activeInterview', 'alreadyAskedQuestions', 'consentAuditLogs'], (items) => {
        const exportData = {
          exportedAt: new Date().toISOString(),
          activeInterview: items.activeInterview || null,
          alreadyAskedQuestions: items.alreadyAskedQuestions || [],
          consentAuditLogs: items.consentAuditLogs || []
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview-copilot-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  });
}

// Purge All Stored Data & Logs
if (btnPurgeAllData) {
  btnPurgeAllData.addEventListener('click', () => {
    if (confirm('Are you sure you want to permanently delete ALL stored candidate data, question banks, and local consent audit logs? This cannot be undone.')) {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.clear(() => {
          currentInterviewData = null;
          checkedQuestionIds.clear();
          updateHomeSessionCard(null);
          renderSettingsView();
          showAlert('All Data Purged', 'Local database and audit logs cleared.', false);
        });
      }
    }
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Handle form submission
 */
async function handleAnalyzeSubmit(e) {
  e.preventDefault();

  if (!selectedFile) {
    showAlert('Resume Required', 'Please upload candidate resume in PDF format.', true);
    return;
  }

  const seniorityInput = document.querySelector('input[name="seniority"]:checked');
  const seniority = seniorityInput ? seniorityInput.value : 'Mid';
  const jobDescription = jobDescriptionInput.value.trim();

  const formData = new FormData();
  formData.append('resume', selectedFile);
  formData.append('seniority', seniority);
  formData.append('jobDescription', jobDescription);

  checkedQuestionIds.clear();
  persistCheckedQuestions();

  btnAnalyzeResume.disabled = true;
  analyzeSpinner.classList.remove('hidden');
  hideAlert();

  try {
    const response = await fetch(`${BACKEND_URL}/api/interviews/analyze`, {
      method: 'POST',
      body: formData
    });

    if (response.status === 429) {
      const errData = await response.json().catch(() => ({}));
      showAlert(
        'Rate Limit Reached',
        errData.message || 'Gemini API free tier rate limit reached. Please try again in a moment.',
        false
      );
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server returned error (${response.status})`);
    }

    const result = await response.json();

    if (result.success && result.analysis) {
      currentInterviewData = result;

      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ activeInterview: result });
      }

      renderSummary(result);
      switchTab('questions');
      switchView('summary');
    } else {
      throw new Error('Analysis completed but returned incomplete data.');
    }
  } catch (error) {
    console.error('[Popup] Analysis error:', error);
    showAlert('Analysis Failed', error.message || 'Could not connect to backend server on localhost:5000.', true);
  } finally {
    btnAnalyzeResume.disabled = false;
    analyzeSpinner.classList.add('hidden');
  }
}

/**
 * Initialize storage preferences & active session
 */
function initStorage() {
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['activeInterview', 'sidebarEnabled', 'checkedQuestionIds'], (data) => {
      if (data.sidebarEnabled !== undefined) {
        toggleSidebar.checked = data.sidebarEnabled;
      }
      if (Array.isArray(data.checkedQuestionIds)) {
        checkedQuestionIds = new Set(data.checkedQuestionIds);
      }
      if (data.activeInterview) {
        currentInterviewData = data.activeInterview;
        updateHomeSessionCard(data.activeInterview);
      }
    });

    toggleSidebar.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ sidebarEnabled: enabled }, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'TOGGLE_SIDEBAR',
              enabled: enabled
            }).catch(() => {});
          }
        });
      });
    });
  }
}

function openGoogleMeet() {
  if (chrome && chrome.tabs) {
    chrome.tabs.create({ url: 'https://meet.google.com' });
  } else {
    window.open('https://meet.google.com', '_blank');
  }
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------

resumeDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  resumeDropzone.classList.add('dragover');
});

resumeDropzone.addEventListener('dragleave', () => {
  resumeDropzone.classList.remove('dragover');
});

resumeDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  resumeDropzone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

resumeFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelect(e.target.files[0]);
  }
});

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  clearSelectedFile();
});

formNewInterview.addEventListener('submit', handleAnalyzeSubmit);

btnGotoNewInterview.addEventListener('click', () => switchView('new-interview'));
btnBackToHome.addEventListener('click', () => switchView('home'));
btnBackToSetup.addEventListener('click', () => switchView('new-interview'));

if (btnOpenSettings) btnOpenSettings.addEventListener('click', () => switchView('settings'));
if (btnBackSettingsToHome) btnBackSettingsToHome.addEventListener('click', () => switchView('home'));

btnViewSummary.addEventListener('click', () => {
  if (currentInterviewData) {
    renderSummary(currentInterviewData);
    switchView('summary');
  }
});

tabBtnQuestions.addEventListener('click', () => switchTab('questions'));
tabBtnBriefing.addEventListener('click', () => switchTab('briefing'));

btnOpenMeetHome.addEventListener('click', openGoogleMeet);
btnLaunchCopilot.addEventListener('click', openGoogleMeet);

const btnStartAudioPopup = document.getElementById('btn-start-audio-popup');
if (btnStartAudioPopup) {
  btnStartAudioPopup.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || !tab.url.includes('meet.google.com')) {
        showAlert('Google Meet Tab Required', 'Please switch to your active Google Meet tab first, then click here.', true);
        return;
      }

      btnStartAudioPopup.disabled = true;
      btnStartAudioPopup.textContent = '⏳ Starting Capture...';

      chrome.runtime.sendMessage({
        type: 'START_CAPTURE_SESSION_POPUP',
        tabId: tab.id,
        candidateData: currentInterviewData?.analysis || {}
      }, (response) => {
        btnStartAudioPopup.disabled = false;
        btnStartAudioPopup.textContent = '🎙️ Start Live Audio Capture (Meet Tab)';

        if (response && response.success) {
          showAlert('Capture Active', '🎙️ Live Audio Capture is active! Speech will transcribe live in your Meet sidebar.', false);
        } else {
          showAlert('Capture Failed', response?.error || 'Could not capture tab audio.', true);
        }
      });
    } catch (err) {
      if (btnStartAudioPopup) {
        btnStartAudioPopup.disabled = false;
        btnStartAudioPopup.textContent = '🎙️ Start Live Audio Capture (Meet Tab)';
      }
      showAlert('Error', err.message, true);
    }
  });
}

if (alertCloseBtn) alertCloseBtn.addEventListener('click', hideAlert);
if (alertBtnRetry) {
  alertBtnRetry.addEventListener('click', () => {
    showAlert('Checking Connection', 'Contacting backend server on localhost:5000...', false, false);
    checkBackendHealth();
  });
}
if (backendStatusPill) backendStatusPill.addEventListener('click', checkBackendHealth);

document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  checkBackendHealth();
});
