# Oiraboot (ঐরাবত) — Official OONORI Academic Intelligence Suite

Oiraboot is an official **OONORI** academic intelligence platform uniting **AI Engine** (Track 1: Document RAG & Adaptive Quiz), **Admissions Desk** (Track 2: Grounded Enrollment Counselor), and **Scholarship Atlas** (Track 3: Scholarship Matcher & AI Advisor) under a single unified web architecture.

---

## Proprietary Rights & Ownership

Copyright (c) 2026 **OONORI**. All rights reserved.

This system is an official **OONORI** system. All intellectual property rights to this platform, including the user interface, backend architecture, source code, orchestration pipelines, data schemas, and documentation, are strictly reserved to **OONORI**. Unauthorized reproduction, redistribution, reverse engineering, or commercial deployment without written authorization from **OONORI** is prohibited.

---

## System Architecture

Oiraboot runs as a unified Flask application supporting single-port production hosting (Render / Gunicorn) as well as local development:

| Route / Endpoint | Module | Description |
|---|---|---|
| `/` | Overview Portal | Main landing workspace showcasing the Oiraboot system and navigation to all three modules. |
| `/documents` | AI Engine (Track 1 Overview) | Multi-PDF Q&A overview, quick verification showcase, and entry point to `/track1-studio/`. |
| `/track1-studio/` | AI Engine Studio (Track 1) | Full RAG & Adaptive Quiz workspace with multi-PDF upload, BM25 + embedding retrieval, strict verbatim page citations, and dual-pass cross-verification. |
| `/admissions` | Admissions Desk (Track 2) | Conversational enrollment advisor grounded strictly in official institutional records (`data/admission.txt`) with multi-turn memory, numerical validation, and a live 6-step checklist. |
| `/scholarships` | Scholarship Atlas (Track 3 Overview) | Real-time CGPA, department, and financial-need matcher with CSV catalog ingestion, Gap Radar, and entry point to `/track3-atlas/`. |
| `/track3-atlas/` | Scholarship Atlas Studio (Track 3) | Interactive scholarship discovery catalog (136 verified awards) paired with an AI Scholarship Advisor chat and dual-pass Extra Think verification. |
| `/about` | Architecture Whitepaper | Technical overview of source verification, retrieval pipelines, and bilingual parity. |
| `/healthz` | Healthcheck | JSON healthcheck endpoint for deployment monitoring. |

---

## AI APIs & Models Used

Oiraboot integrates multiple AI APIs with strict server-side grounding and deterministic fallbacks:

### 1. Google Gemini API (`google-genai` SDK & REST `v1beta`)
- **Primary Chat & OpenAI-Compatible Endpoint (`core/llm.py`, `config.py`)**: `gemini-2.0-flash`
- **Track 1 AI Engine RAG & Quiz (`Trackone/rag_engine.py`)**:
  - Primary model: `models/gemini-3.1-flash-lite`
  - Fallback / Extensive chain: `models/gemini-3.5-flash-lite`, `models/gemini-3.6-flash`, `models/gemini-3.7-flash`, `models/gemini-3.8-flash`
  - Embeddings (Semantic Cosine Reranker): `gemini-embedding-001`
- **Track 3 Scholarship Advisor (`trackthree/ai_service.py`)**:
  - Primary & fallback models: `gemini-flash-lite-latest`, `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-2.5-flash-preview-05-20`

### 2. Groq API (`groq` SDK & REST `api.groq.com/openai/v1`)
- **Track 1 Dual-Pass Cross-Verification (`Trackone/rag_engine.py`)**: `openai/gpt-oss-120b` (with `qwen/qwen3.8-27b` and `openai/gpt-oss-20b` fallback)
- **Track 3 Extra Think Synthesis (`trackthree/ai_service.py`)**: `llama3-8b-8192`

### 3. Hybrid Retrieval & Verification Stack
- **PDF Extraction**: PyMuPDF (`fitz` / `pymupdf`) and `pypdf`
- **Lexical Retrieval**: Okapi BM25 (`rank-bm25`) with English and Bengali digit normalization
- **Vector Math**: `numpy`
- **Offline / Test Mode**: Deterministic mock LLM (`MOCK_LLM=1`) for offline verification without external API dependency

---

## Local Setup & Quickstart

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and populate your keys:
```env
SECRET_KEY=your-secret-key
CHOSEN_TRACK=all
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_API_KEY=your-gemini-api-key
GEMINI_API_KEY=your-gemini-api-key
SECONDARY_GEMINI_KEY=your-secondary-gemini-api-key
GROQ_API_KEY=your-groq-api-key
LLM_MODEL=gemini-2.0-flash
GEMINI_MODEL=gemini-3.5-flash-lite
MOCK_LLM=0
```

### 3. Start the Unified Application
```bash
python app.py
```
Open `http://127.0.0.1:5000` in your browser.

---

## Production Deployment (Render)

The repository includes `render.yaml` configured for single-port Gunicorn deployment:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn "app:create_app()" --workers 1 --threads 8 --timeout 120 --bind 0.0.0.0:$PORT`
- **Health Check Path**: `/healthz`

---

## Automated Verification

Run the primary pytest suite:
```bash
python -m pytest tests/ -v
```
