# PCIU Computer Club — Academic Intelligence Suite (Track 1)
## Document Intelligence & Semantic Search (RAG): Chat & Quiz with Your PDF

A production-grade Flask + Jinja2 + HTML/CSS academic platform tailored strictly to **Track 1** specifications of the Beginner AI Hackathon (PCIU Computer Club).

---

### Features & Hackathon Requirements Coverage

#### Must-Have Requirements
1. **Upload PDF & Extract Text**:
   - High-speed page-by-page text extraction via `PyMuPDF` (`pymupdf`) with fallback to `pypdf`.
   - Pre-loads default sample PDF (`problem-statement-e3fb21da4b4a.pdf`) automatically out-of-the-box.
2. **Chat Box with Document Intelligence**:
   - Ask any question regarding the PDF notes.
   - Page-level citations and verbatim excerpts in every answer.
3. **Strict Hallucination Prevention / Guardrail**:
   - If an answer is absent from the document, the AI strictly responds with:
     `"Not found in the document"`.
4. **Automated Quiz Generation**:
   - "Generate Quiz" button produces at least 5 multiple-choice questions (4 options each, exactly 1 correct answer).
5. **Interactive Quiz Assessment & Scoring**:
   - Interactive radio selection for each question.
   - Calculates score, percentage, highlights correct vs user picks, and shows source citations.

#### Bonus Features
- **Configurable Questions & Difficulty**: Choose 5, 8, or 10 questions; Easy, Medium, or Hard difficulty.
- **Source Proof Citations**: Every correct quiz answer includes the exact PDF excerpt and page number.
- **Page Numbers in Sources**: Both Q&A and quiz explanations display source page numbers.
- **Multi-PDF Support**: Upload and query single or multiple PDFs simultaneously.
- **Bangla Support (বাংলা)**: Fluent bilingual Q&A, interface toggle, and Bangla quiz generation.
- **Downloadable Quiz Assessment**: Download a formatted text report with score, questions, answers, and source citations.

---

### Tech Stack
- **Backend**: Python 3, Flask, Jinja2, PyMuPDF, python-dotenv
- **AI Models**: Google Gemini API (`gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.8-flash`)
- **Frontend**: Standard HTML5, CSS3 (Light/Dark Classical Editorial Theme), Vanilla JavaScript, Lucide Icons

---

### How to Run Locally

1. **Activate or verify environment**:
   Make sure dependencies are installed:
   ```bash
   pip install flask python-dotenv pymupdf pypdf requests groq
   ```

2. **Start the Flask server**:
   ```bash
   python app.py
   ```
   Or double-click `start.bat`.

3. **Open in browser**:
   Navigate to:
   [http://localhost:8080](http://localhost:8080)
