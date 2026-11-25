# Document Intelligence Studio (Track 1)
### PCIU Computer Club Beginner AI Hackathon
**Track 1: Document Intelligence & Semantic Search (RAG) — Chat & Quiz with Your PDF**

---

## 🛠 Tech Stack
- **Backend:** Python 3.13 + **Flask**
- **Frontend / Templating:** **HTML5**, **CSS3**, **Jinja2** templates, Vanilla JavaScript (zero clunky frontend dependencies)
- **AI / LLM & Embedding Engine:** Google Gemini API (`gemini-3.5-flash-lite` for fast low-latency generation with fallback, plus `gemini-embedding-001` for semantic vector reranking)
- **Hybrid RAG Retrieval (50–100+ Page Scale):** Structure-aware overlapping chunking (`~700` chars) + **Okapi BM25** (`rank-bm25`) + Bengali/English digit normalization + **Reciprocal Rank Fusion (RRF)** cosine reranking (`numpy`)
- **PDF Extraction:** PyMuPDF (`pymupdf`) & `pypdf` (line-preserving multi-page text parsing with exact page indexing)

---

## 🎯 Track 1 Problem Statement Compliance

### ✅ Must-Have Requirements
1. **Upload one PDF and extract its text:**
   - Text-based PDF extraction per page using PyMuPDF and pypdf.
   - Built-in preloaded sample lecture notes (`CS301_AI_and_RAG_Notes.pdf`).
2. **Chat box where user asks questions:**
   - Dedicated Document Chat workbench with streaming-like visual state.
3. **Each answer shows the part of the PDF it came from:**
   - Every answer displays a verbatim excerpt quote box from the exact PDF page.
4. **Strict refusal if answer is not in PDF:**
   - If the answer is not explicitly in the document, the app strictly returns `"Not found in the document."` and highlights the grounded refusal badge (hallucination prevention).
5. **"Generate Quiz" button (at least 5 MCQs, 4 options each, 1 correct):**
   - Generates 5, 6, 8, or 10 multiple-choice questions strictly from the document.
   - Exactly 4 options per question with 1 correct answer.
6. **Answer the quiz and see correct answers with a final score:**
   - Live interactive quiz answering, instant score calculation (e.g. `4 / 5 (80%)`), green/red option feedback, and retake functionality.

### 🌟 All 6 Bonus Features Implemented
1. **Choose number of questions and difficulty level:**
   - Configurable question count (5, 6, 8, 10).
   - Configurable difficulty (Foundational / Intermediate / Advanced).
2. **Show the PDF part that explains each correct answer:**
   - After grading, each question reveals the exact verbatim `explanationQuote` from the PDF.
3. **Page numbers in the sources:**
   - Displays exact integer page numbers (e.g. `CS301_AI_and_RAG_Notes.pdf • Page 2`) for both Chat citations and Quiz proofs.
4. **Support for more than one PDF:**
   - Multi-PDF upload and management in the Document Vault.
   - Toggle individual PDFs active/inactive for targeted RAG context.
   - Delete individual PDFs or restore the default sample.
5. **Bangla questions and answers:**
   - Full support for Bengali! Asking questions in Bangla produces fluent, natural Bengali answers grounded in the document with cited page numbers and verbatim excerpts.
   - Quiz generation available in Bangla.
6. **Download the quiz result:**
   - "Download Result" button generates a clean, printable HTML assessment report (with user score, chosen answers, correct answers, and document citations) that can be saved as PDF or printed.

---

## 🚀 How to Run Locally

### 1. Prerequisites
- Python 3.10+ (Tested with Python 3.13)
- Pip

### 2. Environment Setup
The API key is already configured in `.env`:
```env
GEMINI_API_KEY="AQ.Ab8RN6IQhExeD-3dvs8LiTMf1AMHaXrPmVN6iyGG_vR4sr--Og"
GEMINI_MODEL="gemini-3.5-flash"
PORT=5000
FLASK_DEBUG=1
SECRET_KEY="docintel-track1-pciu-secret-key"
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start the Flask Server
```bash
python app.py
```

Open your browser at:
👉 **http://localhost:5000**

---

## 🧪 Testing and Verification Bench
The system comes with a one-click verification shelf on the sidebar:
- **Test 1: In-Doc Grounding:** *"What is Retrieval-Augmented Generation and why is it used?"* -> Returns verified answer citing Page 1.
- **Test 2: Mathematical / Technical:** *"Explain the Scaled Dot-Product Attention mechanism formula in Transformers."* -> Cites Page 2 and formula.
- **Test 3: Out-of-Document Refusal:** *"Who won the 2022 FIFA World Cup?"* -> Returns `"Not found in the document."`
- **Test 4: Bangla Grounding:** *"ওভারফিটিং (Overfitting) কী এবং কীভাবে কমানো যায়?"* -> Returns natural Bengali answer citing Page 3.
- **Test 5: Multi-PDF Upload:** Upload `problem-statement-e3fb21da4b4a.pdf` and ask *"What is the challenge in Track 1?"* -> Returns challenge summary citing Page 1 of the uploaded PDF!
