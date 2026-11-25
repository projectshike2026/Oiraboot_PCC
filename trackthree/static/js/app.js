/**
 * Oiraboot — Official OONORI System (AI Engine & RAG)
 * Client Application Logic
 */

// Global State
let currentLang = 'en'; // 'en' or 'bn'
let activeQuizQuestions = [];
let latestQuizResults = null;

// Translations Dictionary
const I18N = {
  en: {
    docVault: "DOCUMENT VAULT",
    docsLabel: "Documents",
    dropzoneMain: "Drop PDF here or click to browse",
    dropzoneSub: "Supports single or multi-PDF extraction",
    processingPdf: "Extracting pages & text...",
    activeDocs: "ACTIVE DOCUMENTS",
    clearAll: "Clear All",
    noDocsUploaded: "No PDF loaded yet. Upload your PDF notes above to begin.",
    quickQuestions: "QUICK VERIFICATION QUESTIONS",
    tabChat: "Document Chat & Semantic Search",
    tabQuiz: "Generate & Take Quiz",
    chatWelcome: "Welcome to the <strong>Document Intelligence Studio</strong>! Ask any question about your loaded PDF notes. Every answer includes verbatim excerpts and page-level citations. If information is absent, I will strictly respond with <em>\"Not found in the document\"</em>.",
    chatPlaceholder: "Ask a question about the document notes...",
    send: "Ask AI",
    numQuestions: "Number of Questions",
    difficulty: "Difficulty Level",
    quizLang: "Quiz Language",
    generateQuiz: "Generate Quiz",
    quizReadyHeading: "Ready to Test Your Knowledge?",
    quizReadyDesc: "Click <strong>\"Generate Quiz\"</strong> above to synthesize multiple-choice questions directly from your uploaded PDF notes.",
    synthesizingQuiz: "Analyzing document and generating quiz questions with page citations...",
    submitQuiz: "Submit Quiz & View Score",
    scoreSubtext: "Review each question below with page numbers and exact document proof excerpts.",
    downloadResult: "Download Quiz Result",
    retakeQuiz: "Retake Quiz",
    newQuiz: "New Quiz",
    sourcePage: "Page",
    verbatimQuote: "PDF Source Proof Excerpt",
    notFound: "Not found in the document",
  },
  bn: {
    docVault: "ডকুমেন্ট ভল্ট",
    docsLabel: "টি নথি",
    dropzoneMain: "পিডিএফ ড্রপ করুন অথবা ক্লিক করুন",
    dropzoneSub: "একটি বা একাধিক পিডিএফ ফাইল সমর্থন করে",
    processingPdf: "পৃষ্ঠা ও টেক্সট বিশ্লেষণ করা হচ্ছে...",
    activeDocs: "সক্রিয় নথিপত্র",
    clearAll: "সব মুছুন",
    noDocsUploaded: "এখনও কোনো পিডিএফ যুক্ত করা হয়নি। উপরে ফাইল আপলোড করুন।",
    quickQuestions: "দ্রুত যাচাইকরণ প্রশ্নসমূহ",
    tabChat: "ডকুমেন্ট চ্যাট ও অনুসন্ধান",
    tabQuiz: "কুইজ তৈরি ও পরীক্ষা",
    chatWelcome: "<strong>ডকুমেন্ট ইন্টেলিজেন্স স্টুডিওতে</strong> স্বাগতম! আপনার আপলোড করা পিডিএফ নোট থেকে যেকোনো প্রশ্ন করুন। প্রতিটি উত্তরে পৃষ্ঠা নম্বর ও উদ্ধৃতি থাকবে। তথ্য না থাকলে অ্যাপ বলবে <em>\"Not found in the document\"</em>।",
    chatPlaceholder: "পিডিএফ নোট সম্পর্কে যেকোনো প্রশ্ন লিখুন...",
    send: "প্রশ্ন করুন",
    numQuestions: "প্রশ্নের সংখ্যা",
    difficulty: "কঠিনতার স্তর",
    quizLang: "কুইজের ভাষা",
    generateQuiz: "কুইজ তৈরি করুন",
    quizReadyHeading: "নিজেকে যাচাই করতে প্রস্তুত?",
    quizReadyDesc: "আপনার পিডিএফ নোট থেকে স্বয়ংক্রিয় বহুনির্বাচনী প্রশ্ন তৈরি করতে উপরের <strong>\"কুইজ তৈরি করুন\"</strong> বোতামে চাপুন।",
    synthesizingQuiz: "পিডিএফ বিশ্লেষণ করে পৃষ্ঠা সূত্রসহ কুইজ তৈরি করা হচ্ছে...",
    submitQuiz: "কুইজ জমা দিন ও স্কোর দেখুন",
    scoreSubtext: "নিচের প্রতিটি প্রশ্নের সঠিক উত্তর, পৃষ্ঠা নম্বর ও প্রামাণ্য উদ্ধৃতি দেখুন।",
    downloadResult: "ফলাফল ডাউনলোড করুন",
    retakeQuiz: "পুনরায় পরীক্ষা দিন",
    newQuiz: "নতুন কুইজ",
    sourcePage: "পৃষ্ঠা",
    verbatimQuote: "পিডিএফ মূল প্রমাণ উদ্ধৃতি",
    notFound: "নথিতে তথ্যটি পাওয়া যায়নি (Not found in the document)",
  }
};

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupDropzone();
  setupTextareaAutoResize();
  updateUIText();
});

// =========================================================================
// LANGUAGE & THEME TOGGLES
// =========================================================================

function toggleLanguage() {
  currentLang = (currentLang === 'en') ? 'bn' : 'en';
  document.getElementById('lang-text').innerText = (currentLang === 'en') ? 'বাংলা' : 'English';
  const quizLangSelect = document.getElementById('quiz-lang-select');
  if (quizLangSelect) {
    quizLangSelect.value = currentLang;
  }
  updateUIText();
}

function updateUIText() {
  const dict = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.innerHTML = dict[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'light';
  const newTheme = (currentTheme === 'light') ? 'dark' : 'light';
  html.setAttribute('data-theme', newTheme);
  
  const icon = document.getElementById('theme-icon');
  const text = document.getElementById('theme-text');
  if (newTheme === 'dark') {
    icon.setAttribute('data-lucide', 'sun');
    text.innerText = 'Light';
  } else {
    icon.setAttribute('data-lucide', 'moon');
    text.innerText = 'Dark';
  }
  lucide.createIcons();
}

// =========================================================================
// TAB SWITCHING
// =========================================================================

function switchStudioTab(tab) {
  const btnChat = document.getElementById('tab-btn-chat');
  const btnQuiz = document.getElementById('tab-btn-quiz');
  const contentChat = document.getElementById('tab-chat-content');
  const contentQuiz = document.getElementById('tab-quiz-content');

  if (tab === 'chat') {
    btnChat.classList.add('active');
    btnQuiz.classList.remove('active');
    contentChat.classList.remove('hidden');
    contentQuiz.classList.add('hidden');
  } else {
    btnQuiz.classList.add('active');
    btnChat.classList.remove('active');
    contentQuiz.classList.remove('hidden');
    contentChat.classList.add('hidden');
  }
  lucide.createIcons();
}

// =========================================================================
// PDF UPLOAD & FILE MANAGEMENT
// =========================================================================

function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('pdf-input');

  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      handleFilesUpload(fileInput.files);
    }
  });
}

async function handleFilesUpload(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const progress = document.getElementById('upload-progress');
  if (progress) progress.classList.remove('hidden');

  try {
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      updateDocumentsList(data.documents);
      appendSystemMessage(`Successfully extracted ${data.added.length} PDF(s). Total: ${data.total_pages} pages.`);
    } else {
      alert(data.error || (data.errors && data.errors.join('\n')) || 'Failed to upload PDF.');
    }
  } catch (err) {
    alert('Upload error: ' + err.message);
  } finally {
    if (progress) progress.classList.add('hidden');
    document.getElementById('pdf-input').value = '';
    lucide.createIcons();
  }
}

async function removeDoc(filename) {
  if (!confirm(`Remove "${filename}" from active documents?`)) return;

  try {
    const res = await fetch('/remove_doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      updateDocumentsList(data.documents);
    }
  } catch (err) {
    alert('Failed to remove document: ' + err.message);
  }
}

async function clearAllDocs() {
  if (!confirm('Clear all uploaded documents?')) return;

  try {
    const res = await fetch('/clear_docs', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      updateDocumentsList([]);
    }
  } catch (err) {
    alert('Failed to clear documents: ' + err.message);
  }
}

function updateDocumentsList(documents) {
  const container = document.getElementById('doc-items-list');
  const countNum = document.getElementById('doc-count-num');
  countNum.innerText = documents.length;

  if (documents.length === 0) {
    container.innerHTML = `
      <div class="empty-docs-notice" id="empty-notice">
        <i data-lucide="file-question" class="icon-md text-faint"></i>
        <p data-i18n="noDocsUploaded">${I18N[currentLang].noDocsUploaded}</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';
  documents.forEach(doc => {
    html += `
      <div class="doc-item" data-filename="${escapeHtml(doc.filename)}">
        <div class="doc-item-icon">
          <i data-lucide="file-check" class="icon-sm text-crimson"></i>
        </div>
        <div class="doc-item-meta">
          <div class="doc-item-name" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</div>
          <div class="doc-item-stats">
            <span>${doc.total_pages} pages</span> • <span>${doc.total_words} words</span>
          </div>
        </div>
        <button class="doc-delete-btn" onclick="removeDoc('${escapeHtml(doc.filename)}')" title="Remove Document">
          <i data-lucide="trash-2" class="icon-xs"></i>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons();
}

// =========================================================================
// CHAT & SEMANTIC SEARCH
// =========================================================================

function setupTextareaAutoResize() {
  const tx = document.getElementById('chat-input');
  if (!tx) return;
  tx.addEventListener('input', () => {
    tx.style.height = 'auto';
    tx.style.height = (tx.scrollHeight) + 'px';
  });
}

function handleTextareaKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('chat-form').dispatchEvent(new Event('submit', { cancelable: true }));
  }
}

function sendQuickQuery(text) {
  switchStudioTab('chat');
  const input = document.getElementById('chat-input');
  input.value = text;
  document.getElementById('chat-form').dispatchEvent(new Event('submit', { cancelable: true }));
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const query = input.value.trim();
  if (!query) return;

  // Append user message
  appendUserMessage(query);
  input.value = '';
  input.style.height = 'auto';

  // Add loading AI indicator
  const loadingId = appendLoadingMessage();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query, lang: currentLang })
    });
    const data = await res.json();
    removeMessage(loadingId);

    if (data.success) {
      appendAIMessage(data);
    } else {
      appendErrorMessage(data.error || 'Failed to query documents.');
    }
  } catch (err) {
    removeMessage(loadingId);
    appendErrorMessage('Connection error: ' + err.message);
  }
}

function appendUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg user-msg';
  el.innerHTML = `
    <div class="msg-avatar"><i data-lucide="user" class="icon-sm"></i></div>
    <div class="msg-bubble"><p class="msg-text">${escapeHtml(text)}</p></div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

function appendAIMessage(data) {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg ai-msg';

  const found = data.found;
  const answer = data.answer;
  const sourceDoc = data.source_doc;
  const pageNum = data.page_number;
  const excerpt = data.excerpt;

  let contentHtml = '';

  if (!found) {
    // Strictly highlighted refusal notice
    contentHtml = `
      <div class="refusal-badge">
        <i data-lucide="shield-alert" class="icon-sm text-crimson"></i>
        <span>${escapeHtml(answer)}</span>
      </div>
      <p class="msg-text" style="font-size:0.8rem; color:var(--text-faint);">
        (This query could not be verified from the uploaded document notes. The system refuses to hallucinate facts.)
      </p>
    `;
  } else {
    // Verified Answer with Citation Box
    contentHtml = `
      <p class="msg-text">${escapeHtml(answer)}</p>
      <div class="citation-box">
        <div class="citation-header">
          <span><i data-lucide="file-text" class="icon-xs"></i> ${escapeHtml(sourceDoc || 'Document')}</span>
          <span><i data-lucide="bookmark" class="icon-xs"></i> ${I18N[currentLang].sourcePage} ${pageNum || '1'}</span>
        </div>
        ${excerpt ? `<div class="citation-excerpt">“${escapeHtml(excerpt)}”</div>` : ''}
      </div>
    `;
  }

  el.innerHTML = `
    <div class="msg-avatar"><i data-lucide="bot" class="icon-sm"></i></div>
    <div class="msg-bubble">${contentHtml}</div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

function appendLoadingMessage() {
  const container = document.getElementById('chat-messages');
  const id = 'msg-loading-' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'chat-msg ai-msg';
  el.innerHTML = `
    <div class="msg-avatar"><i data-lucide="bot" class="icon-sm"></i></div>
    <div class="msg-bubble">
      <div style="display:flex; align-items:center; gap:0.5rem; font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:var(--crimson);">
        <span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>
        <span>Searching page text & formulating answer...</span>
      </div>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
  return id;
}

function appendErrorMessage(errorText) {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg ai-msg';
  el.innerHTML = `
    <div class="msg-avatar"><i data-lucide="alert-triangle" class="icon-sm"></i></div>
    <div class="msg-bubble" style="border-left:3px solid var(--crimson);">
      <p class="msg-text" style="color:var(--crimson); font-size:0.84rem;">${escapeHtml(errorText)}</p>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

function appendSystemMessage(text) {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg ai-msg';
  el.innerHTML = `
    <div class="msg-avatar"><i data-lucide="info" class="icon-sm"></i></div>
    <div class="msg-bubble">
      <p class="msg-text" style="font-size:0.8rem; font-family:'JetBrains Mono',monospace; color:var(--text-muted);">${escapeHtml(text)}</p>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearChatHistory() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="chat-msg ai-msg">
      <div class="msg-avatar"><i data-lucide="bot" class="icon-sm"></i></div>
      <div class="msg-bubble">
        <p class="msg-text">${I18N[currentLang].chatWelcome}</p>
      </div>
    </div>
  `;
  lucide.createIcons();
}

// =========================================================================
// QUIZ GENERATION & ASSESSMENT ENGINE
// =========================================================================

async function generateQuiz() {
  switchStudioTab('quiz');

  const count = parseInt(document.getElementById('quiz-count').value, 10) || 5;
  const difficulty = document.getElementById('quiz-difficulty').value || 'Medium';
  const lang = document.getElementById('quiz-lang-select').value || currentLang;

  const placeholder = document.getElementById('quiz-placeholder');
  const loading = document.getElementById('quiz-loading');
  const formWrapper = document.getElementById('quiz-form-wrapper');
  const resultsWrapper = document.getElementById('quiz-results-wrapper');

  placeholder.classList.add('hidden');
  resultsWrapper.classList.add('hidden');
  formWrapper.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const res = await fetch('/generate_quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        num_questions: count,
        difficulty: difficulty,
        lang: lang
      })
    });
    const data = await res.json();
    loading.classList.add('hidden');

    if (data.success && data.questions && data.questions.length > 0) {
      activeQuizQuestions = data.questions;
      renderQuizForm(data.questions, difficulty);
      formWrapper.classList.remove('hidden');
    } else {
      placeholder.classList.remove('hidden');
      alert(data.error || 'Failed to generate quiz. Please ensure at least one text-based PDF is uploaded.');
    }
  } catch (err) {
    loading.classList.add('hidden');
    placeholder.classList.remove('hidden');
    alert('Quiz generation error: ' + err.message);
  } finally {
    lucide.createIcons();
  }
}

function renderQuizForm(questions, difficulty) {
  const list = document.getElementById('questions-list');
  document.getElementById('quiz-badge-count').innerText = `${questions.length} Questions`;
  document.getElementById('quiz-badge-diff').innerText = difficulty;
  document.getElementById('quiz-progress-label').innerText = `Answered 0 of ${questions.length}`;

  let html = '';
  questions.forEach((q, idx) => {
    html += `
      <div class="question-card" id="q-card-${q.id}">
        <div class="question-title">
          <span class="q-num">${idx + 1}.</span>
          <span>${escapeHtml(q.question)}</span>
        </div>
        <div class="options-group">
          ${q.options.map((opt, optIdx) => `
            <label class="option-label" id="opt-label-${q.id}-${optIdx}">
              <input
                type="radio"
                name="question_${q.id}"
                value="${optIdx}"
                onchange="onOptionSelected(${q.id}, ${optIdx}, ${questions.length})"
              />
              <span>${String.fromCharCode(65 + optIdx)}. ${escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
}

function onOptionSelected(qId, optIdx, totalCount) {
  // Clear previous selected class for this question
  for (let i = 0; i < 4; i++) {
    const lbl = document.getElementById(`opt-label-${qId}-${i}`);
    if (lbl) lbl.classList.remove('selected');
  }
  const currentLbl = document.getElementById(`opt-label-${qId}-${optIdx}`);
  if (currentLbl) currentLbl.classList.add('selected');

  // Update answered count
  const answeredCount = document.querySelectorAll('#quiz-form input[type="radio"]:checked').length;
  document.getElementById('quiz-progress-label').innerText = `Answered ${answeredCount} of ${totalCount}`;
}

async function handleQuizSubmit(e) {
  e.preventDefault();

  const userAnswers = {};
  activeQuizQuestions.forEach(q => {
    const checked = document.querySelector(`input[name="question_${q.id}"]:checked`);
    if (checked) {
      userAnswers[q.id] = parseInt(checked.value, 10);
    }
  });

  const total = activeQuizQuestions.length;
  const answered = Object.keys(userAnswers).length;

  if (answered < total) {
    if (!confirm(`You have answered ${answered} of ${total} questions. Are you sure you want to submit now?`)) {
      return;
    }
  }

  try {
    const res = await fetch('/submit_quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: activeQuizQuestions,
        answers: userAnswers
      })
    });
    const data = await res.json();
    if (data.success) {
      latestQuizResults = data;
      renderQuizResults(data);
    } else {
      alert(data.error || 'Failed to evaluate quiz.');
    }
  } catch (err) {
    alert('Submission error: ' + err.message);
  }
}

function renderQuizResults(data) {
  const formWrapper = document.getElementById('quiz-form-wrapper');
  const resultsWrapper = document.getElementById('quiz-results-wrapper');

  formWrapper.classList.add('hidden');
  resultsWrapper.classList.remove('hidden');

  // Summary Score
  document.getElementById('score-ratio').innerText = `${data.correct_count} / ${data.total}`;
  document.getElementById('score-pct').innerText = `${data.percentage}%`;

  const feedback = document.getElementById('score-feedback');
  if (data.percentage >= 80) {
    feedback.innerText = 'Outstanding Academic Performance!';
  } else if (data.percentage >= 60) {
    feedback.innerText = 'Good Effort — Review Explanations Below';
  } else {
    feedback.innerText = 'Keep Studying — Check Source Pages Below';
  }

  // Question Reviews with Page-Level Citations
  const list = document.getElementById('reviews-list');
  let html = '';

  data.results.forEach((r, idx) => {
    const isCorrect = r.is_correct;
    html += `
      <div class="review-card ${isCorrect ? 'correct' : 'incorrect'}">
        <div class="review-header">
          <div class="question-title">
            <span class="q-num">${idx + 1}.</span>
            <span>${escapeHtml(r.question)}</span>
          </div>
          <span class="status-tag ${isCorrect ? 'correct' : 'incorrect'}">
            <i data-lucide="${isCorrect ? 'check' : 'x'}" class="icon-xs"></i>
            ${isCorrect ? 'CORRECT' : 'INCORRECT'}
          </span>
        </div>

        <div class="review-options">
          ${r.options.map((opt, optIdx) => {
            let optClass = 'review-option';
            let badge = '';
            if (optIdx === r.correct_index) {
              optClass += ' is-correct';
              badge = ' <span style="font-size:0.72rem; font-family:monospace;">[CORRECT ANSWER]</span>';
            }
            if (optIdx === r.user_index && !isCorrect) {
              optClass += ' user-wrong';
              badge = ' <span style="font-size:0.72rem; font-family:monospace;">[YOUR PICK]</span>';
            }
            return `<div class="${optClass}"><span>${String.fromCharCode(65 + optIdx)}. ${escapeHtml(opt)}</span>${badge}</div>`;
          }).join('')}
        </div>

        <!-- Page Citation & Proof Excerpt -->
        <div class="proof-citation-box">
          <div class="proof-meta">
            <span><i data-lucide="file-text" class="icon-xs"></i> ${escapeHtml(r.source_doc || 'Document')}</span>
            <span>•</span>
            <span><i data-lucide="bookmark" class="icon-xs"></i> ${I18N[currentLang].sourcePage} ${r.page_number || '1'}</span>
          </div>
          <div class="proof-quote">“${escapeHtml(r.explanation_quote || 'Refer to the document text.')}”</div>
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
  lucide.createIcons();
}

function retakeQuiz() {
  document.getElementById('quiz-results-wrapper').classList.add('hidden');
  document.getElementById('quiz-form-wrapper').classList.remove('hidden');

  // Reset checked options
  document.querySelectorAll('#quiz-form input[type="radio"]').forEach(r => r.checked = false);
  document.querySelectorAll('.option-label').forEach(lbl => lbl.classList.remove('selected'));
  document.getElementById('quiz-progress-label').innerText = `Answered 0 of ${activeQuizQuestions.length}`;
}

async function downloadQuizResults() {
  if (!latestQuizResults) return;

  try {
    const res = await fetch('/download_quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: `${latestQuizResults.correct_count} / ${latestQuizResults.total}`,
        percentage: latestQuizResults.percentage,
        results: latestQuizResults.results
      })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_assessment_report_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert('Failed to download report: ' + err.message);
  }
}

// Utility: HTML Escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
