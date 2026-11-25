import type { Language, PdfDocumentItem } from '../types/suite';

export const DEFAULT_SAMPLE_PDF: PdfDocumentItem = {
  id: 'sample-cs301',
  name: 'CS301_AI_and_RAG_Notes.pdf',
  enabled: true,
  pages: [
    {
      pageNumber: 1,
      text: 'CS301 Lecture Notes: Foundations of Artificial Intelligence and Retrieval-Augmented Generation (RAG). Retrieval-Augmented Generation (RAG) is a hybrid architecture that combines an information retrieval system with a Large Language Model (LLM). RAG is used to reduce hallucinations, ground AI responses in verifiable private or up-to-date documents, and provide traceable citations without retraining the base neural network.',
    },
    {
      pageNumber: 2,
      text: 'Transformer Architecture & Self-Attention. Introduced in 2017, the Transformer architecture replaces recurrent layers with parallelizable self-attention mechanisms. The Scaled Dot-Product Attention formula is Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V, where Q represents Queries, K represents Keys, V represents Values, and d_k is the dimension of the key vectors used for numerical stability.',
    },
    {
      pageNumber: 3,
      text: 'Generalization, Bias-Variance Tradeoff, and Overfitting. Overfitting occurs when a machine learning model memorizes noise and specific patterns in the training data, resulting in very low training error but poor performance on unseen test data. Common techniques to reduce overfitting include L1/L2 regularization, Dropout layers, early stopping, cross-validation, and data augmentation.',
    },
    {
      pageNumber: 4,
      text: 'Evaluation Metrics for Classification Systems. Accuracy measures the ratio of correctly predicted observations to total observations, but can be misleading on imbalanced datasets. Precision is TP / (TP + FP), measuring exactness. Recall is TP / (TP + FN), measuring completeness. The F1-Score is the harmonic mean of Precision and Recall: F1 = 2 * (Precision * Recall) / (Precision + Recall).',
    },
  ],
};

export interface SamplePromptItem {
  id: string;
  labelEn: string;
  labelBn: string;
  query: string;
  isRefusalTest: boolean;
}

export const SAMPLE_PROMPTS: SamplePromptItem[] = [
  {
    id: 'rag-overview',
    labelEn: 'What is RAG & why is it used?',
    labelBn: 'RAG কী এবং কেন ব্যবহৃত হয়?',
    query: 'What is Retrieval-Augmented Generation and why is it used?',
    isRefusalTest: false,
  },
  {
    id: 'attention-formula',
    labelEn: 'Transformer attention formula',
    labelBn: 'ট্রান্সফরমার অ্যাটেনশন ফর্মুলা',
    query: 'Explain the Scaled Dot-Product Attention mechanism formula in Transformers.',
    isRefusalTest: false,
  },
  {
    id: 'refusal-test',
    labelEn: 'Test Out-of-Document Refusal',
    labelBn: 'ডকুমেন্ট-বহির্ভূত প্রশ্ন পরীক্ষা',
    query: 'Who won the 2022 FIFA World Cup?',
    isRefusalTest: true,
  },
  {
    id: 'bangla-overfitting',
    labelEn: 'Bangla: ওভারফিটিং কী?',
    labelBn: 'বাংলা: ওভারফিটিং কী ও সমাধান?',
    query: 'ওভারফিটিং (Overfitting) কী এবং কীভাবে কমানো যায়?',
    isRefusalTest: false,
  },
];

export const UI_COPY: Record<Language, Record<string, string>> = {
  en: {
    brandPrimary: 'Document',
    brandAccent: 'Studio',
    navChat: 'Document Chat',
    navQuiz: 'Quiz Studio',
    navReader: 'Page Reader',
    navUpload: 'Upload PDF',
    vaultEyebrow: 'Document Vault',
    vaultTitle: 'Active Archive',
    uploadTitle: 'Drop or select text PDFs',
    uploadSub: 'Multi-PDF page indexing & citation jump',
    promptsTitle: 'Verification Prompts',
    restoreSample: 'Restore Sample Notes',
    chatTitle: 'Source-Grounded Assistant',
    chatSubtitle: 'Every reply quotes exact PDF sentences & page numbers',
    chatPlaceholder: 'Ask a question strictly grounded in your active PDFs (English or Bangla)...',
    chatSend: 'Ask PDF',
    clearChat: 'Clear Thread',
    openPage: 'Inspect Page',
    verifiedExcerpt: 'Verified PDF Excerpt',
    notFoundNote:
      'Strict grounding prevented unverified generation. This topic does not appear in your enabled PDF pages.',
    quizTitle: 'Assessment Generator',
    quizSubtitle: 'Build multi-page comprehension quizzes with verified PDF proofs',
    quizCountLabel: 'Questions',
    quizDifficultyLabel: 'Difficulty',
    quizScopeLabel: 'Source Scope',
    quizGenerate: 'Generate Quiz',
    quizGenerating: 'Constructing Quiz...',
    quizGrade: 'Grade & Reveal Proof',
    quizRetake: 'Retake Quiz',
    quizExport: 'Export Report',
    readerTitle: 'Indexed Page Reader',
    readerSubtitle: 'Inspect full extracted pages and highlighted citations',
    readerSearchPlaceholder: 'Filter pages by keyword or formula...',
    allActiveDocs: 'All Active PDFs',
    lightMode: 'White Mode',
    darkMode: 'Black Mode',
  },
  bn: {
    brandPrimary: 'ডকুমেন্ট',
    brandAccent: 'স্টুডিও',
    navChat: 'ডকুমেন্ট চ্যাট',
    navQuiz: 'কুইজ স্টুডিও',
    navReader: 'পেজ রিডার',
    navUpload: 'পিডিএফ আপলোড',
    vaultEyebrow: 'ডকুমেন্ট ভল্ট',
    vaultTitle: 'সক্রিয় আর্কাইভ',
    uploadTitle: 'টেক্সট পিডিএফ আপলোড করুন',
    uploadSub: 'একাধিক পিডিএফ ও পেজ নম্বর সূচীকরণ সমর্থিত',
    promptsTitle: 'নমুনা যাচাইকরণ প্রশ্ন',
    restoreSample: 'নমুনা নোট ফিরিয়ে আনুন',
    chatTitle: 'উদ্ধৃতি-নির্ভর সহায়ক',
    chatSubtitle: 'প্রতিটি উত্তরের সাথে নির্ভুল পেজ নম্বর ও মূল অংশ যুক্ত থাকে',
    chatPlaceholder: 'আপনার সক্রিয় পিডিএফ থেকে প্রশ্ন করুন (বাংলা বা ইংরেজি)...',
    chatSend: 'জিজ্ঞাসা করুন',
    clearChat: 'চ্যাট মুছুন',
    openPage: 'পেজ দেখুন',
    verifiedExcerpt: 'যাচাইকৃত পিডিএফ উদ্ধৃতি',
    notFoundNote:
      'তথ্যের নির্ভুলতা রক্ষার্থে অনুমান নির্ভর উত্তর দেওয়া হয়নি। এই বিষয়টি সক্রিয় পিডিএফগুলোতে পাওয়া যায়নি।',
    quizTitle: 'কুইজ ও মূল্যায়ন স্টুডিও',
    quizSubtitle: 'পিডিএফ প্রমাণসহ বহুনির্বাচনী কুইজ তৈরি ও নম্বর যাচাই করুন',
    quizCountLabel: 'প্রশ্ন সংখ্যা',
    quizDifficultyLabel: 'কঠিন্য স্তর',
    quizScopeLabel: 'ডকুমেন্ট নির্বাচন',
    quizGenerate: 'কুইজ তৈরি করুন',
    quizGenerating: 'কুইজ তৈরি হচ্ছে...',
    quizGrade: 'উত্তর মূল্যায়ন করুন',
    quizRetake: 'পুনরায় দিন',
    quizExport: 'রিপোর্ট ডাউনলোড',
    readerTitle: 'সূচীকৃত পেজ রিডার',
    readerSubtitle: 'পিডিএফের প্রতিটি পৃষ্ঠার মূল লেখা ও হাইলাইট দেখুন',
    readerSearchPlaceholder: 'কীওয়ার্ড বা সূত্র দিয়ে পৃষ্ঠা খুঁজুন...',
    allActiveDocs: 'সকল সক্রিয় পিডিএফ',
    lightMode: 'হোয়াইট মোড',
    darkMode: 'ব্ল্যাক মোড',
  },
};
