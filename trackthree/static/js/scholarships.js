/**
 * Oiraboot — Track 3: Scholarship Atlas & AI Advisor
 * Client Application Logic
 */

let matchedItems = [];
let almostItems = [];
let currentTab = 'matched'; // 'matched' or 'almost'
let currentLayout = 'cards'; // 'cards' or 'table'
let currentLang = 'en';

const SCHOLARSHIP_I18N = {
  en: {
    studentProfile: "STUDENT PROFILE",
    inCatalog: "in Catalog",
    quickPresets: "QUICK PRESETS",
    cgpaLabel: "Cumulative GPA (CGPA)",
    deptLabel: "Department",
    needLabel: "Demonstrated Financial Need",
    needSub: "Check if applying for need-based tuition waivers",
    genderLabel: "Applicant Gender",
    findAwards: "Evaluate Matching Scholarships",
    eligibleMatches: "Eligible Awards",
    nearMiss: "Almost Eligible",
    searchPlaceholder: "Search provider, name, keyword...",
    export: "Download CSV Report",
    aiAdviseBtn: "Gemini AI Strategy Advisor",
    aiModalTitle: "Gemini AI Scholarship Strategy",
    aiChatBtn: "AI Scholarship Advisor",
    aiChatTitle: "Oiraboot Scholarship Advisor",
    aiChatSubtitle: "Powered by verified catalog • 136 scholarships",
    aiChatPlaceholder: "My CGPA is 3.6, CSE dept, I need financial support...",
    extraThink: "Extra Think",
    filterResults: "Filter Results",
    thAward: "Scholarship Award",
    thProvider: "Provider",
    thDept: "Department",
    thCgpa: "Min CGPA",
    thAmount: "Amount",
    thDeadline: "Deadline",
    thFitReason: "AI Fit Rationale",
    thAction: "Checklist",
    noMatchHeading: "No Direct Matches Found",
    noMatchDesc: "Try adjusting your CGPA or department in the sidebar, or check the 'Almost Eligible' tab for opportunities you nearly qualify for.",
    checklistTag: "APPLICATION CHECKLIST",
    checklistIntro: "Follow these actionable steps to prepare and complete your application:",
    done: "Close",
    checklistBtn: "Checklist",
    missingRequirement: "Missing Requirements to Qualify",
    minCgpa: "Min CGPA",
    deadline: "Deadline",
    potentialTotal: "Total Funding Pool",
    maxAward: "Max Award",
    openTrack1: "Open AI Engine (Track 1)",
    needTrack1: "Need AI Engine Q&A?",
    track1Desc: "PDF Study Notes Chat & Instant Quiz",
  },
  bn: {
    studentProfile: "শিক্ষার্থীর প্রোফাইল",
    inCatalog: "টি বৃত্তি ক্যাটালগে",
    quickPresets: "দ্রুত প্রোফাইল প্রিসেট",
    cgpaLabel: "ক্রমযোজিত জিপিএ (CGPA)",
    deptLabel: "বিভাগ",
    needLabel: "আর্থিক সহায়তার প্রয়োজন",
    needSub: "টিউশন ফি ওয়েভার বা আর্থিক বৃত্তির জন্য টিক দিন",
    genderLabel: "আবেদনকারীর লিঙ্গ",
    findAwards: "যোগ্য বৃত্তিগুলো ফিল্টার করুন",
    eligibleMatches: "যোগ্য বৃত্তি",
    nearMiss: "অল্পের জন্য মিস হওয়া",
    searchPlaceholder: "নাম বা প্রদানকারী দিয়ে খুঁজুন...",
    export: "CSV ডাউনলোড",
    aiAdviseBtn: "জেমিনাই এআই স্ট্র্যাটেজি",
    aiModalTitle: "জেমিনাই এআই স্কলারশিপ পরামর্শ",
    aiChatBtn: "এআই স্কলারশিপ উপদেষ্টা",
    aiChatTitle: "ওইরাবুট স্কলারশিপ উপদেষ্টা",
    aiChatSubtitle: "যাচাইকৃত ক্যাটালগ থেকে • ১৩৬টি বৃত্তি",
    aiChatPlaceholder: "আমার CGPA ৩.৬, CSE বিভাগ, আর্থিক সহায়তা দরকার...",
    extraThink: "গভীর বিশ্লেষণ",
    filterResults: "ফলাফল ফিল্টার",
    thAward: "বৃত্তির নাম",
    thProvider: "প্রদানকারী",
    thDept: "বিভাগ",
    thCgpa: "ন্যূনতম CGPA",
    thAmount: "পরিমাণ",
    thDeadline: "শেষ সময়",
    thFitReason: "এআই যুক্তিকরণ",
    thAction: "চেকলিস্ট",
    noMatchHeading: "সরাসরি কোনো ম্যাচ পাওয়া যায়নি",
    noMatchDesc: "বাম পাশের সাইডবার থেকে আপনার সিজিপিএ বা বিভাগ পরিবর্তন করুন অথবা 'অল্পের জন্য মিস হওয়া' ট্যাবে দেখুন।",
    checklistTag: "আবেদন চেকলিস্ট",
    checklistIntro: "আপনার আবেদন সফল করতে নিচের ধাপগুলো অনুসরণ করুন:",
    done: "বন্ধ করুন",
    checklistBtn: "চেকলিস্ট",
    missingRequirement: "যেসব শর্তের ঘাটতি রয়েছে",
    minCgpa: "ন্যূনতম CGPA",
    deadline: "শেষ তারিখ",
    potentialTotal: "মোট অনুদান তহবিল",
    maxAward: "সর্বোচ্চ অনুদান",
    openTrack1: "এআই ইঞ্জিন ওপেন করুন (ট্র্যাক ১)",
    needTrack1: "এআই ইঞ্জিন প্রশ্নোত্তর প্রয়োজন?",
    track1Desc: "পিডিএফ স্টাডি নোট চ্যাট ও স্বয়ংক্রিয় কুইজ",
  }
};

document.addEventListener('DOMContentLoaded', () => {
  triggerScholarshipMatch();
  // AI chat init is called at the bottom of the file
  initScholarshipChat();
});

function toggleLanguage() {
  currentLang = (currentLang === 'en') ? 'bn' : 'en';
  document.getElementById('lang-text').innerText = (currentLang === 'en') ? 'বাংলা' : 'English';
  updateUIText();
  renderCurrentList();
}

function updateUIText() {
  const dict = SCHOLARSHIP_I18N[currentLang];
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

function onCgpaSliderChange(val) {
  const num = parseFloat(val).toFixed(2);
  document.getElementById('cgpa-display').innerText = num;
  document.getElementById('cgpa-input').value = num;
  triggerScholarshipMatch();
}

function onCgpaInputChange(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return;
  document.getElementById('cgpa-display').innerText = num.toFixed(2);
  document.getElementById('cgpa-slider').value = num;
  triggerScholarshipMatch();
}

function applyPreset(cgpa, dept, need, gender, btn) {
  document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.getElementById('cgpa-slider').value = cgpa;
  document.getElementById('cgpa-input').value = cgpa.toFixed(2);
  document.getElementById('cgpa-display').innerText = cgpa.toFixed(2);

  document.getElementById('dept-select').value = dept;
  document.getElementById('need-checkbox').checked = need;
  document.getElementById('gender-select').value = gender;

  triggerScholarshipMatch();
}

function handleProfileSubmit(e) {
  e.preventDefault();
  triggerScholarshipMatch();
}

async function triggerScholarshipMatch() {
  const cgpa = parseFloat(document.getElementById('cgpa-input').value) || 3.85;
  const dept = document.getElementById('dept-select').value;
  const need = document.getElementById('need-checkbox').checked;
  const gender = document.getElementById('gender-select').value;

  try {
    const res = await fetch('/api/match_scholarships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cgpa,
        department: dept,
        need_based: need,
        gender,
        lang: currentLang
      })
    });
    const data = await res.json();

    if (data.success) {
      matchedItems = data.matched || [];
      almostItems = data.almost || [];

      document.getElementById('count-matched-badge').innerText = matchedItems.length;
      document.getElementById('count-almost-badge').innerText = almostItems.length;
      
      const totalBdtEl = document.getElementById('total-potential-bdt');
      if (totalBdtEl) {
        totalBdtEl.innerText = `BDT ${(data.total_potential_bdt || 0).toLocaleString('en-US')}`;
      }
      const maxAwardEl = document.getElementById('max-award-bdt');
      if (maxAwardEl) {
        maxAwardEl.innerText = `BDT ${(data.max_single_award_bdt || 0).toLocaleString('en-US')}`;
      }

      renderCurrentList();
    }
  } catch (err) {
    console.error('Matching error:', err);
  }
}

function switchMatchTab(tab) {
  currentTab = tab;
  const matchBtn = document.getElementById('tab-matched-btn');
  const almostBtn = document.getElementById('tab-almost-btn');

  if (tab === 'matched') {
    matchBtn.classList.add('active');
    almostBtn.classList.remove('active');
  } else {
    almostBtn.classList.add('active');
    matchBtn.classList.remove('active');
  }
  renderCurrentList();
}

function setLayout(layout) {
  currentLayout = layout;
  const cardsBtn = document.getElementById('layout-cards-btn');
  const tableBtn = document.getElementById('layout-table-btn');

  if (layout === 'cards') {
    cardsBtn.classList.add('active');
    tableBtn.classList.remove('active');
  } else {
    tableBtn.classList.add('active');
    cardsBtn.classList.remove('active');
  }
  renderCurrentList();
}

function applyClientFilter() {
  renderCurrentList();
}

function getFilteredAndSortedItems() {
  const source = (currentTab === 'matched') ? matchedItems : almostItems;
  const search = (document.getElementById('search-filter').value || '').trim().toLowerCase();
  const sort = document.getElementById('sort-select').value;

  let items = source.filter(item => {
    const s = item.record;
    if (!search) return true;
    return s.name.toLowerCase().includes(search) ||
           s.provider.toLowerCase().includes(search) ||
           s.description.toLowerCase().includes(search) ||
           s.department_raw.toLowerCase().includes(search);
  });

  if (sort === 'amount_desc') {
    items.sort((a, b) => b.record.amount_bdt - a.record.amount_bdt);
  } else if (sort === 'deadline_asc') {
    items.sort((a, b) => a.record.deadline.localeCompare(b.record.deadline));
  } else if (sort === 'cgpa_asc') {
    items.sort((a, b) => a.record.min_cgpa - b.record.min_cgpa);
  }

  return items;
}

function renderCurrentList() {
  const items = getFilteredAndSortedItems();
  const cardsContainer = document.getElementById('cards-view');
  const tableContainer = document.getElementById('table-view');
  const emptyNotice = document.getElementById('empty-results');

  if (items.length === 0) {
    cardsContainer.classList.add('hidden');
    tableContainer.classList.add('hidden');
    emptyNotice.classList.remove('hidden');
    return;
  }

  emptyNotice.classList.add('hidden');

  if (currentLayout === 'cards') {
    tableContainer.classList.add('hidden');
    cardsContainer.classList.remove('hidden');
    renderCards(items, cardsContainer);
  } else {
    cardsContainer.classList.add('hidden');
    tableContainer.classList.remove('hidden');
    renderTable(items);
  }

  lucide.createIcons();
}

function renderCards(items, container) {
  let html = '';
  items.forEach(item => {
    const s = item.record;
    const isAlmost = (currentTab === 'almost');
    const amountStr = s.amount_bdt ? `BDT ${s.amount_bdt.toLocaleString('en-US')}` : 'Full Waiver';
    const reason = (currentLang === 'bn') ? item.match_reason_bn : item.match_reason_en;
    const missingStr = (currentLang === 'bn') ? item.missing_summary_bn : item.missing_summary_en;

    html += `
      <article class="scholarship-card ${isAlmost ? 'almost-border' : ''}">
        <div class="card-top-row">
          <span class="provider-badge">${escapeHtml(s.provider)}</span>
          <span class="amount-badge">${amountStr}</span>
        </div>

        <h3 class="award-name">${escapeHtml(s.name)}</h3>
        <p class="award-desc">${escapeHtml(s.description)}</p>

        <!-- Requirements Pills -->
        <div class="meta-pills">
          <span class="meta-pill"><i data-lucide="award" class="icon-xs"></i> Min CGPA: ${s.min_cgpa.toFixed(2)}</span>
          <span class="meta-pill"><i data-lucide="book-open" class="icon-xs"></i> Dept: ${s.department_raw}</span>
          <span class="meta-pill"><i data-lucide="calendar" class="icon-xs"></i> Deadline: ${s.deadline}</span>
          ${s.need_based ? '<span class="meta-pill text-crimson font-bold"><i data-lucide="heart-handshake" class="icon-xs"></i> Need-Based</span>' : ''}
          ${s.gender === 'Female' ? '<span class="meta-pill" style="color:#D946EF;"><i data-lucide="user" class="icon-xs"></i> Female Only</span>' : ''}
        </div>

        <!-- Near-Miss Missing Reasons -->
        ${isAlmost ? `
          <div class="missing-radar-box">
            <div class="missing-title"><i data-lucide="alert-circle" class="icon-xs"></i> ${SCHOLARSHIP_I18N[currentLang].missingRequirement}:</div>
            <p class="text-xs font-semibold text-main">${escapeHtml(missingStr)}</p>
          </div>
        ` : ''}

        <!-- AI Match Reason (PRD Requirement: For each result, the AI writes a short reason why it is a good match) -->
        ${!isAlmost ? `
          <div class="ai-rationale-box">
            <div class="ai-rationale-header">
              <i data-lucide="sparkles" class="icon-xs text-crimson"></i>
              <span>${currentLang === 'bn' ? 'এআই ম্যাচ বিশ্লেষণ' : 'AI MATCH RATIONALE'}</span>
            </div>
            <p class="ai-rationale-text">${escapeHtml(reason)}</p>
          </div>
        ` : ''}

        <!-- Card Footer -->
        <div class="card-footer-row">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <button class="btn-outline-sm" onclick="openChecklist(${s.id})">
              <i data-lucide="list-checks" class="icon-xs text-crimson"></i>
              <span>${SCHOLARSHIP_I18N[currentLang].checklistBtn}</span>
            </button>
            <button class="btn-ask-ai-sm" data-award-name="${escapeHtml(s.name)}" onclick="askAdvisorAboutAward(this.getAttribute('data-award-name'))">
              <i data-lucide="message-circle" class="icon-xs"></i>
              <span>${currentLang === 'bn' ? 'এআই জিজ্ঞাসা' : 'Ask AI'}</span>
            </button>
          </div>
          <span class="text-xs text-faint font-mono">#${s.id}</span>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;
}

function renderTable(items) {
  const tbody = document.getElementById('table-body');
  let html = '';
  items.forEach(item => {
    const s = item.record;
    const isAlmost = (currentTab === 'almost');
    const amountStr = s.amount_bdt ? `BDT ${s.amount_bdt.toLocaleString('en-US')}` : 'Full Waiver';
    const reason = isAlmost 
      ? ((currentLang === 'bn') ? item.missing_summary_bn : item.missing_summary_en)
      : ((currentLang === 'bn') ? item.match_reason_bn : item.match_reason_en);

    html += `
      <tr>
        <td class="font-bold text-main">${escapeHtml(s.name)}</td>
        <td class="text-xs">${escapeHtml(s.provider)}</td>
        <td class="text-xs font-mono">${s.department_raw}</td>
        <td class="text-xs font-mono font-bold">${s.min_cgpa.toFixed(2)}</td>
        <td class="text-xs font-bold text-crimson whitespace-nowrap">${amountStr}</td>
        <td class="text-xs font-mono whitespace-nowrap">${s.deadline}</td>
        <td class="text-xs text-muted" style="max-width:320px;">${escapeHtml(reason)}</td>
        <td>
          <button class="btn-outline-xs" onclick="openChecklist(${s.id})" title="View Checklist">
            <i data-lucide="list-checks" class="icon-xs"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function openChecklist(id) {
  const all = [...matchedItems, ...almostItems];
  const item = all.find(i => i.record.id === id);
  if (!item) return;

  const s = item.record;
  document.getElementById('modal-award-title').innerText = s.name;
  const listEl = document.getElementById('modal-checklist-items');

  let html = '';
  (item.checklist || []).forEach((step, idx) => {
    const title = (currentLang === 'bn') ? step.title_bn : step.title_en;
    const detail = (currentLang === 'bn') ? step.detail_bn : step.detail_en;

    html += `
      <label class="checklist-step">
        <input type="checkbox" />
        <div style="flex:1;">
          <p class="font-bold text-xs text-main">${escapeHtml(title)}</p>
          <p class="text-xs text-muted mt-0.5">${escapeHtml(detail)}</p>
        </div>
      </label>
    `;
  });

  listEl.innerHTML = html;
  toggleModal(true);
  lucide.createIcons();
}

function toggleModal(show) {
  const m = document.getElementById('checklist-modal');
  if (show) m.classList.remove('hidden');
  else m.classList.add('hidden');
}

function closeChecklistModal(e) {
  toggleModal(false);
}

// Gemini AI Strategic Advisor
async function getGeminiAdvice() {
  const cgpa = document.getElementById('cgpa-input').value;
  const dept = document.getElementById('dept-select').value;
  const need = document.getElementById('need-checkbox').checked;
  const topNames = matchedItems.slice(0, 8).map(i => i.record.name);

  document.getElementById('modal-award-title').innerText = (currentLang === 'bn') ? "জেমিনাই এআই স্কলারশিপ কৌশলগত পরামর্শ" : "Gemini AI Strategic Scholarship Advisory";
  const listEl = document.getElementById('modal-checklist-items');
  listEl.innerHTML = `<div class="quiz-loading-state"><div class="spinner"></div><p class="loading-text">Generating tailored scholarship application strategy with Gemini...</p></div>`;
  toggleModal(true);

  try {
    const res = await fetch('/api/ai_advise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cgpa,
        department: dept,
        need_based: need,
        matched_names: topNames,
        lang: currentLang
      })
    });
    const data = await res.json();
    if (data.success && data.advice) {
      listEl.innerHTML = `
        <div style="padding:0.5rem; line-height:1.6; font-size:0.86rem; color:var(--text-main); white-space:pre-wrap;">
          ${escapeHtml(data.advice)}
        </div>
      `;
    } else {
      listEl.innerHTML = `<p class="text-xs text-crimson">Failed to generate advice: ${escapeHtml(data.error || 'Server error')}</p>`;
    }
  } catch (err) {
    listEl.innerHTML = `<p class="text-xs text-crimson">Connection error: ${escapeHtml(err.message)}</p>`;
  }
}

// Download Results as CSV (Bonus requirement)
async function exportScholarships() {
  const items = getFilteredAndSortedItems();
  if (items.length === 0) {
    alert('No scholarships to export.');
    return;
  }

  const cgpa = document.getElementById('cgpa-input').value;
  const dept = document.getElementById('dept-select').value;
  const need = document.getElementById('need-checkbox').checked;

  try {
    const res = await fetch('/api/export_scholarships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cgpa,
        department: dept,
        need_based: need,
        items,
        lang: currentLang
      })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oiraboot_scholarships_${dept}_cgpa${cgpa}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert('Export error: ' + err.message);
  }
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


/* ================================================================== */
/* AI SCHOLARSHIP CHAT — CLIENT LOGIC                                  */
/* ================================================================== */

let scholarshipChatHistory = [];   // [{role:"user"|"assistant", content:"..."}]
let extraThinkEnabled = false;
let chatPanelOpen = true;
let chatIsBusy = false;

/* Called once on DOMContentLoaded */
function initScholarshipChat() {
  const welcomeEn = `<strong>Welcome! I'm your Oiraboot Scholarship Advisor.</strong><br>
Tell me about your CGPA, department, and financial situation. I'll recommend the best-matched scholarships from our verified catalog of 136 awards.<br><br>
<em>Try: "My CGPA is 3.6, I'm in CSE and I need financial aid."</em>`;
  const welcomeBn = `<strong>স্বাগতম! আমি আপনার ওইরাবুট স্কলারশিপ উপদেষ্টা।</strong><br>
আপনার CGPA, বিভাগ ও আর্থিক অবস্থা জানান। আমি যাচাইকৃত ১৩৬টি বৃত্তির মধ্য থেকে আপনার জন্য সেরাগুলো সুপারিশ করব।`;
  appendScholarshipMessage('assistant', currentLang === 'bn' ? welcomeBn : welcomeEn);
}

function openScholarshipChat() {
  if (!chatPanelOpen) toggleChatPanel();
  const input = document.getElementById('scholarship-chat-input');
  if (input) input.focus();
}

function toggleChatPanel() {
  chatPanelOpen = !chatPanelOpen;
  const panel = document.getElementById('ai-chat-panel');
  const collapsedBar = document.getElementById('chat-collapsed-bar');
  const icon = document.getElementById('chat-collapse-icon');

  if (chatPanelOpen) {
    panel.style.display = 'flex';
    if (collapsedBar) collapsedBar.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-up');
  } else {
    panel.style.display = 'none';
    if (collapsedBar) collapsedBar.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'chevron-down');
  }
  lucide.createIcons();
}

async function handleScholarshipChatSubmit(e) {
  e.preventDefault();
  if (chatIsBusy) return;

  const input = document.getElementById('scholarship-chat-input');
  const message = (input.value || '').trim();
  if (!message) return;

  input.value = '';
  input.disabled = true;
  chatIsBusy = true;
  document.getElementById('chat-send-btn').disabled = true;

  // Hide quick prompts after first message
  const qp = document.getElementById('chat-quick-prompts');
  if (qp && scholarshipChatHistory.length > 0) qp.style.display = 'none';

  // Show user bubble
  appendScholarshipMessage('user', escapeHtml(message));

  // Add to history
  scholarshipChatHistory.push({ role: 'user', content: message });

  // Show thinking shimmer
  const thinkingId = showThinkingShimmer();

  // Pull current profile from sidebar for grounded context
  const cgpa = document.getElementById('cgpa-input')?.value || '';
  const dept = document.getElementById('dept-select')?.value || 'All';
  const need = document.getElementById('need-checkbox')?.checked || false;
  const gender = document.getElementById('gender-select')?.value || 'All';

  try {
    const res = await fetch('/api/scholarship_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        cgpa: cgpa ? parseFloat(cgpa) : null,
        department: dept,
        need_based: need,
        gender,
        lang: currentLang,
        extra_think: extraThinkEnabled,
        history: scholarshipChatHistory.slice(-10),
      }),
    });

    removeThinkingShimmer(thinkingId);

    const data = await res.json();

    if (data.success) {
      const answer = data.answer || 'No response received.';
      const verNote = data.verification_note || '';
      scholarshipChatHistory.push({ role: 'assistant', content: answer });
      appendScholarshipMessage('assistant', formatAIResponse(answer), verNote);
    } else {
      appendScholarshipMessage('assistant', `<span style="color:var(--crimson);">Error: ${escapeHtml(data.error || 'Server error.')}</span>`);
    }
  } catch (err) {
    removeThinkingShimmer(thinkingId);
    appendScholarshipMessage('assistant', `<span style="color:var(--crimson);">Connection error: ${escapeHtml(err.message)}</span>`);
  } finally {
    input.disabled = false;
    chatIsBusy = false;
    document.getElementById('chat-send-btn').disabled = false;
    input.focus();
  }
}

function appendScholarshipMessage(role, htmlContent, verificationNote = '') {
  const feed = document.getElementById('scholarship-chat-messages');
  if (!feed) return;

  const isUser = role === 'user';
  const avatarClass = isUser ? 'user-av' : 'ai-av';
  const avatarIcon = isUser
    ? '<i data-lucide="user" style="width:12px;height:12px;"></i>'
    : '<i data-lucide="bot" style="width:12px;height:12px;"></i>';
  const bubbleClass = isUser ? 'user-bubble' : 'ai-bubble';
  const rowClass = isUser ? 'user-row' : '';

  const noteHtml = verificationNote
    ? `<div class="sc-verify-note"><i data-lucide="shield-check" style="width:11px;height:11px;"></i>${escapeHtml(verificationNote)}</div>`
    : '';

  const msgEl = document.createElement('div');
  msgEl.className = `sc-msg-row ${rowClass}`;
  msgEl.innerHTML = `
    <div class="sc-msg-avatar ${avatarClass}">${avatarIcon}</div>
    <div class="sc-msg-bubble ${bubbleClass}">
      ${htmlContent}
      ${noteHtml}
    </div>`;

  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;
  lucide.createIcons();
}

function showThinkingShimmer() {
  const feed = document.getElementById('scholarship-chat-messages');
  if (!feed) return null;

  const label = extraThinkEnabled
    ? (currentLang === 'bn' ? 'দুটি এআই বিশ্লেষণ চলছে...' : 'Cross-verifying with dual AI passes...')
    : (currentLang === 'bn' ? '১৩৬টি বৃত্তি বিশ্লেষণ করা হচ্ছে...' : 'Analyzing against 136 scholarships...');

  const shimmer = document.createElement('div');
  const id = 'thinking-' + Date.now();
  shimmer.id = id;
  shimmer.className = 'sc-msg-row';
  shimmer.innerHTML = `
    <div class="sc-msg-avatar ai-av"><i data-lucide="bot" style="width:12px;height:12px;"></i></div>
    <div class="sc-thinking">
      <div class="sc-thinking-dots"><span></span><span></span><span></span></div>
      <span>${escapeHtml(label)}</span>
    </div>`;
  feed.appendChild(shimmer);
  feed.scrollTop = feed.scrollHeight;
  lucide.createIcons();
  return id;
}

function removeThinkingShimmer(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function formatAIResponse(text) {
  if (!text) return '';
  // Convert numbered lists (1. 2. 3.) and bullet points into clean HTML
  let html = escapeHtml(text);
  // Bold: **text** or *text*
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

function sendScholarshipQuick(text) {
  const input = document.getElementById('scholarship-chat-input');
  if (!input) return;
  input.value = text;
  handleScholarshipChatSubmit(new Event('submit'));
}

function toggleExtraThink() {
  extraThinkEnabled = !extraThinkEnabled;
  const btn = document.getElementById('extra-think-btn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(extraThinkEnabled));
  if (extraThinkEnabled) {
    btn.style.borderColor = '#7c3aed';
    btn.style.background = '#7c3aed';
    btn.style.color = '#fff';
  } else {
    btn.style.borderColor = '';
    btn.style.background = '';
    btn.style.color = '';
  }
}

async function clearScholarshipChat() {
  scholarshipChatHistory = [];
  const feed = document.getElementById('scholarship-chat-messages');
  if (feed) feed.innerHTML = '';
  const qp = document.getElementById('chat-quick-prompts');
  if (qp) qp.style.display = '';
  initScholarshipChat();
}

// (init called by DOMContentLoaded above)


function askAdvisorAboutAward(awardName) {
  if (!awardName) return;
  openScholarshipChat();
  const prompt = (currentLang === 'bn')
    ? `${awardName} বৃত্তির জন্য ন্যূনতম CGPA, অনুদানের পরিমাণ ও আবেদনের শর্তগুলো বিস্তারিত বলুন।`
    : `Tell me the exact minimum CGPA, amount, deadline, and eligibility details for ${awardName}.`;
  sendScholarshipQuick(prompt);
  const panel = document.getElementById('ai-chat-panel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
