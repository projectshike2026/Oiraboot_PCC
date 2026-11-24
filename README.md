# Oiraboot (ঐরাবত) — Academic Intelligence Suite

A unified, multi-page academic intelligence suite combining **Document Studio** (Track 1), **Admissions Desk** (Track 2), and **Scholarship Atlas** (Track 3) into an institutional platform. Built with Classical Monumental Typography, precision UI, deep crimson accents, and strict zero-hallucination verification.

---

## 🏛️ Multi-Page Studio Architecture

Rather than crowding all tools into a single page, Oiraboot provides an **Overview Portal** and dedicated, isolated studio workspaces for each track:

| Route | Studio / Module | Description & Capabilities |
|---|---|---|
| **`/`** | **Overview & Portal** | Monumental landing portal showcasing Oiraboot, interactive Three.js 3D wireframe sculpture, typewriter capability stream, architectural guarantees, and direct entry points to all studios. |
| **`/documents`** | **Document Studio (Track 1)** | Dedicated full-screen studio for multi-PDF lecture indexing, character-verified page citations, strict out-of-document refusal, and 5–15 MCQ self-assessment engine with source proofs and CSV export. |
| **`/admissions`** | **Admissions Desk (Track 2)** | Dedicated university enrollment concierge with multi-turn conversational memory, clarifying query handling, numerical fact validation, official desk referrals, and live 6-step checklist with circular progress ring. |
| **`/scholarships`** | **Scholarship Atlas (Track 3)** | Dedicated financial aid matching platform with interactive CGPA slider, department filter, need toggle, instant CSV catalog ingestion, tailored AI fit rationales, and Almost-Eligible Gap Radar. |
| **`/about`** | **Architecture Whitepaper** | Deep-dive explanation of zero-hallucination server-side verification, BM25 retrieval, bilingual support, and platform design decisions. |
| **`/result/<id>`** | **Printable Quiz Report** | Official assessment results page with percentage score, question breakdown, user selections, official keys, and verified source citations (print & CSV export). |

---

## 🏛️ Feature Matrix & Track Completion

| Track & Pillar | Requirements & Features | Status |
|---|---|:---:|
| **Track 1: Document Studio** (`/documents`) | • Text-based PDF extraction per page via PyMuPDF (`fitz`)<br>• Interactive Q&A chat box grounded strictly in uploaded documents<br>• Server-side verified quote citations with exact page numbers & filenames<br>• Strict out-of-document refusal guardrail: `"Not found in the document"` (plus Bangla subtext)<br>• Configurable MCQ quiz builder (5–15 questions, difficulty levels: Easy/Medium/Hard)<br>• Real exam interface, in-place grading, stamp animations, score ring<br>• Verified source explanation proof for every correct/incorrect question<br>• Multi-PDF Library Vault (ask across all active PDFs)<br>• Download quiz report as CSV and printable page view<br>• Fluent bilingual English & Bangla questions & answers | **COMPLETE (Must-haves + all bonuses)** |
| **Track 2: Admissions Desk** (`/admissions`) | • Admissions chat grounded in official institutional records (`data/admission.txt`)<br>• Conversational memory for multi-turn follow-ups (*"What is the fee?"* &rarr; *"And for BBA?"*)<br>• Clarifying prompts when queries are vague (*"tell me about fees"* asks for department)<br>• Strict numerical verification (prevents hallucinating ungrounded fees or dates)<br>• Polite referral to Oiraboot Admission Desk (`+880 1851-120791`, `admission@oiraboot.edu.bd`) when info is absent<br>• Interactive 6-step admissions checklist with SVG circular progress ring<br>• Bilingual English & Bangla conversational concierge<br>• Quick prompt suggestion chips and Clear Chat button | **COMPLETE (Must-haves + all bonuses)** |
| **Track 3: Scholarship Atlas** (`/scholarships`) | • Form input for student CGPA, department, and financial support need<br>• Ingestion of live scholarship CSV catalogs (`data/scholarships.csv`) with flexible synonym mapping<br>• Deterministic eligibility matching based on CGPA, department, and need<br>• Personalized AI fit rationales and application checklists for every eligible award<br>• Zero-downtime template fallback so results display immediately in &lt; 300ms<br>• **Almost-Eligible Gap Radar** displaying narrow misses with exact missing criteria delta<br>• Instant client-side re-sorting by Award Amount or Deadline<br>• Toggleable Card and Data Table views<br>• Full CSV export with UTF-8 BOM for Microsoft Excel compatibility<br>• Bilingual English & Bangla interface and rationales | **COMPLETE (Must-haves + all bonuses)** |

---

## ⚡ 3-Minute Demo Script for Judges

### Minute 1: Document Studio (`/documents`)
1. **Drop Notes & Inspect:** The lecture notes (*CS301: Foundations of AI & RAG Systems*, 4 pages) are pre-indexed in the Library Vault. Click **"Inspect Pages"** to review the extracted text.
2. **Grounded Citation:** Click the sample prompt: *"What is Retrieval-Augmented Generation and why is it used?"*. Notice the answer with verified green quote badge and **Page 1** tag.
3. **Out-of-Document Refusal:** Click *"Who won the 2022 FIFA World Cup?"*. Observe the strict refusal card: **"Not found in the document"** (zero hallucination).
4. **Bangla Query:** Click *"Bangla: ওভারফিটিং কী?"*. The engine responds in fluent Bangla with Page 3 citations.
5. **MCQ Quiz Engine:** Switch to the **Quiz Engine** tab. Select 5 questions at Intermediate difficulty and click **"Generate Quiz"**. Answer questions, grade in-place, and inspect the source proofs with page citations. Click **"Export CSV"**.

### Minute 2: Admissions Desk (`/admissions`)
1. Navigate to **Admissions Desk** via the navbar.
2. Click the prompt: *"What is the tuition fee for CSE?"*. Notice the exact breakdown: **BDT 4,48,000 (150 Credits)**.
3. Follow up immediately with *"And for BBA?"*. Notice how the multi-turn conversational memory resolves the context and returns **BDT 3,92,000 (126 Credits)**.
4. Test out-of-scope query: type *"Do you have a swimming pool on campus?"*. Notice the polite referral to the official Admission Desk with phone (`+880 1851-120791`) and email (`admission@oiraboot.edu.bd`).
5. Test clarifying logic: type *"Tell me about fees"*. The advisor asks which department you are interested in.
6. Check an item on the **Admission Checklist** on the right and watch the circular progress ring advance.

### Minute 3: Scholarship Atlas (`/scholarships`)
1. Navigate to **Scholarship Atlas** via the navbar.
2. Adjust the CGPA slider to **3.75**, select **CSE**, and toggle **Financial Support Required**.
3. Click **"Evaluate & Match Awards"**. Eligible awards appear instantly with fit summaries and application checklists.
4. Review the **Almost-Eligible Gap Radar** below: observe the *Oiraboot Chancellor Merit Excellence Award* flagged with exact missing requirement: *"Need +0.10 CGPA (Min 3.85)"*.
5. Switch sorting between **Amount** and **Deadline**, toggle between **Cards** and **Table**, and click **"Export CSV"**.
6. Switch theme to **White Mode / Black Mode** and language to **বাংলা** to experience seamless bilingual synchronization.

---

## 🛠️ Tech Stack & Constraints

- **Language:** Python 3.11+
- **Web Framework:** Flask 3, Jinja2
- **Database:** SQLite with WAL mode (`PRAGMA journal_mode=WAL; foreign_keys=ON;`)
- **PDF Extraction:** PyMuPDF (`fitz` / `pymupdf`)
- **HTTP & LLM Client:** `requests` (OpenAI-compatible endpoints: Gemini, Groq, Ollama, OpenAI)
- **Zero-Failure Offline Mode:** Built-in deterministic mock provider (`MOCK_LLM=1` or automatic fallback when no API key is provided) ensuring the app and tests run anywhere without internet dependencies.
- **Frontend:** Modular multi-page Jinja templates, Classical Monumental typography (`Cinzel`, `Cormorant Garamond`, `Plus Jakarta Sans`, `Hind Siliguri`, `JetBrains Mono`), Three.js 3D wireframe sculpture, Tailwind CSS, Lucide icons.

---

## 🚀 Local Installation & Quickstart

### 1. Clone & Enter Project
```bash
git clone <repo-url>
cd "pcc project"
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional)* Add your Gemini or OpenAI API key in `.env`:
```env
LLM_API_KEY=your_gemini_api_key_here
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.0-flash
```
*Note: If no API key is provided, the application automatically operates in deterministic zero-cost offline mode with complete mock grounding.*

### 4. Run the Application
```bash
python app.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 🧪 Running the Automated Test Suite

Run all unit and integration tests across text processing, RAG, quiz generation, admissions memory, and scholarship matching:
```bash
python -m pytest -v
```

All 24 tests pass with 100% success rate:
- `test_api.py`: Healthcheck, Overview portal (`/`), Document Studio (`/documents`), Admissions Desk (`/admissions`), Scholarship Atlas (`/scholarships`), About whitepaper (`/about`), CSRF protection, bilingual switching, admissions chat, scholarship matcher, and CSV export.
- `test_textutil.py`: Normalization, tokenization (EN + BN), lang detection, BM25, exact/fuzzy/rejected quote verification.
- `test_track1.py`: PDF extraction, page indexing, RAG grounding, out-of-document refusal, prompt injection defense, quiz generation, secret key preservation, server grading.
- `test_track2.py`: Admissions knowledge base retrieval, multi-turn follow-up resolution, clarifying prompts, numeric fact checking, checklist progress.
- `test_track3.py`: Scholarship matching, CGPA/department filtering, AI fit rationales, almost-eligible gap calculation.
