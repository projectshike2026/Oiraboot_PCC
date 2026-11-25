import re
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


class RAGEngine:
    def __init__(self):
        # In-memory document registry: {doc_id: doc_dict}
        self.documents: Dict[str, Dict[str, Any]] = {}

    def extract_pdf(self, file_path: str, original_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract text page-by-page with page metadata from a PDF file.
        Uses PyMuPDF (fitz) or pypdf as fallback.
        """
        p = Path(file_path)
        filename = original_filename or p.name
        doc_id = p.stem.lower()

        pages_data = []
        total_text = []

        if fitz is not None:
            doc = fitz.open(str(p))
            for page_index in range(len(doc)):
                page = doc[page_index]
                text = page.get_text("text").strip()
                # Clean excessive blank lines
                cleaned_text = re.sub(r"\n{3,}", "\n\n", text)
                pages_data.append({
                    "page_number": page_index + 1,
                    "text": cleaned_text,
                    "char_count": len(cleaned_text),
                    "word_count": len(cleaned_text.split())
                })
                total_text.append(cleaned_text)
            doc.close()
        elif PdfReader is not None:
            reader = PdfReader(str(p))
            for page_index, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                cleaned_text = re.sub(r"\n{3,}", "\n\n", text.strip())
                pages_data.append({
                    "page_number": page_index + 1,
                    "text": cleaned_text,
                    "char_count": len(cleaned_text),
                    "word_count": len(cleaned_text.split())
                })
                total_text.append(cleaned_text)
        else:
            raise RuntimeError("No PDF extraction library available (neither pymupdf nor pypdf found).")

        full_doc = {
            "id": doc_id,
            "filename": filename,
            "path": str(p),
            "total_pages": len(pages_data),
            "total_chars": sum(p["char_count"] for p in pages_data),
            "total_words": sum(p["word_count"] for p in pages_data),
            "pages": pages_data
        }

        self.documents[filename] = full_doc
        return full_doc

    def remove_document(self, filename: str) -> bool:
        if filename in self.documents:
            del self.documents[filename]
            return True
        return False

    def clear_documents(self):
        self.documents.clear()

    def get_all_documents(self) -> List[Dict[str, Any]]:
        return list(self.documents.values())

    def get_document_summary(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": doc["id"],
                "filename": doc["filename"],
                "total_pages": doc["total_pages"],
                "total_words": doc["total_words"]
            }
            for doc in self.documents.values()
        ]

    def build_context(self, query: str = "", max_chars: int = 40000) -> str:
        """
        Builds clear page-referenced context for the LLM.
        Each page is formatted with its Document name and Page number so the AI
        can cite exact sources.
        """
        if not self.documents:
            return ""

        context_blocks = []
        current_chars = 0

        # If total content is within reasonable context window, include all pages
        total_chars = sum(d["total_chars"] for d in self.documents.values())

        if total_chars <= max_chars:
            for doc in self.documents.values():
                for p in doc["pages"]:
                    block = f"=== DOCUMENT: {doc['filename']} | PAGE: {p['page_number']} ===\n{p['text']}\n"
                    context_blocks.append(block)
        else:
            # Score and retrieve most relevant pages based on keyword overlap
            query_terms = set(re.findall(r"\w+", query.lower())) if query else set()
            scored_pages = []

            for doc in self.documents.values():
                for p in doc["pages"]:
                    p_text_lower = p["text"].lower()
                    score = 0
                    if query_terms:
                        score = sum(p_text_lower.count(t) for t in query_terms)
                    scored_pages.append((score, doc["filename"], p["page_number"], p["text"]))

            # Sort descending by score
            scored_pages.sort(key=lambda x: x[0], reverse=True)

            for score, filename, page_num, text in scored_pages:
                block = f"=== DOCUMENT: {filename} | PAGE: {page_num} ===\n{text}\n"
                if current_chars + len(block) > max_chars:
                    break
                context_blocks.append(block)
                current_chars += len(block)

        return "\n\n".join(context_blocks)

    @staticmethod
    def is_bangla(text: str) -> bool:
        """Detect if input text contains Bengali script."""
        return bool(re.search(r"[\u0980-\u09FF]", text))
