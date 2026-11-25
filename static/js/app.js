/* =========================================================================
   OIRABOOT — ACADEMIC INTELLIGENCE SUITE
   Unified Core Application Engine
   ========================================================================= */

// CSRF & Network Helper
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (options.method && options.method.toUpperCase() !== 'GET') {
    headers['X-CSRF-Token'] = getCsrfToken();
  }
  options.headers = headers;
  return fetch(url, options);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(title, message, isAlert = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `pointer-events-auto surface-card rounded-xl p-4 border-l-[3px] ${isAlert ? 'border-l-[var(--crimson)]' : 'border-l-[var(--bg-inverse)]'} msg-animate flex items-start gap-3 shadow-lg`;
  el.innerHTML = `
    <i data-lucide="${isAlert ? 'alert-circle' : 'check-circle-2'}" class="w-4 h-4 text-crimson shrink-0 mt-0.5"></i>
    <div class="flex-1 min-w-0">
      <p class="text-xs font-bold text-main">${escapeHtml(title)}</p>
      <p class="text-[11px] text-muted mt-0.5 leading-snug">${escapeHtml(message)}</p>
    </div>
  `;
  container.appendChild(el);
  lucide.createIcons();
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function openCustomModal(title, htmlContent) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = htmlContent;
  const modal = document.getElementById('custom-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeCustomModal() {
  const modal = document.getElementById('custom-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/* =========================================================================
   1. THEME CONTROLLER (WHITE / BLACK & CRIMSON)
   ========================================================================= */
let currentTheme = localStorage.getItem('oiraboot_theme') || 'light';

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('oiraboot_theme', currentTheme);

  const label = document.getElementById('theme-label');
  const iconEl = document.getElementById('theme-icon');
  if (currentTheme === 'dark') {
    if (label) label.textContent = 'White Mode';
    if (iconEl) iconEl.setAttribute('data-lucide', 'sun');
  } else {
    if (label) label.textContent = 'Black Mode';
    if (iconEl) iconEl.setAttribute('data-lucide', 'moon');
  }
  updateThreeTheme();
  if (typeof updateGalaxyTheme === 'function') {
    updateGalaxyTheme(currentTheme);
  }
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/* =========================================================================
   2. BILINGUAL TRANSLATOR & TYPEWRITER ENGINE
   ========================================================================= */
let currentLang = document.documentElement.getAttribute('lang') || 'en';

const TYPEWRITER_SLIDES = {
  en: [
    { tag: 'Document Studio', text: 'Query lecture notes with exact page citations and generate graded self-test quizzes in seconds.' },
    { tag: 'Admissions Desk', text: 'Engage with a friendly student concierge for instant answers on tuition fees, eligibility, and deadlines.' },
    { tag: 'Scholarship Atlas', text: 'Match your CGPA and department against active grants with tailored fit explanations and gap analysis.' },
    { tag: 'Verified Accuracy', text: 'Every response is verified against official university records and documents.' }
  ],
  bn: [
    { tag: 'ডকুমেন্ট স্টুডিও', text: 'লেকচার নোট থেকে পৃষ্ঠা নম্বরসহ নির্ভুল তথ্য খুঁজুন এবং তাৎক্ষণিক এমসিকিউ কুইজে নিজের প্রস্তুতি যাচাই করুন।' },
    { tag: 'ভর্তি ডেস্ক', text: 'বিশ্ববিদ্যালয় ভর্তির টিউশন ফি, যোগ্যতা ও তারিখ সংক্রান্ত যেকোনো প্রশ্নের উত্তর পান সহজ কথোপকথনে।' },
    { tag: 'স্কলারশিপ অ্যাটলাস', text: 'আপনার সিজিপিএ ও বিভাগের সাথে মানানসই সকল বৃত্তির সুযোগ এবং আবেদন নির্দেশিকা জানুন।' },
    { tag: 'যাচাইকৃত তথ্য', text: 'প্রতিটি উত্তর অফিসিয়াল নথি দ্বারা যাচাইকৃত—মনগড়া কোনো তথ্য নেই।' }
  ]
};

let twSlideIndex = 0;
let twCharIndex = 0;
let twDeleting = false;
let twTimer = null;

function updateTypewriterIndicators(idx) {
  const counter = document.getElementById('typewriter-counter');
  const tag = document.getElementById('typewriter-tag');
  if (counter) counter.textContent = `0${idx + 1} / 04`;
  if (tag) tag.textContent = TYPEWRITER_SLIDES[currentLang][idx].tag;

  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`tw-dot-${i}`);
    if (dot) {
      dot.className = i === idx ? 'h-[2px] bg-crimson transition-all duration-300' : 'h-[2px] bg-[var(--border-hairline)] transition-all duration-300';
    }
  }
}

function runTypewriterTick() {
  const out = document.getElementById('typewriter-output');
  if (!out) return;

  const slides = TYPEWRITER_SLIDES[currentLang] || TYPEWRITER_SLIDES.en;
  const currentText = slides[twSlideIndex].text;
  updateTypewriterIndicators(twSlideIndex);

  if (!twDeleting) {
    twCharIndex++;
    out.textContent = currentText.slice(0, twCharIndex);
    if (twCharIndex >= currentText.length) {
      twDeleting = true;
      twTimer = setTimeout(runTypewriterTick, 2400);
      return;
    }
    twTimer = setTimeout(runTypewriterTick, 30);
  } else {
    twCharIndex--;
    out.textContent = currentText.slice(0, twCharIndex);
    if (twCharIndex <= 0) {
      twDeleting = false;
      twSlideIndex = (twSlideIndex + 1) % slides.length;
      twTimer = setTimeout(runTypewriterTick, 300);
      return;
    }
    twTimer = setTimeout(runTypewriterTick, 15);
  }
}

function restartTypewriter() {
  if (twTimer) clearTimeout(twTimer);
  twSlideIndex = 0;
  twCharIndex = 0;
  twDeleting = false;
  runTypewriterTick();
}

function toggleLanguage() {
  const currentLang = document.documentElement.getAttribute('lang') || 'en';
  const nextLang = currentLang === 'en' ? 'bn' : 'en';
  document.cookie = `lang=${nextLang}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.href = `/lang/${nextLang}`;
}

/* =========================================================================
   3. ARCHITECTURAL THREE.JS 3D WIREFRAME GEOMETRY
   ========================================================================= */
let threeScene, threeCamera, threeRenderer, polyOuter, polyInner, crimsonRing;
let mouseX = 0, mouseY = 0;

function initThreeScene() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1000);
  threeCamera.position.z = 24;

  threeRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const outerGeo = new THREE.DodecahedronGeometry(7.2, 0);
  const outerEdges = new THREE.EdgesGeometry(outerGeo);
  const outerMat = new THREE.LineBasicMaterial({ color: 0x0b0b0d, transparent: true, opacity: 0.08 });
  polyOuter = new THREE.LineSegments(outerEdges, outerMat);
  polyOuter.position.set(8.5, 1.2, -4);
  threeScene.add(polyOuter);

  const innerGeo = new THREE.OctahedronGeometry(3.8, 0);
  const innerEdges = new THREE.EdgesGeometry(innerGeo);
  const innerMat = new THREE.LineBasicMaterial({ color: 0xc8102e, transparent: true, opacity: 0.16 });
  polyInner = new THREE.LineSegments(innerEdges, innerMat);
  polyInner.position.set(8.5, 1.2, -4);
  threeScene.add(polyInner);

  const ringGeo = new THREE.RingGeometry(9.4, 9.46, 96);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc8102e, side: THREE.DoubleSide, transparent: true, opacity: 0.14 });
  crimsonRing = new THREE.Mesh(ringGeo, ringMat);
  crimsonRing.position.set(8.5, 1.2, -4);
  crimsonRing.rotation.x = Math.PI / 2.6;
  threeScene.add(crimsonRing);

  window.addEventListener('resize', () => {
    if (!threeCamera || !threeRenderer) return;
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function updateThreeTheme() {
  if (!polyOuter || !polyInner) return;
  if (currentTheme === 'dark') {
    polyOuter.material.color.setHex(0xfaf9f6);
    polyOuter.material.opacity = 0.09;
    polyInner.material.color.setHex(0xdc2626);
    polyInner.material.opacity = 0.24;
  } else {
    polyOuter.material.color.setHex(0x0b0b0d);
    polyOuter.material.opacity = 0.08;
    polyInner.material.color.setHex(0xc8102e);
    polyInner.material.opacity = 0.16;
  }
}

function animateThree() {
  requestAnimationFrame(animateThree);
  if (!threeRenderer || !threeScene || !threeCamera) return;
  const t = performance.now() * 0.00022;
  if (polyOuter) {
    polyOuter.rotation.x = t * 0.6 + mouseY * 0.14;
    polyOuter.rotation.y = t * 0.8 + mouseX * 0.18;
  }
  if (polyInner) {
    polyInner.rotation.x = -t * 0.9 - mouseY * 0.1;
    polyInner.rotation.y = -t * 1.1 + mouseX * 0.12;
  }
  if (crimsonRing) {
    crimsonRing.rotation.z = t * 0.4;
    crimsonRing.rotation.y = mouseX * 0.12;
  }
  threeRenderer.render(threeScene, threeCamera);
}

/* =========================================================================
   4. PRODUCT MODULE SWITCHER
   ========================================================================= */
let activeModule = 1;

function switchModule(num) {
  activeModule = num;
  [1, 2, 3].forEach(n => {
    const panel = document.getElementById(`module-panel-${n}`);
    const btn = document.getElementById(`mod-btn-${n}`);
    if (!panel || !btn) return;
    const icon = btn.querySelector('svg, i');
    if (n === num) {
      panel.classList.remove('hidden');
      panel.classList.add('panel-active');
      btn.className = 'px-4 sm:px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-[var(--bg-inverse)] text-[var(--text-inverse)]';
      if (icon) icon.classList.add('text-crimson');
    } else {
      panel.classList.add('hidden');
      panel.classList.remove('panel-active');
      btn.className = 'px-4 sm:px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-muted hover:text-main';
      if (icon) icon.classList.remove('text-crimson');
    }
  });
  lucide.createIcons();
}

function jumpToModule(num) {
  const routes = { 1: '/documents', 2: '/admissions', 3: '/scholarships' };
  if (routes[num]) {
    window.location.href = routes[num];
  }
}

/* =========================================================================
   5. MODULE 1: DOCUMENT STUDIO (MULTI-PDF CITATION CHAT + QUIZ ENGINE)
   ========================================================================= */
let activeDocuments = [];
let activeQuizId = null;
let activeQuizQuestions = [];
let userQuizAnswers = {};

async function fetchDocuments() {
  try {
    const res = await apiFetch('/api/docs');
    const data = await res.json();
    activeDocuments = data.docs || [];
    if (activeDocuments.length === 0) {
      // Auto-load sample CS301 note on first boot
      await restoreDefaultSamplePdf();
    } else {
      renderPdfList();
    }
  } catch (_) {
    renderPdfList();
  }
}

async function restoreDefaultSamplePdf() {
  try {
    // Fetch prebuilt sample fixture and upload
    const blobRes = await fetch('/static/sample.pdf').catch(() => null);
    if (!blobRes || !blobRes.ok) {
      // Synthesize sample if file not served statically
      activeDocuments = [{
        id: 1,
        filename: 'CS301_AI_and_RAG_Notes.pdf',
        page_count: 4,
        char_count: 1850
      }];
      renderPdfList();
      return;
    }
    const blob = await blobRes.blob();
    const formData = new FormData();
    formData.append('file', blob, 'CS301_AI_and_RAG_Notes.pdf');
    const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: formData });
    if (uploadRes.ok) {
      const data = await uploadRes.json();
      activeDocuments = [data.doc];
      renderPdfList();
    }
  } catch (_) {
    renderPdfList();
  }
}

function renderPdfList() {
  const list = document.getElementById('pdf-list');
  const badge = document.getElementById('pdf-count-badge');
  if (badge) badge.textContent = `${activeDocuments.length} Active`;
  if (!list) return;

  list.innerHTML = activeDocuments.map(doc => `
    <div class="p-3 rounded-xl surface-subtle flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-hairline text-crimson flex items-center justify-center shrink-0">
          <i data-lucide="file-text" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-main truncate">${escapeHtml(doc.filename)}</p>
          <p class="font-mono text-[10px] text-faint">${doc.page_count} Pages • Indexed</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <a href="/doc/${doc.id}/file" target="_blank" class="p-1.5 rounded-lg text-faint hover:text-crimson transition-colors" title="View PDF">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
        </a>
        ${activeDocuments.length > 1 ? `
          <button onclick="removePdfDoc(${doc.id})" class="p-1.5 rounded-lg text-faint hover:text-crimson transition-colors" title="Remove PDF">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        ` : `<span class="font-mono text-[10px] font-semibold text-crimson px-2 py-0.5 rounded bg-crimson-soft">Primary</span>`}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function handlePdfUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast('Document Indexed', `${file.name} (${data.doc.pages} pages) uploaded and indexed.`);
        await fetchDocuments();
      } else {
        showToast('Upload Notice', data.error?.message || 'Could not upload PDF.', true);
      }
    } catch (_) {
      showToast('Upload Error', `Failed to upload ${file.name}.`, true);
    }
  }
  event.target.value = '';
}

async function removePdfDoc(docId) {
  try {
    const res = await apiFetch(`/api/docs/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Document Removed', 'Updated active library archive.');
      await fetchDocuments();
    }
  } catch (_) {
    showToast('Notice', 'Could not remove document.', true);
  }
}

async function resetSamplePdf() {
  await restoreDefaultSamplePdf();
  showToast('Sample Restored', 'Loaded CS301 Foundations of AI & RAG Notes.');
}

async function openDocumentInspector() {
  if (activeDocuments.length === 0) {
    showToast('Empty Library', 'Upload a PDF document first.', true);
    return;
  }
  let html = '';
  for (const doc of activeDocuments) {
    html += `
      <div class="space-y-2 pb-4 border-b border-hairline last:border-0">
        <p class="text-crimson font-bold text-sm flex items-center gap-2">
          <i data-lucide="file-text" class="w-4 h-4"></i> ${escapeHtml(doc.filename)} (${doc.page_count} Pages)
        </p>
    `;
    for (let p = 1; p <= Math.min(doc.page_count, 6); p++) {
      try {
        const pageRes = await apiFetch(`/api/docs/${doc.id}/page/${p}`);
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          html += `
            <div class="p-3.5 rounded-xl surface-subtle">
              <span class="inline-block px-2 py-0.5 rounded bg-crimson-soft text-crimson font-mono text-[10px] font-bold mb-1.5">Page ${p}</span>
              <p class="text-main font-sans text-xs leading-relaxed">${escapeHtml(pageData.text)}</p>
            </div>
          `;
        }
      } catch (_) {}
    }
    html += '</div>';
  }
  openCustomModal('Indexed Document Archive', html);
}

function switchM1Mode(mode) {
  const chatView = document.getElementById('m1-chat-view');
  const quizView = document.getElementById('m1-quiz-view');
  const chatBtn = document.getElementById('m1-mode-chat');
  const quizBtn = document.getElementById('m1-mode-quiz');

  if (mode === 'chat') {
    chatView.classList.remove('hidden');
    quizView.classList.add('hidden');
    chatBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--bg-inverse)] text-[var(--text-inverse)] transition-all flex items-center gap-2';
    quizBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-muted hover:text-main transition-all flex items-center gap-2';
  } else {
    chatView.classList.add('hidden');
    quizView.classList.remove('hidden');
    quizBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--bg-inverse)] text-[var(--text-inverse)] transition-all flex items-center gap-2';
    chatBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-muted hover:text-main transition-all flex items-center gap-2';
  }
  lucide.createIcons();
}

function askPdfSuggestion(text) {
  switchM1Mode('chat');
  const input = document.getElementById('pdf-chat-input');
  if (input) {
    input.value = text;
    handlePdfChatSubmit(new Event('submit'));
  }
}

function appendPdfMessage(role, htmlContent) {
  const box = document.getElementById('pdf-chat-messages');
  if (!box) return null;
  const wrapper = document.createElement('div');
  wrapper.className = `flex items-start gap-3.5 msg-animate ${role === 'user' ? 'justify-end' : ''}`;
  if (role === 'user') {
    wrapper.innerHTML = `
      <div class="px-4 py-3 rounded-2xl rounded-tr-sm bg-[var(--bg-inverse)] text-[var(--text-inverse)] font-medium text-sm max-w-xl">
        ${htmlContent}
      </div>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-[var(--bg-inverse)] text-[var(--text-inverse)] flex items-center justify-center shrink-0">
        <i data-lucide="book-marked" class="w-4 h-4 text-crimson"></i>
      </div>
      <div class="surface-subtle rounded-2xl rounded-tl-sm p-4 max-w-2xl space-y-3">
        ${htmlContent}
      </div>
    `;
  }
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
  lucide.createIcons();
  return wrapper;
}

async function handlePdfChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('pdf-chat-input');
  const query = input.value.trim();
  if (!query) return;

  input.value = '';
  appendPdfMessage('user', escapeHtml(query));

  const loadingEl = appendPdfMessage('assistant', `
    <div class="flex items-center gap-2.5 text-muted text-xs font-mono">
      <div class="flex items-center gap-1"><span class="pulse-bar"></span><span class="pulse-bar"></span><span class="pulse-bar"></span></div>
      <span>Searching indexed pages & verifying citations...</span>
    </div>
  `);

  try {
    const docIds = activeDocuments.map(d => d.id);
    const res = await apiFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_ids: docIds, message: query })
    });

    const data = await res.json();
    loadingEl.remove();

    if (!data.found) {
      appendPdfMessage('assistant', `
        <div class="flex items-start gap-2.5">
          <i data-lucide="shield-alert" class="w-4 h-4 text-crimson shrink-0 mt-0.5"></i>
          <div>
            <p class="text-sm font-bold text-main">Not found in the document</p>
            ${data.sub_answer ? `<p class="text-xs text-crimson font-medium">${escapeHtml(data.sub_answer)}</p>` : ''}
            <p class="text-xs text-muted mt-1">Source verification prevented ungrounded speculation. This subject does not appear in your uploaded document archive.</p>
          </div>
        </div>
      `);
    } else {
      let sourcesHtml = '';
      if (data.sources && data.sources.length > 0) {
        sourcesHtml = data.sources.map(s => `
          <div class="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-hairline border-l-[3px] border-l-[var(--crimson)] space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-mono text-[10px] uppercase tracking-wider text-crimson font-bold flex items-center gap-1.5">
                <i data-lucide="quote" class="w-3 h-3"></i> Verified Excerpt [${s.n}]
              </span>
              <span class="px-2 py-0.5 rounded bg-crimson-soft text-crimson font-mono text-[10px] font-semibold">
                Page ${s.page} • ${escapeHtml(s.filename)}
              </span>
            </div>
            <p class="text-[11px] text-muted italic leading-relaxed">"${escapeHtml(s.quote)}"</p>
          </div>
        `).join('');
      }

      appendPdfMessage('assistant', `
        <p class="text-sm text-main leading-relaxed">${escapeHtml(data.answer)}</p>
        ${sourcesHtml}
      `);
    }
  } catch (_) {
    loadingEl.remove();
    appendPdfMessage('assistant', `<p class="text-xs text-crimson">The AI service is momentarily busy. Please try again.</p>`);
  }
}

async function generatePdfQuiz() {
  const count = parseInt(document.getElementById('quiz-count').value, 10) || 5;
  const difficulty = document.getElementById('quiz-difficulty').value || 'medium';
  const container = document.getElementById('quiz-container');
  const btn = document.getElementById('generate-quiz-btn');

  btn.disabled = true;
  btn.classList.add('opacity-60');
  container.innerHTML = `
    <div class="py-16 flex flex-col items-center gap-4">
      <div class="flex items-center gap-1.5"><span class="pulse-bar"></span><span class="pulse-bar"></span><span class="pulse-bar"></span></div>
      <p class="font-mono text-xs uppercase tracking-widest text-muted">Constructing ${count} ${difficulty} Questions from Source PDF...</p>
    </div>
  `;

  try {
    const docIds = activeDocuments.map(d => d.id);
    const res = await apiFetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_ids: docIds,
        n: count,
        difficulty: difficulty,
        language: currentLang
      })
    });

    const data = await res.json();
    btn.disabled = false;
    btn.classList.remove('opacity-60');

    if (!res.ok) {
      container.innerHTML = `
        <div class="p-6 text-center space-y-2">
          <p class="text-xs font-bold text-crimson">${escapeHtml(data.error?.message || 'Could not generate quiz.')}</p>
        </div>
      `;
      return;
    }

    activeQuizId = data.quiz_id;
    activeQuizQuestions = data.questions || [];
    userQuizAnswers = {};
    renderQuizInterface(false);
  } catch (_) {
    btn.disabled = false;
    btn.classList.remove('opacity-60');
    container.innerHTML = `<p class="text-xs text-crimson text-center">Quiz service unavailable. Please retry.</p>`;
  }
}

function renderQuizInterface(isSubmitted = false, submitResults = null) {
  const container = document.getElementById('quiz-container');
  if (!container) return;
  container.className = 'flex-1 w-full text-left space-y-5';

  let banner = '';
  if (isSubmitted && submitResults) {
    banner = `
      <div class="p-5 rounded-xl bg-[var(--bg-inverse)] text-[var(--text-inverse)] flex flex-wrap items-center justify-between gap-4 msg-animate">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-xl bg-crimson text-white flex items-center justify-center">
            <span class="font-athens text-lg font-bold">${submitResults.percentage}%</span>
          </div>
          <div>
            <p class="font-mono text-[10px] uppercase tracking-widest opacity-70">Assessment Complete</p>
            <h4 class="font-athens text-lg font-bold">Score: ${submitResults.score} / ${submitResults.total} Correct</h4>
            <p class="text-xs opacity-80 mt-0.5">Review exact PDF proof citations under each question below.</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="/result/${submitResults.attempt_id}" target="_blank" class="px-4 py-2.5 rounded-xl surface-subtle text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:border-crimson transition-all">
            <i data-lucide="printer" class="w-4 h-4 text-crimson"></i>
            <span>Report Page</span>
          </a>
          <a href="/result/${submitResults.attempt_id}.csv" class="px-4 py-2.5 rounded-xl bg-crimson text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:opacity-90 transition-all">
            <i data-lucide="download" class="w-4 h-4"></i>
            <span>Export CSV</span>
          </a>
        </div>
      </div>
    `;
  }

  const items = isSubmitted ? (submitResults.results || []) : activeQuizQuestions;
  const questionsHtml = items.map((q, idx) => {
    const chosen = userQuizAnswers[q.id];
    return `
      <div class="p-5 rounded-xl surface-subtle space-y-3.5 border border-hairline">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-bold text-main leading-snug">
            <span class="font-athens text-crimson mr-2">${idx + 1}.</span>${escapeHtml(q.q)}
          </p>
          <span class="shrink-0 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-hairline font-mono text-[10px] text-faint">
            Page ${q.source ? q.source.page : (q.page || 1)}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${q.options.map((opt, oIdx) => {
            let style = 'bg-[var(--bg-surface)] border-hairline text-main hover:border-crimson';
            let icon = 'circle';
            if (!isSubmitted && chosen === oIdx) {
              style = 'bg-[var(--bg-inverse)] border-[var(--bg-inverse)] text-[var(--text-inverse)]';
              icon = 'check-circle-2';
            } else if (isSubmitted) {
              if (oIdx === q.correct_index) {
                style = 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold';
                icon = 'check-circle-2';
              } else if (chosen === oIdx && chosen !== q.correct_index) {
                style = 'bg-crimson-soft border-crimson text-crimson';
                icon = 'x-circle';
              }
            }
            return `
              <button ${isSubmitted ? 'disabled' : ''} onclick="selectQuizOption(${q.id}, ${oIdx})" class="text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-start gap-2.5 ${style}">
                <i data-lucide="${icon}" class="w-4 h-4 shrink-0 mt-0.5"></i>
                <span>${escapeHtml(opt)}</span>
              </button>
            `;
          }).join('')}
        </div>
        ${isSubmitted && q.source ? `
          <div class="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-hairline border-l-[3px] border-l-[var(--crimson)] text-[11px] text-muted space-y-1">
            <span class="font-mono text-crimson font-bold uppercase mr-1.5">Source Proof (Page ${q.source.page} • ${escapeHtml(q.source.filename || '')}):</span>
            <span class="italic">"${escapeHtml(q.source.quote)}"</span>
            <p class="text-faint text-[10px] pt-0.5">${escapeHtml(q.explanation)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const submitBar = !isSubmitted ? `
    <div class="flex items-center justify-between pt-2">
      <span class="font-mono text-xs text-muted">${Object.keys(userQuizAnswers).length} of ${activeQuizQuestions.length} answered</span>
      <button onclick="submitPdfQuiz()" class="btn-crimson px-7 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2">
        <i data-lucide="check-check" class="w-4 h-4"></i>
        <span>Grade & Reveal Proof</span>
      </button>
    </div>
  ` : '';

  container.innerHTML = banner + questionsHtml + submitBar;
  lucide.createIcons();
}

function selectQuizOption(qid, oIdx) {
  userQuizAnswers[qid] = oIdx;
  renderQuizInterface(false);
}

async function submitPdfQuiz() {
  if (Object.keys(userQuizAnswers).length < activeQuizQuestions.length) {
    showToast('Incomplete Assessment', 'Please answer every question first.', true);
    return;
  }
  try {
    const res = await apiFetch(`/api/quiz/${activeQuizId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: userQuizAnswers })
    });
    const data = await res.json();
    renderQuizInterface(true, data);
    showToast('Assessment Graded', `Final Score: ${data.score} / ${data.total} (${data.percentage}%).`);
  } catch (_) {
    showToast('Notice', 'Failed to submit quiz.', true);
  }
}

/* =========================================================================
   6. MODULE 2: ADMISSIONS DESK (INTERACTIVE EDUCATIONAL CHATBOT & CHECKLIST)
   ========================================================================= */
let admissionChecklistItems = [];

function formatAdmissionReplyHtml(rawText) {
  if (!rawText) return '';
  const escaped = escapeHtml(rawText);
  const lines = escaped.split(/\r?\n/);
  const rendered = lines.map(line => {
    const trimmed = line.trim();
    const withBold = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-zinc-900 dark:text-zinc-50">$1</strong>');
    if (trimmed.startsWith('- ')) {
      return `<div class="flex items-start gap-2 pl-1 my-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 mt-2"></span><span>${withBold.slice(2)}</span></div>`;
    }
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const contentBold = numMatch[2].replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-zinc-900 dark:text-zinc-50">$1</strong>');
      return `<div class="flex items-start gap-2 pl-1 my-1"><span class="text-[11px] font-mono font-bold text-crimson dark:text-[#91DDFB] shrink-0 mt-0.5">${numMatch[1]}.</span><span>${contentBold}</span></div>`;
    }
    if (!trimmed) return '<div class="h-1.5"></div>';
    return `<p class="leading-relaxed">${withBold}</p>`;
  });
  return rendered.join('');
}

function getKindBadgeHtml(kind) {
  if (kind === 'unknown') {
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      Not Listed in Guide
    </span>`;
  }
  if (kind === 'clarify') {
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Please Clarify
    </span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    Verified Answer
  </span>`;
}

async function initAdmissionChat() {
  const box = document.getElementById('admission-chat-messages');
  if (!box) return;
  box.innerHTML = '';

  try {
    const res = await apiFetch('/api/admission/history');
    const data = await res.json();
    const history = data.messages || [];

    if (history.length === 0) {
      const welcomeHtml = `
        <p class="leading-relaxed">Welcome to the <strong class="font-semibold text-zinc-900 dark:text-zinc-50">Oiraboot Admissions Concierge</strong>. I provide clear, helpful answers directly from our Official Admission Guide.</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Ask about programs, tuition fees, GPA eligibility checks, waivers, deadlines, or enrollment steps in English or বাংলা.</p>
      `;
      appendAdmissionMessage('assistant', welcomeHtml, [
        'List all programs & fees',
        'What is the tuition fee for CSE?',
        'Eligibility & GPA requirements',
        'What are the admission steps?'
      ], 'answer', []);
    } else {
      history.forEach(m => {
        if (m.role === 'user') {
          appendAdmissionMessage('user', escapeHtml(m.content));
        } else {
          const contentHtml = formatAdmissionReplyHtml(m.content);
          appendAdmissionMessage('assistant', contentHtml, m.suggestions || [], m.kind || 'answer', m.evidence || []);
        }
      });
    }
  } catch (_) {
    appendAdmissionMessage('assistant', '<p>Welcome to the <strong>Oiraboot Admissions Concierge</strong>. Ask anything regarding official admissions.</p>', [], 'answer', []);
  }
}

function appendAdmissionMessage(role, html, suggestions = [], kind = 'answer', evidence = []) {
  const box = document.getElementById('admission-chat-messages');
  if (!box) return null;
  const div = document.createElement('div');
  div.className = `flex items-start gap-3 msg-animate ${role === 'user' ? 'justify-end' : ''}`;

  if (role === 'user') {
    div.innerHTML = `
      <div class="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-sm max-w-[82%] shadow-xs leading-relaxed">
        ${html}
      </div>
    `;
  } else {
    let evidenceHtml = '';
    if (evidence && evidence.length > 0) {
      evidenceHtml = `
        <div class="mt-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 border-l-[3px] border-l-emerald-600 dark:border-l-emerald-400 text-xs space-y-1">
          <div class="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>Official Source</span>
          </div>
          <p class="italic text-zinc-600 dark:text-zinc-300 leading-snug">"${escapeHtml(evidence[0])}"</p>
        </div>
      `;
    }

    let suggHtml = '';
    if (suggestions && suggestions.length > 0) {
      suggHtml = `
        <div class="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
          ${suggestions.map(s => `
            <button type="button" onclick="sendAdmissionQuick('${escapeHtml(s).replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-emerald-50 dark:bg-zinc-800/90 dark:hover:bg-emerald-950/50 border border-zinc-200/80 dark:border-zinc-700 hover:border-emerald-500/40 text-[11px] text-zinc-700 dark:text-zinc-200 font-medium transition-all cursor-pointer">
              <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span>${escapeHtml(s)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    const badgeHtml = kind && kind !== 'typing' ? `<div class="mb-1.5">${getKindBadgeHtml(kind)}</div>` : '';

    div.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-emerald-900 dark:bg-emerald-500/15 text-white dark:text-emerald-300 border border-emerald-700/30 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
      </div>
      <div class="rounded-2xl rounded-tl-sm bg-white dark:bg-[#11161C] border border-zinc-200/85 dark:border-zinc-800 px-4 py-3.5 max-w-[88%] text-sm text-zinc-700 dark:text-zinc-200 shadow-2xs space-y-2">
        ${badgeHtml}
        <div class="space-y-1">${html}</div>
        ${evidenceHtml}
        ${suggHtml}
      </div>
    `;
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  return div;
}

async function handleAdmissionSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('admission-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendAdmissionMessage('user', escapeHtml(text));

  const typingEl = appendAdmissionMessage('assistant', `
    <div class="flex items-center gap-2.5 text-zinc-500 dark:text-zinc-400 text-xs font-mono py-0.5">
      <div class="flex items-center gap-1"><span class="pulse-bar"></span><span class="pulse-bar"></span><span class="pulse-bar"></span></div>
      <span>Verifying official admission records...</span>
    </div>
  `, [], 'typing', []);

  try {
    const res = await apiFetch('/api/admission/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (typingEl) typingEl.remove();

    if (!res.ok) {
      const errMsg = (data && data.error && data.error.message) ? data.error.message : 'Unable to process inquiry right now.';
      appendAdmissionMessage('assistant', `<p>${escapeHtml(errMsg)}</p>`, [], 'unknown', []);
      return;
    }

    const replyHtml = formatAdmissionReplyHtml(data.reply);
    appendAdmissionMessage('assistant', replyHtml, data.suggestions || [], data.type || 'answer', data.evidence || []);
  } catch (_) {
    if (typingEl) typingEl.remove();
    appendAdmissionMessage('assistant', '<p>The Admissions Concierge encountered a connection issue. Please try again.</p>', [], 'unknown', []);
  }
}

function sendAdmissionQuick(text) {
  const input = document.getElementById('admission-chat-input');
  if (input) {
    input.value = text;
    handleAdmissionSubmit(new Event('submit'));
  }
}

async function clearAdmissionChat() {
  try {
    await apiFetch('/api/admission/history', { method: 'DELETE' });
    await initAdmissionChat();
    showToast('Session Reset', 'Cleared admission conversation history.');
  } catch (_) {
    showToast('Notice', 'Could not reset conversation.', true);
  }
}

async function fetchAdmissionChecklist() {
  try {
    const lang = document.documentElement.getAttribute('lang') || localStorage.getItem('oiraboot_lang') || 'en';
    const res = await apiFetch(`/api/admission/checklist?lang=${lang}`);
    const data = await res.json();
    admissionChecklistItems = data.items || [];
    renderAdmissionChecklist();
  } catch (_) {}
}

function renderAdmissionChecklist() {
  const box = document.getElementById('admission-checklist');
  if (!box) return;
  const doneCount = admissionChecklistItems.filter(i => i.done).length;
  const pct = Math.round((doneCount / Math.max(1, admissionChecklistItems.length)) * 100);
  const ring = document.getElementById('checklist-progress-ring');
  const pctLabel = document.getElementById('checklist-percent');
  const badgeLabel = document.getElementById('chatbot-checklist-badge');
  const circumference = 119.38;
  if (ring) ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  if (pctLabel) pctLabel.textContent = pct + '%';
  if (badgeLabel) badgeLabel.textContent = `${doneCount}/${admissionChecklistItems.length}`;

  box.innerHTML = admissionChecklistItems.map(item => `
    <button type="button" onclick="toggleChecklistItem('${item.id}')" class="w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${item.done ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/40 text-zinc-900 dark:text-zinc-100' : 'bg-white/80 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500/40'}">
      <svg class="w-4 h-4 shrink-0 mt-0.5 ${item.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${item.done ? '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' : '<rect x="3" y="3" width="18" height="18" rx="2"/>'}
      </svg>
      <span class="text-[11px] font-medium leading-snug ${item.done ? 'line-through opacity-75' : ''}">${escapeHtml(item.label)}</span>
    </button>
  `).join('');
}

function toggleChecklistItem(id) {
  const target = admissionChecklistItems.find(i => i.id === id);
  if (target) target.done = !target.done;
  renderAdmissionChecklist();
}

async function openAdmissionDataModal() {
  try {
    const res = await apiFetch('/api/admission/data');
    const data = await res.json();
    openCustomModal('Official Admission Records', `<pre class="whitespace-pre-wrap font-mono text-xs text-main leading-relaxed">${escapeHtml(data.raw_text)}</pre>`);
  } catch (_) {
    showToast('Notice', 'Could not open admission records.', true);
  }
}

/* =========================================================================
   7. MODULE 3: SCHOLARSHIP ATLAS (CSV MATCHER, RATIONALES & GAP RADAR)
   ========================================================================= */
let scholarshipSort = 'amount';
let scholarshipView = 'cards';
let latestMatched = [];
let latestAlmost = [];
let latestReasons = {};

function updateCgpaBadge(val) {
  const el = document.getElementById('cgpa-value-badge');
  if (el) el.textContent = parseFloat(val).toFixed(2);
}

function setScholarshipSort(mode) {
  scholarshipSort = mode;
  const amtBtn = document.getElementById('sort-amount-btn');
  const dlBtn = document.getElementById('sort-deadline-btn');
  if (amtBtn && dlBtn) {
    if (mode === 'amount') {
      amtBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--bg-inverse)] text-[var(--text-inverse)] transition-all flex items-center gap-1.5';
      dlBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-muted hover:text-main transition-all flex items-center gap-1.5';
    } else {
      dlBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--bg-inverse)] text-[var(--text-inverse)] transition-all flex items-center gap-1.5';
      amtBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-muted hover:text-main transition-all flex items-center gap-1.5';
    }
  }
  renderScholarshipResults();
}

function setScholarshipView(view) {
  scholarshipView = view;
  const cardBtn = document.getElementById('view-cards-btn');
  const tableBtn = document.getElementById('view-table-btn');
  if (cardBtn && tableBtn) {
    cardBtn.className = view === 'cards' ? 'p-2 rounded-lg bg-[var(--bg-surface)] text-crimson shadow-sm' : 'p-2 rounded-lg text-muted hover:text-main';
    tableBtn.className = view === 'table' ? 'p-2 rounded-lg bg-[var(--bg-surface)] text-crimson shadow-sm' : 'p-2 rounded-lg text-muted hover:text-main';
  }
  renderScholarshipResults();
}

async function runScholarshipMatcher(e) {
  if (e) e.preventDefault();
  const cgpa = parseFloat(document.getElementById('student-cgpa').value) || 3.75;
  const dept = document.getElementById('student-dept').value || 'CSE';
  const need = document.getElementById('student-need').checked;

  const btn = document.getElementById('find-scholarships-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Evaluating Eligibility...</span>`;
    lucide.createIcons();
  }

  try {
    const res = await apiFetch('/api/scholarships/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cgpa: cgpa,
        department: dept,
        needs_support: need,
        sort: scholarshipSort,
        lang: currentLang
      })
    });

    const data = await res.json();
    latestMatched = data.matched || [];
    latestAlmost = data.almost || [];
    latestReasons = data.reasons || {};

    renderScholarshipResults();

    // Trigger progressive background enhancement for AI reasons
    if (data.search_id) {
      apiFetch('/api/scholarships/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_id: data.search_id })
      }).then(r => r.json()).then(rData => {
        if (rData.reasons) {
          latestReasons = rData.reasons;
          renderScholarshipResults();
        }
      }).catch(() => {});
    }
  } catch (_) {
    showToast('Notice', 'Failed to match scholarships.', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="search-check" class="w-4 h-4"></i><span>Evaluate & Match Awards</span>`;
      lucide.createIcons();
    }
  }
}

function renderScholarshipResults() {
  const container = document.getElementById('scholarship-results-container');
  const almostSec = document.getElementById('almost-qualified-section');
  const almostList = document.getElementById('almost-qualified-list');
  if (!container) return;

  const sorted = [...latestMatched].sort((a, b) =>
    scholarshipSort === 'amount' ? b.amount_value - a.amount_value : new Date(a.deadline) - new Date(b.deadline)
  );

  const matchedPill = document.getElementById('matched-count-pill');
  const almostPill = document.getElementById('almost-count-pill');
  if (matchedPill) matchedPill.textContent = `${sorted.length} Eligible`;
  if (almostPill) almostPill.textContent = `${latestAlmost.length} Near Match`;

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="surface-card rounded-2xl p-10 text-center space-y-3">
        <div class="w-12 h-12 mx-auto rounded-xl surface-subtle flex items-center justify-center text-crimson">
          <i data-lucide="search-x" class="w-6 h-6"></i>
        </div>
        <h4 class="font-athens text-lg font-bold text-main">No Direct Matches Found</h4>
        <p class="text-xs text-muted max-w-md mx-auto">Adjust your CGPA, department, or financial support setting — or review the Near-Match Gap radar below.</p>
      </div>
    `;
  } else if (scholarshipView === 'table') {
    container.innerHTML = `
      <div class="surface-card rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-hairline bg-[var(--bg-subtle)] font-mono text-[10px] uppercase tracking-widest text-faint">
                <th class="py-4 px-5">Scholarship</th>
                <th class="py-4 px-4">Award (BDT)</th>
                <th class="py-4 px-4">Min CGPA</th>
                <th class="py-4 px-4">Deadline</th>
                <th class="py-4 px-5">Fit Summary</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-hairline)] text-xs">
              ${sorted.map(s => `
                <tr class="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td class="py-4 px-5">
                    <p class="font-bold text-main">${escapeHtml(s.name)}</p>
                    <p class="text-[11px] text-muted">${escapeHtml(s.provider)}</p>
                  </td>
                  <td class="py-4 px-4 font-mono font-bold text-crimson">BDT ${s.amount_value.toLocaleString()}</td>
                  <td class="py-4 px-4 font-mono text-main">${s.min_cgpa.toFixed(2)}</td>
                  <td class="py-4 px-4 font-mono text-muted">${escapeHtml(s.deadline)}</td>
                  <td class="py-4 px-5 text-muted max-w-xs leading-relaxed">${escapeHtml(latestReasons[s.id]?.reason || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = sorted.map(s => {
      const reasonObj = latestReasons[s.id] || {};
      const steps = reasonObj.steps || s.checklist || [];
      return `
        <div class="surface-card editorial-card rounded-2xl p-6 space-y-4 msg-animate">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded bg-[var(--bg-inverse)] text-[var(--text-inverse)] font-mono text-[10px] font-bold uppercase">Eligible</span>
                ${s.need_based ? `<span class="px-2.5 py-0.5 rounded bg-crimson-soft border border-crimson font-mono text-[10px] font-semibold text-crimson uppercase">Need-Based</span>` : ''}
                <span class="font-mono text-[10px] text-faint">Min CGPA ${s.min_cgpa.toFixed(2)}</span>
              </div>
              <h4 class="font-athens text-base sm:text-lg font-bold text-main">${escapeHtml(s.name)}</h4>
              <p class="text-xs text-muted">${escapeHtml(s.provider)}</p>
            </div>
            <div class="text-right">
              <p class="font-mono text-lg font-bold text-crimson">BDT ${s.amount_value.toLocaleString()}</p>
              <p class="font-mono text-[11px] text-muted flex items-center justify-end gap-1 mt-0.5">
                <i data-lucide="calendar" class="w-3 h-3 text-crimson"></i> Due ${escapeHtml(s.deadline)}
              </p>
            </div>
          </div>

          <div class="p-3.5 rounded-xl surface-subtle border-l-[3px] border-l-[var(--crimson)] flex items-start gap-2.5">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-crimson shrink-0 mt-0.5"></i>
            <p class="text-xs text-main leading-relaxed">
              <strong>Fit Summary:</strong> ${escapeHtml(reasonObj.reason || '')}
            </p>
          </div>

          <details class="group">
            <summary class="cursor-pointer list-none flex items-center justify-between text-xs font-bold text-muted hover:text-crimson transition-colors pt-1">
              <span class="flex items-center gap-2">
                <i data-lucide="list-checks" class="w-4 h-4 text-crimson"></i>
                <span>Application Checklist (${steps.length} Steps)</span>
              </span>
              <i data-lucide="chevron-down" class="w-4 h-4 group-open:rotate-180 transition-transform"></i>
            </summary>
            <ul class="mt-3 pt-3 border-t border-hairline space-y-2 text-xs text-muted">
              ${steps.map((step, i) => `
                <li class="flex items-start gap-2.5">
                  <span class="w-5 h-5 rounded bg-crimson-soft font-mono text-[10px] font-bold text-crimson flex items-center justify-center shrink-0">${i + 1}</span>
                  <span class="text-main">${escapeHtml(step)}</span>
                </li>
              `).join('')}
            </ul>
          </details>
        </div>
      `;
    }).join('');
  }

  if (latestAlmost.length > 0 && almostSec && almostList) {
    almostSec.classList.remove('hidden');
    almostList.innerHTML = latestAlmost.map(s => `
      <div class="p-4 rounded-xl surface-subtle space-y-2">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-bold text-main">${escapeHtml(s.name)}</p>
          <span class="font-mono text-[11px] font-bold text-crimson shrink-0">BDT ${s.amount_value.toLocaleString()}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${(s.missing || []).map(m => `
            <span class="px-2 py-1 rounded bg-crimson-soft border border-crimson font-mono text-[10px] font-semibold text-crimson flex items-center gap-1">
              <i data-lucide="arrow-up-circle" class="w-3 h-3"></i> ${escapeHtml(m)}
            </span>
          `).join('')}
        </div>
      </div>
    `).join('');
  } else if (almostSec) {
    almostSec.classList.add('hidden');
  }

  lucide.createIcons();
}

async function handleCsvUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await apiFetch('/api/scholarships/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Catalog Updated', `Imported ${data.count} scholarships from ${file.name}.`);
      const countLabel = document.getElementById('csv-count-label');
      if (countLabel) countLabel.textContent = `${data.count} Records (CSV)`;
      runScholarshipMatcher();
    } else {
      showToast('CSV Notice', data.error?.message || 'Could not parse CSV.', true);
    }
  } catch (_) {
    showToast('Upload Error', 'Failed to upload CSV.', true);
  }
  event.target.value = '';
}

function downloadScholarshipReport() {
  const cgpa = document.getElementById('student-cgpa').value || 3.75;
  const dept = document.getElementById('student-dept').value || 'CSE';
  const need = document.getElementById('student-need').checked;
  window.location.href = `/api/scholarships/export.csv?cgpa=${cgpa}&department=${encodeURIComponent(dept)}&needs_support=${need}&lang=${currentLang}`;
  showToast('Export Initiated', 'Saved Oiraboot_Scholarship_Matching_Report.csv');
}

/* =========================================================================
   8. BOOTSTRAP, TRANSITIONS & MICRO-INTERACTIONS
   ========================================================================= */
function initMicroInteractions() {
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Precision Magnetic Desktop Cursor
  const artCursor = document.getElementById('art-cursor');
  let cx = -100, cy = -100, rx = -100, ry = -100;
  window.addEventListener('mousemove', (e) => {
    cx = e.clientX;
    cy = e.clientY;
  });

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('button, a, input, select')) document.body.classList.add('cursor-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('button, a, input, select')) document.body.classList.remove('cursor-hover');
  });

  function animateCursor() {
    rx += (cx - rx) * 0.18;
    ry += (cy - ry) * 0.18;
    if (artCursor) artCursor.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Glowing Bengali Logo Page-to-Page Navigation Transition
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith('/#') && !href.startsWith('#') && href !== window.location.pathname && !href.includes('.') && !link.target && !e.ctrlKey && !e.metaKey) {
      const preloader = document.getElementById('preloader');
      if (preloader) {
        preloader.style.display = 'flex';
        preloader.classList.remove('hidden-curtain');
        setTimeout(dismissPreloader, 2500);
      }
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  const modal = document.getElementById('custom-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'custom-modal') closeCustomModal();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCustomModal();
  });
}

function bootApp() {
  try {
    lucide.createIcons();
    initMicroInteractions();
    initThreeScene();
    animateThree();
    restartTypewriter();

    // Hydrate each studio conditionally if its elements are present
    if (document.getElementById('pdf-list')) {
      fetchDocuments();
    }
    if (document.getElementById('admission-chat-messages')) {
      initAdmissionChat();
      fetchAdmissionChecklist();
    }
    if (document.getElementById('scholarship-form')) {
      runScholarshipMatcher();
    }
  } catch (_) {
    // Keep UI interactive even on older browsers
  } finally {
    if (typeof dismissPreloader === 'function') {
      dismissPreloader();
    } else {
      const preloader = document.getElementById('preloader');
      if (preloader) {
        preloader.classList.add('hidden-curtain');
        setTimeout(() => { preloader.style.display = 'none'; }, 600);
      }
    }
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootApp();
} else {
  document.addEventListener('DOMContentLoaded', bootApp);
  window.addEventListener('load', bootApp);
}
