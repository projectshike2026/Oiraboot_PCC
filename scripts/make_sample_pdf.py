import fitz  # PyMuPDF
from pathlib import Path

def create_sample_pdf(output_path: Path):
    doc = fitz.open()
    
    # Page 1
    p1 = doc.new_page()
    text_p1 = (
        "CS301 Lecture Notes: Foundations of Artificial Intelligence and Retrieval-Augmented Generation (RAG).\n\n"
        "Retrieval-Augmented Generation (RAG) is a hybrid architecture that combines an information retrieval "
        "system with a Large Language Model (LLM). RAG is used to reduce hallucinations, ground AI responses "
        "in verifiable private or up-to-date documents, and provide traceable citations without retraining "
        "the base neural network.\n\n"
        "In traditional fine-tuning, knowledge is baked into the model weights, which is expensive and quickly becomes obsolete. "
        "In contrast, RAG retrieves relevant document chunks dynamically at query time using BM25 lexical search "
        "or dense vector embeddings, and passes those chunks as contextual ground truth to the LLM."
    )
    p1.insert_text(fitz.Point(50, 72), text_p1, fontsize=12)

    # Page 2
    p2 = doc.new_page()
    text_p2 = (
        "Transformer Architecture and Self-Attention Mechanism.\n\n"
        "Introduced in 2017 by Vaswani et al., the Transformer architecture replaces recurrent layers with "
        "parallelizable self-attention mechanisms. The Scaled Dot-Product Attention formula is defined as:\n"
        "Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V\n\n"
        "In this equation, Q represents the Query matrix, K represents the Key matrix, V represents the Value matrix, "
        "and d_k is the dimensionality of the key vectors used for numerical stability.\n\n"
        "Multi-Head Attention allows the model to jointly attend to information from different representation subspaces "
        "at different positions, improving feature extraction capacity."
    )
    p2.insert_text(fitz.Point(50, 72), text_p2, fontsize=12)

    # Page 3
    p3 = doc.new_page()
    text_p3 = (
        "Generalization, Bias-Variance Tradeoff, and Overfitting in Machine Learning.\n\n"
        "Overfitting occurs when a machine learning model memorizes noise and specific patterns in the training data, "
        "resulting in very low training error but poor performance on unseen test data.\n\n"
        "Common techniques to reduce overfitting include:\n"
        "1. L1 and L2 regularization to penalize large weights.\n"
        "2. Dropout layers that randomly deactivate neurons during training.\n"
        "3. Early stopping based on validation loss plateaus.\n"
        "4. K-fold cross-validation to assess generalizability.\n"
        "5. Data augmentation to enrich training diversity.\n\n"
        "Bangla summary note: ওভারফিটিং (Overfitting) রোধ করতে রেগুলারাইজেশন, ড্রপআউট এবং ক্রস-ভ্যালিডেশন ব্যবহার করা হয়।"
    )
    p3.insert_text(fitz.Point(50, 72), text_p3, fontsize=12)

    # Page 4
    p4 = doc.new_page()
    text_p4 = (
        "Evaluation Metrics for Classification Systems.\n\n"
        "Accuracy measures the ratio of correctly predicted observations to total observations: (TP + TN) / Total. "
        "However, accuracy can be misleading on imbalanced datasets.\n\n"
        "Precision measures exactness: TP / (TP + FP). It answers what proportion of positive identifications was actually correct.\n"
        "Recall measures completeness: TP / (TP + FN). It answers what proportion of actual positives was identified correctly.\n"
        "The F1-Score is the harmonic mean of Precision and Recall: F1 = 2 * (Precision * Recall) / (Precision + Recall)."
    )
    p4.insert_text(fitz.Point(50, 72), text_p4, fontsize=12)

    doc.save(str(output_path))
    doc.close()
    print(f"Created sample PDF at {output_path}")

def create_mini_pdf(output_path: Path):
    doc = fitz.open()
    
    p1 = doc.new_page()
    p1.insert_text(fitz.Point(50, 72), "Mini Notes Page 1: Normalisation is the process of organising data in a database.", fontsize=12)

    p2 = doc.new_page()
    p2.insert_text(fitz.Point(50, 72), "Mini Notes Page 2: Normalisation eliminates redundancy and avoids update anomalies.", fontsize=12)

    p3 = doc.new_page()
    p3.insert_text(fitz.Point(50, 72), "Mini Notes Page 3: Third normal form requires every non-key attribute to be non-transitively dependent on the primary key.", fontsize=12)

    doc.save(str(output_path))
    doc.close()
    print(f"Created mini PDF at {output_path}")

if __name__ == "__main__":
    fixtures_dir = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    create_sample_pdf(fixtures_dir / "sample.pdf")
    create_mini_pdf(fixtures_dir / "mini.pdf")
