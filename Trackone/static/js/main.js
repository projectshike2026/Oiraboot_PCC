/**
 * Document Intelligence Studio - Main Client Controller (Track 1)
 * Handles Chat, Quiz Generation, Grading, Citations, Reader & Multi-PDF Vault
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    currentTab: 'chat',
    theme: localStorage.getItem('doc_intel_theme') || 'light',
    lang: localStorage.getItem('doc_intel_lang') || 'en',
    documents: [],
    activeQuiz: null,
    userAnswers: {},
    isGraded: false,
    reader: {
      docId: '',
      docName: '',
      pageNumber: 1,
      totalPages: 1,
      searchTerm: ''
    }
  };

  // DOM Elements
  const htmlRoot = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const langToggleBtn = document.getElementById('lang-toggle-btn');
  const langLabel = document.getElementById('lang-label');
  const activeDocsBadge = document.getElementById('active-docs-badge');

  // Navigation Tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Chat Elements
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatViewport = document.getElementById('chat-viewport');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const promptChips = document.querySelectorAll('.prompt-chip');

  // Quiz Elements
  const quizCountSelect = document.getElementById('quiz-count-select');
  const quizDifficultySelect = document.getElementById('quiz-difficulty-select');
  const quizLangSelect = document.getElementById('quiz-lang-select');
  const generateQuizBtn = document.getElementById('generate-quiz-btn');
  const generateBtnText = document.getElementById('generate-btn-text');
  const quizEmptyState = document.getElementById('quiz-empty-state');
  const quizLoadingState = document.getElementById('quiz-loading-state');
  const quizActiveWrap = document.getElementById('quiz-active-wrap');
  const questionsList = document.getElementById('questions-list');
  const submitQuizBtn = document.getElementById('submit-quiz-btn');
  const retakeQuizBtn = document.getElementById('retake-quiz-btn');
  const downloadQuizBtn = document.getElementById('download-quiz-btn');
  const scoreboardBanner = document.getElementById('scoreboard-banner');
  const scoreDisplay = document.getElementById('score-display');
  const scorePercentageDisplay = document.getElementById('score-percentage-display');
  const scoreHeadline = document.getElementById('score-headline');
  const answeredCountBadge = document.getElementById('answered-count-badge');

  // Page Reader Elements
  const readerDocSelect = document.getElementById('reader-doc-select');
  const readerPrevPage = document.getElementById('reader-prev-page');
  const readerNextPage = document.getElementById('reader-next-page');
  const readerPageIndicator = document.getElementById('reader-page-indicator');
  const readerSearchInput = document.getElementById('reader-search-input');
  const readerCardDocName = document.getElementById('reader-card-doc-name');
  const readerCardPageBadge = document.getElementById('reader-card-page-badge');
  const readerCardText = document.getElementById('reader-card-text');

  // Vault & Upload Elements
  const quickUploadBtn = document.getElementById('quick-upload-trigger-btn');
  const sidebarFileInput = document.getElementById('sidebar-file-input');
  const dropzone = document.getElementById('upload-dropzone');
  const dropzoneFileInput = document.getElementById('dropzone-file-input');
  const browseFilesBtn = document.getElementById('browse-files-btn');
  const uploadStatusArea = document.getElementById('upload-status-area');
  const restoreSampleBtn = document.getElementById('restore-sample-btn');
  const vaultDocList = document.getElementById('vault-doc-list');
  const vaultTableBody = document.getElementById('vault-table-body');

  /* ==========================================================================
     Theme & Language Setup
     ========================================================================== */

  function applyTheme(theme) {
    state.theme = theme;
    htmlRoot.setAttribute('data-theme', theme);
    localStorage.setItem('doc_intel_theme', theme);
  }

  themeToggleBtn.addEventListener('click', () => {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  });
  applyTheme(state.theme);

  function applyLanguage(lang) {
    state.lang = lang;
    langLabel.textContent = lang === 'en' ? 'বাংলা' : 'EN';
    localStorage.setItem('doc_intel_lang', lang);

    if (quizLangSelect) {
      quizLangSelect.value = lang;
    }

    if (chatInput) {
      chatInput.placeholder = lang === 'bn'
        ? 'আপনার সক্রিয় PDF-এর ওপর ভিত্তি করে প্রশ্ন করুন (বাংলা বা English)...'
        : 'Ask a question strictly grounded in your active PDFs (English or বাংলা)...';
    }
  }

  langToggleBtn.addEventListener('click', () => {
    applyLanguage(state.lang === 'en' ? 'bn' : 'en');
    showToast(`Switched language to ${state.lang === 'bn' ? 'বাংলা (Bangla)' : 'English'}`);
  });
  applyLanguage(state.lang);

  /* ==========================================================================
     Tab Navigation
     ========================================================================== */

  function switchTab(tabId) {
    state.currentTab = tabId;
    navTabs.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-panel-${tabId}`);
    });

    if (tabId === 'reader' && state.reader.docId) {
      loadPageContent(state.reader.docId, state.reader.pageNumber, state.reader.searchTerm);
    }
  }

  navTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  /* ==========================================================================
     Document Vault & Sync
     ========================================================================== */

  async function refreshDocumentsList() {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.ok) {
        state.documents = data.documents;
        renderSidebarDocuments();
        renderVaultTable();
        populateReaderDropdown();

        const activeCount = state.documents.filter(d => d.enabled).length;
        activeDocsBadge.textContent = `${activeCount} PDF${activeCount === 1 ? '' : 's'} Active`;
      }
    } catch (e) {
      console.error('Failed to refresh documents:', e);
    }
  }

  function renderSidebarDocuments() {
    vaultDocList.innerHTML = '';
    state.documents.forEach(doc => {
      const card = document.createElement('div');
      card.className = `vault-doc-card ${doc.enabled ? '' : 'disabled'}`;
      card.setAttribute('data-doc-id', doc.id);

      card.innerHTML = `
        <div class="doc-card-top">
          <div class="doc-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pdf-icon">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="doc-pages">${doc.totalPages} Pages</span>
          </div>
          <label class="toggle-switch" title="Toggle document active/inactive for search">
            <input type="checkbox" class="doc-toggle-checkbox" data-doc-id="${doc.id}" ${doc.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="doc-name" title="${doc.name}">${doc.name}</div>
        <div class="doc-actions">
          <button class="doc-action-btn read-doc-btn" data-doc-id="${doc.id}" data-doc-name="${doc.name}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            Inspect
          </button>
          ${doc.id !== 'sample-cs301' ? `
          <button class="doc-action-btn delete-doc-btn" data-doc-id="${doc.id}" title="Delete Document">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>` : ''}
        </div>
      `;
      vaultDocList.appendChild(card);
    });
    bindDocumentActions();
  }

  function renderVaultTable() {
    if (!vaultTableBody) return;
    vaultTableBody.innerHTML = '';
    state.documents.forEach(doc => {
      const row = document.createElement('tr');
      row.setAttribute('data-doc-id', doc.id);
      row.innerHTML = `
        <td>
          <span class="status-badge ${doc.enabled ? 'active-badge' : 'inactive-badge'}">
            ${doc.enabled ? 'Active for RAG' : 'Excluded'}
          </span>
        </td>
        <td class="table-doc-name"><strong>${doc.name}</strong></td>
        <td>${doc.totalPages} Pages</td>
        <td class="table-actions">
          <button class="small-btn outline-btn read-doc-btn" data-doc-id="${doc.id}" data-doc-name="${doc.name}">Inspect Pages</button>
          ${doc.id !== 'sample-cs301' ? `<button class="small-btn danger-btn delete-doc-btn" data-doc-id="${doc.id}">Delete</button>` : ''}
        </td>
      `;
      vaultTableBody.appendChild(row);
    });
  }

  function bindDocumentActions() {
    // Toggles
    document.querySelectorAll('.doc-toggle-checkbox').forEach(chk => {
      chk.onchange = async (e) => {
        const docId = e.target.getAttribute('data-doc-id');
        const enabled = e.target.checked;
        await fetch('/api/documents/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: docId, enabled })
        });
        refreshDocumentsList();
      };
    });

    // Delete buttons
    document.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const docId = btn.getAttribute('data-doc-id');
        if (confirm('Are you sure you want to delete this document from the vault?')) {
          await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
          showToast('Document removed from vault');
          refreshDocumentsList();
        }
      };
    });

    // Inspect buttons
    document.querySelectorAll('.read-doc-btn').forEach(btn => {
      btn.onclick = () => {
        const docId = btn.getAttribute('data-doc-id');
        const docName = btn.getAttribute('data-doc-name');
        jumpToReader(docId, docName, 1);
      };
    });
  }

  // Restore Sample Notes
  restoreSampleBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/documents/reset-sample', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('Sample CS301 Lecture Notes restored!');
        refreshDocumentsList();
      }
    } catch (e) {
      showToast('Failed to restore sample notes', true);
    }
  });

  // PDF Upload Handlers
  async function handlePdfUpload(files) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('pdf_files', files[i]);
    }

    if (uploadStatusArea) uploadStatusArea.style.display = 'flex';

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Successfully extracted & indexed ${data.added.length} PDF(s)!`);
        refreshDocumentsList();
      } else {
        showToast(data.error || 'Failed to upload PDFs', true);
      }
    } catch (err) {
      showToast('Error uploading files', true);
    } finally {
      if (uploadStatusArea) uploadStatusArea.style.display = 'none';
      if (sidebarFileInput) sidebarFileInput.value = '';
      if (dropzoneFileInput) dropzoneFileInput.value = '';
    }
  }

  if (quickUploadBtn && sidebarFileInput) {
    quickUploadBtn.addEventListener('click', () => sidebarFileInput.click());
    sidebarFileInput.addEventListener('change', (e) => handlePdfUpload(e.target.files));
  }

  if (browseFilesBtn && dropzoneFileInput) {
    browseFilesBtn.addEventListener('click', () => dropzoneFileInput.click());
    dropzoneFileInput.addEventListener('change', (e) => handlePdfUpload(e.target.files));
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handlePdfUpload(e.dataTransfer.files);
    });
  }

  /* ==========================================================================
     Tab 1: Chat Workbench (RAG Q&A)
     ========================================================================== */

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query) return;

    chatInput.value = '';
    appendUserMessage(query);

    // Thinking placeholder
    const thinkingId = appendAssistantThinking();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, lang: state.lang })
      });
      const json = await res.json();
      removeAssistantThinking(thinkingId);

      if (json.ok && json.data) {
        appendAssistantResponse(json.data);
      } else {
        appendAssistantError(json.error || 'Unable to process question.');
      }
    } catch (err) {
      removeAssistantThinking(thinkingId);
      appendAssistantError('Network error connecting to backend service.');
    }
  });

  function appendUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'chat-message user-message';
    msg.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-meta">
          <span class="meta-sender">You</span>
        </div>
        <div class="message-body">
          <p>${escapeHtml(text)}</p>
        </div>
      </div>
    `;
    chatViewport.appendChild(msg);
    scrollChatBottom();
  }

  function appendAssistantThinking() {
    const id = `thinking-${Date.now()}`;
    const msg = document.createElement('div');
    msg.id = id;
    msg.className = 'chat-message assistant-message';
    msg.innerHTML = `
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-meta">
          <span class="meta-sender">RAG Assistant</span>
          <span class="meta-tag">Analyzing PDFs...</span>
        </div>
        <div class="message-body">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
            <span>Searching active document pages & verifying facts...</span>
          </div>
        </div>
      </div>
    `;
    chatViewport.appendChild(msg);
    scrollChatBottom();
    return id;
  }

  function removeAssistantThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function appendAssistantResponse(data) {
    const msg = document.createElement('div');
    msg.className = 'chat-message assistant-message';
    const tel = data.telemetry || {};
    const telBadge = tel.totalChunks
      ? `<span class="meta-tag" style="background:var(--bg-muted);color:var(--text-muted);" title="Hybrid BM25 + Embedding Retrieval">${tel.totalChunks} chunks • ${tel.retrievalMs}ms${tel.usedEmbeddings ? ' • Vector+BM25' : ' • BM25'}</span>`
      : '';

    if (!data.found) {
      // Out-of-Document Refusal Card (Must-Have 4)
      msg.innerHTML = `
        <div class="message-avatar" style="background:var(--warning-light);border-color:var(--warning-border);color:var(--warning);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="message-content">
          <div class="message-meta">
            <span class="meta-sender">RAG Assistant</span>
            <span class="meta-tag" style="background:var(--warning-light);color:var(--warning);">Strict Refusal</span>
            ${telBadge}
          </div>
          <div class="message-body">
            <p style="font-size:15px; font-weight:700; color:var(--text-primary);">${escapeHtml(data.answer)}</p>
            <div class="refusal-alert-card">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="refusal-icon">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div class="refusal-text">
                <strong>Out-of-Document Grounding Enforced:</strong> This topic is not mentioned in your enabled PDF pages. Strict RAG guardrails prevented generating an unverified answer.
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // Verified Answer with Citation & Verbatim Proof (Must-Have 2 & 3, Bonus 3)
      msg.innerHTML = `
        <div class="message-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div class="message-content">
          <div class="message-meta">
            <span class="meta-sender">RAG Assistant</span>
            <span class="meta-tag">Verified Grounding</span>
            ${telBadge}
          </div>
          <div class="message-body">
            <p>${escapeHtml(data.answer)}</p>
            
            <div class="citation-container">
              <div class="citation-header">
                <span class="citation-pill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  ${escapeHtml(data.sourceDoc || 'PDF')} • Page ${data.pageNumber}
                </span>
                <button class="inspect-citation-btn" data-doc="${escapeHtml(data.sourceDoc)}" data-page="${data.pageNumber}" data-quote="${escapeHtml(data.excerpt)}">
                  Inspect in Page Reader →
                </button>
              </div>
              <blockquote class="citation-excerpt">
                "${escapeHtml(data.excerpt)}"
              </blockquote>
            </div>
          </div>
        </div>
      `;
    }

    chatViewport.appendChild(msg);
    scrollChatBottom();

    // Bind inspect button
    const inspectBtn = msg.querySelector('.inspect-citation-btn');
    if (inspectBtn) {
      inspectBtn.onclick = () => {
        const docName = inspectBtn.getAttribute('data-doc');
        const pageNum = parseInt(inspectBtn.getAttribute('data-page'), 10);
        const quote = inspectBtn.getAttribute('data-quote');
        jumpToReaderByName(docName, pageNum, quote);
      };
    }
  }

  function appendAssistantError(errorText) {
    const msg = document.createElement('div');
    msg.className = 'chat-message assistant-message';
    msg.innerHTML = `
      <div class="message-avatar" style="color:var(--danger); background:var(--danger-light); border-color:var(--danger-border);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-meta"><span class="meta-sender">System</span></div>
        <div class="message-body" style="color:var(--danger);">
          <p><strong>Error:</strong> ${escapeHtml(errorText)}</p>
        </div>
      </div>
    `;
    chatViewport.appendChild(msg);
    scrollChatBottom();
  }

  function scrollChatBottom() {
    chatViewport.scrollTop = chatViewport.scrollHeight;
  }

  clearChatBtn.addEventListener('click', () => {
    chatViewport.innerHTML = `
      <div class="chat-message assistant-message welcome-message">
        <div class="message-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div class="message-content">
          <div class="message-meta">
            <span class="meta-sender">RAG Assistant</span>
            <span class="meta-tag">Thread Cleared</span>
          </div>
          <div class="message-body">
            <p>Chat thread reset. Ask any question strictly grounded in your active PDFs.</p>
          </div>
        </div>
      </div>
    `;
    showToast('Chat history cleared');
  });

  // Prompt chips click handler
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      chatInput.value = q;
      switchTab('chat');
      chatForm.dispatchEvent(new Event('submit'));
    });
  });

  /* ==========================================================================
     Tab 2: Quiz Studio (Assessment Generator & Grader)
     ========================================================================== */

  generateQuizBtn.addEventListener('click', async () => {
    const count = parseInt(quizCountSelect.value, 10) || 5;
    const difficulty = quizDifficultySelect.value;
    const lang = quizLangSelect.value;

    quizEmptyState.style.display = 'none';
    quizActiveWrap.style.display = 'none';
    quizLoadingState.style.display = 'flex';
    generateQuizBtn.disabled = true;
    generateBtnText.textContent = 'Generating...';

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, difficulty, lang })
      });
      const data = await res.json();

      if (data.ok && data.questions && data.questions.length > 0) {
        state.activeQuiz = data.questions;
        state.userAnswers = {};
        state.isGraded = false;
        renderActiveQuiz();
        showToast(`Quiz generated with ${data.questions.length} questions!`);
      } else {
        showToast(data.error || 'Failed to generate quiz', true);
        quizEmptyState.style.display = 'flex';
      }
    } catch (e) {
      showToast('Error generating quiz from server', true);
      quizEmptyState.style.display = 'flex';
    } finally {
      quizLoadingState.style.display = 'none';
      generateQuizBtn.disabled = false;
      generateBtnText.textContent = 'Generate Quiz';
    }
  });

  function renderActiveQuiz() {
    questionsList.innerHTML = '';
    scoreboardBanner.style.display = 'none';
    submitQuizBtn.style.display = 'inline-flex';
    quizActiveWrap.style.display = 'flex';

    updateAnsweredBadge();

    state.activeQuiz.forEach((q, qIndex) => {
      const card = document.createElement('div');
      card.className = 'quiz-question-card';
      card.id = `q-card-${qIndex}`;

      const optionsHtml = q.options.map((opt, optIndex) => `
        <label class="quiz-option-label" data-q-idx="${qIndex}" data-opt-idx="${optIndex}">
          <span class="option-prefix">${['A', 'B', 'C', 'D'][optIndex]}</span>
          <span class="option-text">${escapeHtml(opt)}</span>
        </label>
      `).join('');

      card.innerHTML = `
        <div class="question-header">
          <span class="question-index-badge">Question ${qIndex + 1} of ${state.activeQuiz.length}</span>
          <span class="question-source-tag">📄 ${escapeHtml(q.sourceDoc)} • Page ${q.pageNumber}</span>
        </div>
        <div class="question-title">${escapeHtml(q.question)}</div>
        <div class="options-grid">
          ${optionsHtml}
        </div>
        <div class="quiz-proof-slot" id="proof-slot-${qIndex}"></div>
      `;

      questionsList.appendChild(card);
    });

    // Bind option click
    document.querySelectorAll('.quiz-option-label').forEach(optLabel => {
      optLabel.addEventListener('click', () => {
        if (state.isGraded) return;
        const qIdx = parseInt(optLabel.getAttribute('data-q-idx'), 10);
        const optIdx = parseInt(optLabel.getAttribute('data-opt-idx'), 10);

        state.userAnswers[qIdx] = optIdx;

        // Update visuals for this question
        const parentGrid = optLabel.closest('.options-grid');
        parentGrid.querySelectorAll('.quiz-option-label').forEach(l => l.classList.remove('selected'));
        optLabel.classList.add('selected');

        updateAnsweredBadge();
      });
    });
  }

  function updateAnsweredBadge() {
    const answered = Object.keys(state.userAnswers).length;
    const total = state.activeQuiz ? state.activeQuiz.length : 0;
    answeredCountBadge.textContent = `${answered} of ${total} Answered`;
  }

  // Quiz Grading (Must-Have 6, Bonus 2 & 3)
  submitQuizBtn.addEventListener('click', () => {
    if (!state.activeQuiz) return;
    const total = state.activeQuiz.length;
    const answered = Object.keys(state.userAnswers).length;

    if (answered < total) {
      if (!confirm(`You have only answered ${answered} of ${total} questions. Grade now?`)) {
        return;
      }
    }

    state.isGraded = true;
    let score = 0;

    state.activeQuiz.forEach((q, qIndex) => {
      const userChoice = state.userAnswers[qIndex];
      const isCorrect = userChoice === q.correctIndex;
      if (isCorrect) score++;

      const card = document.getElementById(`q-card-${qIndex}`);
      card.classList.add(isCorrect ? 'graded-correct' : 'graded-incorrect');

      const optionLabels = card.querySelectorAll('.quiz-option-label');
      optionLabels.forEach((label, optIndex) => {
        if (optIndex === q.correctIndex) {
          label.classList.add('graded-correct-option');
        } else if (optIndex === userChoice && !isCorrect) {
          label.classList.add('graded-wrong-option');
        }
      });

      // Reveal Verbatim Proof Quote (Bonus 2) and Page Citation (Bonus 3)
      const proofSlot = document.getElementById(`proof-slot-${qIndex}`);
      proofSlot.innerHTML = `
        <div class="quiz-proof-card">
          <div class="proof-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Verified Proof: ${escapeHtml(q.sourceDoc)} • Page ${q.pageNumber}
          </div>
          <div class="proof-quote-text">
            "${escapeHtml(q.explanationQuote)}"
          </div>
        </div>
      `;
    });

    const percentage = Math.round((score / total) * 100);
    scoreDisplay.textContent = `${score} / ${total}`;
    scorePercentageDisplay.textContent = `${percentage}%`;

    if (percentage >= 80) {
      scoreHeadline.textContent = 'Excellent Mastery! 🎉';
    } else if (percentage >= 60) {
      scoreHeadline.textContent = 'Good Understanding 👍';
    } else {
      scoreHeadline.textContent = 'Review Suggested 📚';
    }

    scoreboardBanner.style.display = 'flex';
    submitQuizBtn.style.display = 'none';
    scoreboardBanner.scrollIntoView({ behavior: 'smooth' });
    showToast(`Graded: You scored ${score} out of ${total} (${percentage}%)!`);
  });

  // Retake Quiz
  retakeQuizBtn.addEventListener('click', () => {
    state.userAnswers = {};
    state.isGraded = false;
    renderActiveQuiz();
  });

  // Download Quiz Result (Bonus 6)
  downloadQuizBtn.addEventListener('click', async () => {
    if (!state.activeQuiz) return;
    const total = state.activeQuiz.length;
    let score = 0;
    const questionsPayload = state.activeQuiz.map((q, idx) => {
      const userIndex = state.userAnswers[idx] !== undefined ? state.userAnswers[idx] : -1;
      const isCorrect = userIndex === q.correctIndex;
      if (isCorrect) score++;
      return {
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        userIndex: userIndex,
        isCorrect: isCorrect,
        sourceDoc: q.sourceDoc,
        pageNumber: q.pageNumber,
        explanationQuote: q.explanationQuote
      };
    });

    const percentage = Math.round((score / total) * 100);

    try {
      const res = await fetch('/api/quiz/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          total,
          percentage,
          questions: questionsPayload,
          format: 'html'
        })
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz_report_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Assessment result downloaded successfully!');
    } catch (e) {
      showToast('Failed to export quiz report', true);
    }
  });

  /* ==========================================================================
     Tab 3: Page Reader & Deep-Linking
     ========================================================================== */

  function populateReaderDropdown() {
    readerDocSelect.innerHTML = '';
    state.documents.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = `${doc.name} (${doc.totalPages}p)`;
      readerDocSelect.appendChild(opt);
    });

    if (state.documents.length > 0 && !state.reader.docId) {
      state.reader.docId = state.documents[0].id;
      state.reader.docName = state.documents[0].name;
      state.reader.pageNumber = 1;
      state.reader.totalPages = state.documents[0].totalPages;
      loadPageContent(state.reader.docId, 1);
    }
  }

  readerDocSelect.addEventListener('change', () => {
    const selectedDoc = state.documents.find(d => d.id === readerDocSelect.value);
    if (selectedDoc) {
      state.reader.docId = selectedDoc.id;
      state.reader.docName = selectedDoc.name;
      state.reader.pageNumber = 1;
      state.reader.totalPages = selectedDoc.totalPages;
      loadPageContent(selectedDoc.id, 1);
    }
  });

  readerPrevPage.addEventListener('click', () => {
    if (state.reader.pageNumber > 1) {
      state.reader.pageNumber--;
      loadPageContent(state.reader.docId, state.reader.pageNumber, state.reader.searchTerm);
    }
  });

  readerNextPage.addEventListener('click', () => {
    if (state.reader.pageNumber < state.reader.totalPages) {
      state.reader.pageNumber++;
      loadPageContent(state.reader.docId, state.reader.pageNumber, state.reader.searchTerm);
    }
  });

  readerSearchInput.addEventListener('input', (e) => {
    state.reader.searchTerm = e.target.value.trim();
    loadPageContent(state.reader.docId, state.reader.pageNumber, state.reader.searchTerm);
  });

  async function loadPageContent(docId, pageNumber, highlightQuery = '') {
    try {
      readerCardText.textContent = 'Loading page text...';
      const res = await fetch(`/api/document/${docId}/page/${pageNumber}`);
      const data = await res.json();
      if (data.ok) {
        state.reader.pageNumber = data.pageNumber;
        state.reader.totalPages = data.totalPages;

        readerCardDocName.textContent = data.docName;
        readerCardPageBadge.textContent = `Page ${data.pageNumber} of ${data.totalPages}`;
        readerPageIndicator.textContent = `Page ${data.pageNumber} of ${data.totalPages}`;

        // Render with highlighted excerpt
        let text = data.text;
        if (highlightQuery && highlightQuery.length > 2) {
          const escaped = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${escaped})`, 'gi');
          text = escapeHtml(text).replace(regex, '<mark class="highlight-match">$1</mark>');
          readerCardText.innerHTML = text;
        } else {
          readerCardText.textContent = text;
        }
      } else {
        readerCardText.textContent = data.error || 'Failed to load page.';
      }
    } catch (e) {
      readerCardText.textContent = 'Error connecting to reader endpoint.';
    }
  }

  function jumpToReader(docId, docName, pageNumber, excerpt = '') {
    state.reader.docId = docId;
    state.reader.docName = docName;
    state.reader.pageNumber = pageNumber;
    state.reader.searchTerm = excerpt;
    readerDocSelect.value = docId;
    readerSearchInput.value = excerpt;
    switchTab('reader');
    loadPageContent(docId, pageNumber, excerpt);
  }

  function jumpToReaderByName(docName, pageNumber, excerpt = '') {
    const doc = state.documents.find(d => d.name === docName) || state.documents[0];
    if (doc) {
      jumpToReader(doc.id, doc.name, pageNumber, excerpt);
    }
  }

  /* ==========================================================================
     Toast Notifications & Helpers
     ========================================================================== */

  function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
        ${isError ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' : '<polyline points="20 6 9 17 4 12"></polyline>'}
      </svg>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  refreshDocumentsList();
});
