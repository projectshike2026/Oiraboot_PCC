import { DEFAULT_SAMPLE_PDF } from '../data/seedData';
import type {
  DocumentQaResult,
  Language,
  PdfDocumentItem,
  QuizDifficulty,
  QuizQuestion,
} from '../types/suite';

const BANGLA_SYNONYMS: Record<string, string> = {
  'ওভারফিটিং': 'overfitting regularization dropout training error test data',
  'র‍্যাগ': 'rag retrieval augmented generation hallucination citations',
  'অ্যাটেনশন': 'attention transformer softmax query key value',
  'ট্রান্সফরমার': 'transformer attention mechanism recurrent',
  'প্রিসিশন': 'precision recall f1 accuracy classification exactness',
  'রিকল': 'recall precision f1 completeness',
  'অ্যাকুরেসি': 'accuracy imbalanced dataset',
  'রেগুলারাইজেশন': 'regularization dropout early stopping',
  'হ্যালুসিনেশন': 'hallucinations rag verifiable citations',
};

const STOP_WORDS = new Set([
  'what',
  'is',
  'the',
  'and',
  'for',
  'how',
  'does',
  'why',
  'are',
  'in',
  'of',
  'to',
  'a',
  'an',
  'explain',
  'tell',
  'me',
  'about',
  'can',
  'you',
  'who',
  'when',
  'where',
  'which',
  'used',
  'with',
  'from',
  'কী',
  'এবং',
  'কীভাবে',
  'কেন',
  'এর',
  'হয়',
  'ব্যাখ্যা',
]);

export interface ChunkHit {
  docName: string;
  pageNumber: number;
  excerpt: string;
  fullPageText: string;
  score: number;
}

export function getActiveDocuments(documents: PdfDocumentItem[]): PdfDocumentItem[] {
  const active = documents.filter((d) => d.enabled !== false);
  return active.length > 0 ? active : documents;
}

export function countCorpusWords(documents: PdfDocumentItem[]): number {
  return documents.reduce((total, doc) => {
    const docWords = doc.pages.reduce((pSum, page) => {
      const trimmed = page.text.trim();
      return pSum + (trimmed ? trimmed.split(/\s+/).length : 0);
    }, 0);
    return total + docWords;
  }, 0);
}

function tokenizeQuery(query: string): string[] {
  const lowerQ = query.toLowerCase();
  let expanded = lowerQ;
  for (const [bn, en] of Object.entries(BANGLA_SYNONYMS)) {
    if (lowerQ.includes(bn)) {
      expanded += ' ' + en;
    }
  }

  return Array.from(
    new Set(
      expanded
        .replace(/[^\w\s\u0980-\u09FF]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    )
  );
}

function selectBestSentenceExcerpt(pageText: string, tokens: string[]): string {
  const sentences = pageText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return pageText.slice(0, 260) + (pageText.length > 260 ? '...' : '');
  }

  const scored = sentences.map((sentence, idx) => {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (lower.includes(tok)) {
        score += tok.length > 5 ? 3 : 1.5;
      }
    }
    return { sentence, idx, score };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const top = scored[0];
  if (!top || top.score === 0) {
    return sentences.slice(0, 2).join(' ');
  }

  const second = scored.find((s) => s.idx === top.idx + 1 && s.score > 0);
  const combined = second ? `${top.sentence} ${second.sentence}` : top.sentence;
  return combined.length > 300 ? `${combined.slice(0, 297)}...` : combined;
}

export function retrieveBestPdfChunk(
  documents: PdfDocumentItem[],
  query: string
): ChunkHit | null {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return null;

  const scopedDocs = getActiveDocuments(documents);
  let best: ChunkHit | null = null;
  let bestScore = 0;

  for (const doc of scopedDocs) {
    for (const page of doc.pages) {
      const textLower = page.text.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (textLower.includes(tok)) {
          score += tok.length > 5 ? 3 : 1.5;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = {
          docName: doc.name,
          pageNumber: page.pageNumber,
          excerpt: selectBestSentenceExcerpt(page.text, tokens),
          fullPageText: page.text,
          score,
        };
      }
    }
  }

  return bestScore >= 2.5 ? best : null;
}

const SAMPLE_BANGLA_ANSWERS: Record<number, string> = {
  1: 'Retrieval-Augmented Generation (RAG) হলো একটি হাইব্রিড আর্কিটেকচার যা একটি ইনফরমেশন রিট্রিভাল সিস্টেমকে Large Language Model (LLM)-এর সাথে যুক্ত করে। বেস নিউরাল নেটওয়ার্ক রি-ট্রেইন না করেই হ্যালুসিনেশন কমানো, যাচাইযোগ্য নথি থেকে উত্তর দেওয়া এবং নির্ভুল উদ্ধৃতি প্রদান করাই এর মূল কাজ।',
  2: 'Scaled Dot-Product Attention সূত্রটি হলো: Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V। এখানে Q হলো Queries, K হলো Keys, V হলো Values এবং d_k হলো Key ভেক্টরের ডাইমেনশন যা গাণিতিক স্থিতিশীলতা বজায় রাখে।',
  3: 'ওভারফিটিং (Overfitting) তখন ঘটে যখন কোনো মেশিন লার্নিং মডেল ট্রেনিং ডেটার নয়েজ মুখস্থ করে ফেলে—ফলে ট্রেনিং এরর কম হলেও অদেখা টেস্ট ডেটায় পারফরম্যান্স খারাপ হয়। এটি কমানোর উপায়: L1/L2 রেগুলারাইজেশন, ড্রপআউট লেয়ার, আর্লি স্টপিং, ক্রস-ভ্যালিডেশন ও ডেটা অগমেন্টেশন।',
  4: 'ক্লাসিফিকেশন সিস্টেম মূল্যায়নে Precision = TP / (TP + FP) সঠিকতার নিখুঁততা মাপে এবং Recall = TP / (TP + FN) সম্পূর্ণতা মাপে। ইমব্যালেন্সড ডেটাসেটে Accuracy বিভ্রান্তিকর হতে পারে, তাই Precision ও Recall-এর হারমোনিক গড় হিসেবে F1-Score ব্যবহৃত হয়।',
};

export function resolveLocalDocumentQa(
  documents: PdfDocumentItem[],
  query: string,
  lang: Language
): DocumentQaResult {
  const hit = retrieveBestPdfChunk(documents, query);
  const isBangla = /[\u0980-\u09FF]/.test(query) || lang === 'bn';

  if (!hit) {
    return {
      found: false,
      answer: isBangla
        ? 'Not found in the document (এই প্রশ্নের উত্তর সক্রিয় ডকুমেন্টে পাওয়া যায়নি)।'
        : 'Not found in the document.',
      sourceDoc: '',
      pageNumber: 0,
      excerpt: '',
      mode: 'local',
    };
  }

  let answer = hit.fullPageText;
  if (isBangla && hit.docName === DEFAULT_SAMPLE_PDF.name && SAMPLE_BANGLA_ANSWERS[hit.pageNumber]) {
    answer = SAMPLE_BANGLA_ANSWERS[hit.pageNumber];
  } else if (isBangla) {
    answer = `সংশ্লিষ্ট ডকুমেন্ট (${hit.docName}, পৃষ্ঠা ${hit.pageNumber}) অনুযায়ী প্রাসঙ্গিক তথ্য নিচে উদ্ধৃত করা হলো: ${hit.excerpt}`;
  }

  return {
    found: true,
    answer,
    sourceDoc: hit.docName,
    pageNumber: hit.pageNumber,
    excerpt: hit.excerpt,
    mode: 'local',
  };
}

function rotateOptionsWithCorrect(
  correctValue: string,
  distractors: string[],
  seedIndex: number
): { options: string[]; correctIndex: number } {
  const uniqueDistractors = Array.from(
    new Set(distractors.filter((d) => d.trim() && d.toLowerCase() !== correctValue.toLowerCase()))
  );
  const fallbacks = [
    'Stochastic Gradient Offset',
    'Unbounded Variance Scalar',
    'Heuristic Token Mask',
    'Static Linear Projection',
    'Residual Batch Decay',
  ];
  while (uniqueDistractors.length < 3) {
    const next = fallbacks.shift();
    if (next && next.toLowerCase() !== correctValue.toLowerCase()) {
      uniqueDistractors.push(next);
    }
  }

  const targetIdx = seedIndex % 4;
  const options: string[] = [];
  let dCursor = 0;
  for (let i = 0; i < 4; i++) {
    if (i === targetIdx) {
      options.push(correctValue);
    } else {
      options.push(uniqueDistractors[dCursor++]);
    }
  }
  return { options, correctIndex: targetIdx };
}

export function buildFallbackQuiz(
  documents: PdfDocumentItem[],
  count: number,
  lang: Language,
  difficulty: QuizDifficulty = 'Intermediate'
): QuizQuestion[] {
  const scopedDocs = getActiveDocuments(documents);
  const isBn = lang === 'bn';
  const primaryDoc = scopedDocs[0]?.name || DEFAULT_SAMPLE_PDF.name;
  const usesOnlySample =
    scopedDocs.length === 1 && scopedDocs[0]?.id === DEFAULT_SAMPLE_PDF.id;

  // Dynamically construct verifiable MCQs when custom PDFs are loaded
  if (!usesOnlySample && scopedDocs.length > 0) {
    const sentencePool: Array<{
      docName: string;
      pageNumber: number;
      sentence: string;
      keywords: string[];
    }> = [];

    for (const doc of scopedDocs) {
      for (const page of doc.pages) {
        const rawSegments = page.text
          .split(/(?<=[.!?;])\s+|\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 24);
        const segments = rawSegments.length > 0 ? rawSegments : [page.text.trim()].filter(Boolean);

        for (const segment of segments) {
          const keywords = segment
            .split(/\s+/)
            .map((w) => w.replace(/[^\w\u0980-\u09FF-]/g, ''))
            .filter((w) => w.length >= 5 && !STOP_WORDS.has(w.toLowerCase()));
          if (keywords.length > 0) {
            sentencePool.push({
              docName: doc.name,
              pageNumber: page.pageNumber,
              sentence: segment,
              keywords,
            });
          }
        }
      }
    }

    const allCandidateKeywords = Array.from(
      new Set(sentencePool.flatMap((s) => s.keywords))
    );

    if (sentencePool.length > 0) {
      const generated: QuizQuestion[] = [];
      for (let i = 0; i < count; i++) {
        const item = sentencePool[i % sentencePool.length];
        const keywordPickIdx =
          difficulty === 'Advanced'
            ? Math.max(0, item.keywords.length - 1)
            : difficulty === 'Foundational'
              ? 0
              : Math.floor(item.keywords.length / 2);
        const keyword =
          item.keywords[(keywordPickIdx + Math.floor(i / sentencePool.length)) % item.keywords.length] ||
          item.keywords[0];

        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const masked = item.sentence.replace(new RegExp(escaped, 'i'), '______');
        const distractors = allCandidateKeywords.filter(
          (k) => k.toLowerCase() !== keyword.toLowerCase()
        );
        const { options, correctIndex } = rotateOptionsWithCorrect(keyword, distractors, i + 1);

        generated.push({
          question: isBn
            ? `${item.docName} (পৃষ্ঠা ${item.pageNumber}) অনুযায়ী শূন্যস্থানে কোন শব্দটি সঠিক: "${masked}"?`
            : `According to ${item.docName} (Page ${item.pageNumber}), which term accurately completes: "${masked}"?`,
          options,
          correctIndex,
          pageNumber: item.pageNumber,
          sourceDoc: item.docName,
          explanationQuote: item.sentence,
        });
      }
      return generated;
    }
  }

  const bank: QuizQuestion[] = isBn
    ? [
        {
          question: 'রিট্রিভাল-অগমেন্টেড জেনারেশন (RAG) মূলত কোন দুটি সিস্টেমের সমন্বয়ে তৈরি?',
          options: [
            'ইনফরমেশন রিট্রিভাল সিস্টেম ও লার্জ ল্যাঙ্গুয়েজ মডেল',
            'শুধুমাত্র ইমেজ কম্প্রেসর ও ডেটাবেস',
            'অপারেটিং সিস্টেম ও কম্পাইলার',
            'হার্ডওয়্যার সেন্সর ও রাউটার',
          ],
          correctIndex: 0,
          pageNumber: 1,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Retrieval-Augmented Generation (RAG) is a hybrid architecture that combines an information retrieval system with a Large Language Model (LLM).',
        },
        {
          question: 'Scaled Dot-Product Attention ফর্মুলায় d_k কী নির্দেশ করে?',
          options: [
            'ডকুমেন্টের মোট পৃষ্ঠা সংখ্যা',
            'কী (Key) ভেক্টরের ডাইমেনশন',
            'শেখার হার',
            'ড্রপআউট অনুপাত',
          ],
          correctIndex: 1,
          pageNumber: 2,
          sourceDoc: primaryDoc,
          explanationQuote: 'd_k is the dimension of the key vectors used for numerical stability.',
        },
        {
          question: 'ওভারফিটিং (Overfitting) ঘটলে মডেলের ফলাফল কেমন হয়?',
          options: [
            'ট্রেনিং ও টেস্ট উভয় ক্ষেত্রেই এরর বেশি',
            'ট্রেনিং এরর কম কিন্তু অদেখা টেস্ট ডেটায় পারফরম্যান্স খারাপ',
            'টেস্ট ডেটায় শতভাগ সঠিক ফলাফল',
            'মডেল কখনোই ট্রেন হয় না',
          ],
          correctIndex: 1,
          pageNumber: 3,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Overfitting occurs when a machine learning model memorizes noise and specific patterns in the training data, resulting in very low training error but poor performance on unseen test data.',
        },
        {
          question: 'নিচের কোনটি ওভারফিটিং কমানোর পদ্ধতি নয়?',
          options: [
            'L1/L2 রেগুলারাইজেশন',
            'ড্রপআউট লেয়ার',
            'ডেটা অগমেন্টেশন',
            'টেস্ট ডেটা মুছে ফেলা',
          ],
          correctIndex: 3,
          pageNumber: 3,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Common techniques to reduce overfitting include L1/L2 regularization, Dropout layers, early stopping, cross-validation, and data augmentation.',
        },
        {
          question: 'F1-Score কীভাবে নির্ণয় করা হয়?',
          options: [
            'Precision ও Recall-এর হারমোনিক মিন',
            'শুধু Accuracy-এর বর্গমূল',
            'TP এবং TN-এর যোগফল',
            'মোট ডেটার অর্ধেক',
          ],
          correctIndex: 0,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote:
            'The F1-Score is the harmonic mean of Precision and Recall: F1 = 2 * (Precision * Recall) / (Precision + Recall).',
        },
        {
          question: 'ইমব্যালেন্সড ডেটাসেটে কোন মেট্রিকটি বিভ্রান্তিকর হতে পারে?',
          options: ['Precision', 'Recall', 'Accuracy', 'F1-Score'],
          correctIndex: 2,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Accuracy measures the ratio of correctly predicted observations to total observations, but can be misleading on imbalanced datasets.',
        },
        {
          question: 'ট্রান্সফরমার আর্কিটেকচার প্রথম কত সালে প্রবর্তিত হয়?',
          options: ['২০১২', '২০১৭', '২০২১', '২০২৪'],
          correctIndex: 1,
          pageNumber: 2,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Introduced in 2017, the Transformer architecture replaces recurrent layers with parallelizable self-attention mechanisms.',
        },
        {
          question: 'ক্লাসিফিকেশন মূল্যায়নে Precision কী পরিমাপ করে?',
          options: [
            'পজিটিভ অনুমানের নিখুঁততা (Exactness)',
            'মোট ডেটার আকার',
            'মডেলের ইনফারেন্স সময়',
            'শুধুমাত্র নেগেটিভ ফলাফল',
          ],
          correctIndex: 0,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote: 'Precision is TP / (TP + FP), measuring exactness.',
        },
        {
          question: 'বেস নিউরাল নেটওয়ার্ক রি-ট্রেইন না করেই হ্যালুসিনেশন কমাতে কোন পদ্ধতি ব্যবহৃত হয়?',
          options: ['K-Means ক্লাস্টারিং', 'Retrieval-Augmented Generation (RAG)', 'লিনিয়ার রিগ্রেশন', 'পিক্সেল কোয়ান্টাইজেশন'],
          correctIndex: 1,
          pageNumber: 1,
          sourceDoc: primaryDoc,
          explanationQuote:
            'RAG is used to reduce hallucinations, ground AI responses in verifiable private or up-to-date documents, and provide traceable citations without retraining the base neural network.',
        },
        {
          question: 'Recall সূত্রটির সঠিক রূপ কোনটি?',
          options: ['TP / (TP + FP)', 'FP / (FP + TN)', 'TP / (TP + FN)', 'TN / (TP + TN)'],
          correctIndex: 2,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote: 'Recall is TP / (TP + FN), measuring completeness.',
        },
      ]
    : [
        {
          question: 'What primary advantage does Retrieval-Augmented Generation (RAG) provide?',
          options: [
            'Grounds responses in verifiable documents and reduces hallucinations without retraining',
            'Eliminates the need for any user prompts',
            'Compresses PDF files into audio streams',
            'Replaces all neural networks with static SQL tables',
          ],
          correctIndex: 0,
          pageNumber: 1,
          sourceDoc: primaryDoc,
          explanationQuote:
            'RAG is used to reduce hallucinations, ground AI responses in verifiable private or up-to-date documents, and provide traceable citations without retraining the base neural network.',
        },
        {
          question: 'In Scaled Dot-Product Attention, why is the dot product divided by sqrt(d_k)?',
          options: [
            'To increase vocabulary size dynamically',
            'To maintain numerical stability based on key vector dimensionality',
            'To convert text tokens into RGB pixel values',
            'To remove positional encodings from the sequence',
          ],
          correctIndex: 1,
          pageNumber: 2,
          sourceDoc: primaryDoc,
          explanationQuote:
            'The Scaled Dot-Product Attention formula is Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V, where Q represents Queries, K represents Keys, V represents Values, and d_k is the dimension of the key vectors used for numerical stability.',
        },
        {
          question: 'Which symptom best characterizes Overfitting in a machine learning model?',
          options: [
            'High error on both training and validation splits',
            'Very low training error paired with poor generalization on unseen test data',
            'Equal accuracy across all unseen domains',
            'Zero memory footprint during inference',
          ],
          correctIndex: 1,
          pageNumber: 3,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Overfitting occurs when a machine learning model memorizes noise and specific patterns in the training data, resulting in very low training error but poor performance on unseen test data.',
        },
        {
          question: 'Which techniques are listed in the document to reduce Overfitting?',
          options: [
            'Removing labels and disabling validation',
            'L1/L2 regularization, Dropout layers, early stopping, cross-validation, and data augmentation',
            'Increasing polynomial degree indefinitely',
            'Training exclusively on a single data point',
          ],
          correctIndex: 1,
          pageNumber: 3,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Common techniques to reduce overfitting include L1/L2 regularization, Dropout layers, early stopping, cross-validation, and data augmentation.',
        },
        {
          question: 'How is the F1-Score mathematically defined for classification systems?',
          options: [
            'Arithmetic average of Accuracy and Error',
            'Harmonic mean of Precision and Recall',
            'Difference between True Positives and False Negatives',
            'Ratio of True Negatives to Total Samples',
          ],
          correctIndex: 1,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote:
            'The F1-Score is the harmonic mean of Precision and Recall: F1 = 2 * (Precision * Recall) / (Precision + Recall).',
        },
        {
          question: 'Why might standard Accuracy be unreliable when evaluating a classifier?',
          options: [
            'It requires GPU acceleration to compute',
            'It can be misleading on imbalanced datasets',
            'It only works for unsupervised clustering',
            'It cannot exceed 0.50 on binary tasks',
          ],
          correctIndex: 1,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Accuracy measures the ratio of correctly predicted observations to total observations, but can be misleading on imbalanced datasets.',
        },
        {
          question: 'What did the 2017 Transformer architecture replace to enable parallel sequence processing?',
          options: [
            'Convolutional image filters',
            'Recurrent layers via self-attention mechanisms',
            'Decision tree leaf nodes',
            'K-Means centroid initializers',
          ],
          correctIndex: 1,
          pageNumber: 2,
          sourceDoc: primaryDoc,
          explanationQuote:
            'Introduced in 2017, the Transformer architecture replaces recurrent layers with parallelizable self-attention mechanisms.',
        },
        {
          question: 'In classification evaluation, what does Precision (TP / (TP + FP)) measure?',
          options: [
            'Completeness of positive detection',
            'Exactness of positive predictions',
            'Total inference latency',
            'Dataset balance ratio',
          ],
          correctIndex: 1,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote: 'Precision is TP / (TP + FP), measuring exactness.',
        },
        {
          question: 'What are the three matrix projections used in Scaled Dot-Product Attention?',
          options: [
            'Input, Hidden, and Output gates',
            'Queries (Q), Keys (K), and Values (V)',
            'Bias, Variance, and Noise vectors',
            'Precision, Recall, and F1 tensors',
          ],
          correctIndex: 1,
          pageNumber: 2,
          sourceDoc: primaryDoc,
          explanationQuote: 'where Q represents Queries, K represents Keys, V represents Values',
        },
        {
          question: 'How does Recall evaluate a classification system?',
          options: [
            'TP / (TP + FN), measuring completeness',
            'FP / (FP + TN), measuring false alarm rate',
            'TN / Total, measuring specificity',
            '1 - Accuracy',
          ],
          correctIndex: 0,
          pageNumber: 4,
          sourceDoc: primaryDoc,
          explanationQuote: 'Recall is TP / (TP + FN), measuring completeness.',
        },
      ];

  const ordered = difficulty === 'Advanced' ? [...bank].reverse() : bank;
  return ordered.slice(0, Math.min(count, ordered.length));
}

export function formatQuizReportText(
  quiz: QuizQuestion[],
  answers: Record<number, number>,
  difficulty: QuizDifficulty = 'Intermediate'
): string {
  const correctCount = quiz.reduce(
    (acc, q, idx) => acc + (answers[idx] === q.correctIndex ? 1 : 0),
    0
  );
  const pct = quiz.length > 0 ? Math.round((correctCount / quiz.length) * 100) : 0;

  let report = `DOCUMENT STUDIO — GROUNDED ASSESSMENT REPORT\n`;
  report += `Difficulty: ${difficulty}\n`;
  report += `Score: ${correctCount}/${quiz.length} (${pct}%)\n`;
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `======================================================\n\n`;

  quiz.forEach((q, idx) => {
    const selected = answers[idx];
    const isCorrect = selected === q.correctIndex;
    report += `Q${idx + 1} [${isCorrect ? 'CORRECT' : 'INCORRECT'}]: ${q.question}\n`;
    report += `Your Answer: ${q.options[selected] || 'Unanswered'}\n`;
    report += `Correct Answer: ${q.options[q.correctIndex]}\n`;
    report += `Source Proof (Page ${q.pageNumber} - ${q.sourceDoc}): "${q.explanationQuote}"\n\n`;
  });

  return report;
}
