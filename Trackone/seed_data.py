"""
seed_data.py - Default documents, sample verification prompts, and constants
for Document Intelligence & Semantic Search (Hackathon Track 1).
"""

DEFAULT_SAMPLE_PAGES = [
    {
        "pageNumber": 1,
        "text": (
            "CS301 Lecture Notes: Foundations of Artificial Intelligence and Retrieval-Augmented Generation (RAG). "
            "Retrieval-Augmented Generation (RAG) is a hybrid architecture that combines an information retrieval system "
            "with a Large Language Model (LLM). RAG is used to reduce hallucinations, ground AI responses in verifiable "
            "private or up-to-date documents, and provide traceable citations without retraining the base neural network."
        ),
    },
    {
        "pageNumber": 2,
        "text": (
            "Transformer Architecture & Self-Attention. Introduced in 2017, the Transformer architecture replaces recurrent "
            "layers with parallelizable self-attention mechanisms. The Scaled Dot-Product Attention formula is: "
            "Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V, where Q represents Queries, K represents Keys, "
            "V represents Values, and d_k is the dimension of the key vectors used for numerical stability."
        ),
    },
    {
        "pageNumber": 3,
        "text": (
            "Generalization, Bias-Variance Tradeoff, and Overfitting. Overfitting occurs when a machine learning model "
            "memorizes noise and specific patterns in the training data, resulting in very low training error but poor "
            "performance on unseen test data. Common techniques to reduce overfitting include L1/L2 regularization, "
            "Dropout layers, early stopping, cross-validation, and data augmentation."
        ),
    },
    {
        "pageNumber": 4,
        "text": (
            "Evaluation Metrics for Classification Systems. Accuracy measures the ratio of correctly predicted observations "
            "to total observations, but can be misleading on imbalanced datasets. Precision is TP / (TP + FP), measuring exactness. "
            "Recall is TP / (TP + FN), measuring completeness. The F1-Score is the harmonic mean of Precision and Recall: "
            "F1 = 2 * (Precision * Recall) / (Precision + Recall)."
        ),
    },
]

DEFAULT_SAMPLE_DOC = {
    "id": "sample-cs301",
    "name": "CS301_AI_and_RAG_Notes.pdf",
    "enabled": True,
    "pages": DEFAULT_SAMPLE_PAGES,
    "totalPages": len(DEFAULT_SAMPLE_PAGES),
}

SAMPLE_PROMPTS = [
    {
        "id": "rag-overview",
        "labelEn": "What is RAG & why is it used?",
        "labelBn": "RAG কী এবং কেন ব্যবহৃত হয়?",
        "query": "What is Retrieval-Augmented Generation and why is it used?",
        "isRefusalTest": False,
    },
    {
        "id": "attention-formula",
        "labelEn": "Transformer attention formula",
        "labelBn": "ট্রান্সফরমার অ্যাটেনশন ফর্মুলা",
        "query": "Explain the Scaled Dot-Product Attention mechanism formula in Transformers.",
        "isRefusalTest": False,
    },
    {
        "id": "refusal-test",
        "labelEn": "Out-of-Document Refusal Test",
        "labelBn": "ডকুমেন্ট-বহির্ভূত প্রশ্ন পরীক্ষা (Refusal)",
        "query": "Who won the 2022 FIFA World Cup?",
        "isRefusalTest": True,
    },
    {
        "id": "bangla-overfitting",
        "labelEn": "Bangla: ওভারফিটিং কী?",
        "labelBn": "বাংলা: ওভারফিটিং কী ও কমানোর উপায়?",
        "query": "ওভারফিটিং (Overfitting) কী এবং কীভাবে কমানো যায়?",
        "isRefusalTest": False,
    },
]


def ensure_sample_pdf_file(uploads_dir: str = "uploads") -> str:
    """Creates a real sample PDF file on disk if not already present."""
    import os
    os.makedirs(uploads_dir, exist_ok=True)
    pdf_path = os.path.join(uploads_dir, "CS301_AI_and_RAG_Notes.pdf")
    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
        return pdf_path

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#1E293B'),
            spaceAfter=12
        )
        page_badge_style = ParagraphStyle(
            'PageBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            textColor=colors.HexColor('#2563EB'),
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=12,
            leading=18,
            textColor=colors.HexColor('#334155'),
            spaceAfter=14
        )

        story = []
        for p in DEFAULT_SAMPLE_PAGES:
            story.append(Paragraph("CS301: Foundations of Artificial Intelligence &amp; RAG", title_style))
            story.append(Paragraph(f"Page {p['pageNumber']} of {len(DEFAULT_SAMPLE_PAGES)} — Lecture Notes", page_badge_style))
            story.append(Spacer(1, 10))
            story.append(Paragraph(p['text'], body_style))
            if p['pageNumber'] < len(DEFAULT_SAMPLE_PAGES):
                story.append(PageBreak())

        doc.build(story)
    except Exception as e:
        print(f"[Sample PDF generation notice]: {e}")

    return pdf_path
