import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, ListChecks, MessageSquareText } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DEFAULT_SAMPLE_PDF, UI_COPY } from './data/seedData';
import type {
  CitationJumpTarget,
  DocumentQaResult,
  Language,
  PdfChatMessage,
  PdfDocumentItem,
  QuizDifficulty,
  QuizQuestion,
  ThemeMode,
  ToastItem,
  WorkspaceView,
} from './types/suite';
import {
  buildFallbackQuiz,
  formatQuizReportText,
  getActiveDocuments,
  resolveLocalDocumentQa,
} from './utils/documentEngine';
import { extractPdfFiles } from './utils/pdfExtractor';
import { ArchitecturalCanvas } from './components/ArchitecturalCanvas';
import { PreloaderCurtain } from './components/PreloaderCurtain';
import { Navbar } from './components/Navbar';
import { VaultSidebar } from './components/VaultSidebar';
import { ChatWorkbench } from './components/ChatWorkbench';
import { QuizWorkbench } from './components/QuizWorkbench';
import { PageReaderPane } from './components/PageReaderPane';

function formatNowTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeWelcomeMessage(lang: Language): PdfChatMessage {
  return {
    id: 'welcome-doc',
    role: 'assistant',
    timestamp: formatNowTime(),
    text:
      lang === 'bn'
        ? 'ডকুমেন্ট স্টুডিওতে স্বাগতম। ৪ পৃষ্ঠার নমুনা লেকচার নোট (CS301_AI_and_RAG_Notes.pdf) প্রস্তুত রয়েছে অথবা আপনি নিজের টেক্সট পিডিএফ আপলোড করতে পারেন। প্রতিটি উত্তরের সাথে নির্ভুল পেজ নম্বর ও উদ্ধৃতি থাকবে এবং নথি-বহির্ভূত প্রশ্নে অনুমান করা হবে না।'
        : 'Welcome to Document Studio. A 4-page lecture pack (CS301_AI_and_RAG_Notes.pdf) is indexed and ready, or upload your own text-based PDFs. Every answer includes verifiable page citations, and out-of-document topics are strictly declined.',
  };
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [lang, setLang] = useState<Language>('en');
  const [activeView, setActiveView] = useState<WorkspaceView>('chat');
  const [returnView, setReturnView] = useState<WorkspaceView | null>(null);

  const [documents, setDocuments] = useState<PdfDocumentItem[]>([
    structuredClone(DEFAULT_SAMPLE_PDF),
  ]);

  // Document Chat state
  const [queryInput, setQueryInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [messages, setMessages] = useState<PdfChatMessage[]>(() => [
    makeWelcomeMessage('en'),
  ]);

  // Quiz Studio state
  const [quizCount, setQuizCount] = useState<number>(5);
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>('Intermediate');
  const [selectedScopeDocId, setSelectedScopeDocId] = useState<string>('all');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Page Reader state
  const [readerDocName, setReaderDocName] = useState<string>(DEFAULT_SAMPLE_PDF.name);
  const [readerPageNumber, setReaderPageNumber] = useState<number>(1);
  const [highlightedCitation, setHighlightedCitation] =
    useState<CitationJumpTarget | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const notify = useCallback((title: string, message: string, isAlert = false) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, message, isAlert }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const { loaded, errors } = await extractPdfFiles(files);

    errors.forEach((err) => {
      notify(
        err.reason === 'empty' ? 'Unreadable PDF Layer' : 'Upload Error',
        err.reason === 'empty'
          ? `${err.fileName} contains no selectable text layer.`
          : `Could not parse ${err.fileName}. Ensure it is a valid text-based PDF.`,
        true
      );
    });

    if (loaded.length > 0) {
      setDocuments((prev) => [...prev, ...loaded]);
      setReaderDocName(loaded[0].name);
      setReaderPageNumber(loaded[0].pages[0]?.pageNumber || 1);
      notify(
        'Documents Indexed',
        `Added ${loaded.length} PDF file(s) to your active workspace.`
      );
    }
  };

  const handleToggleDocumentScope = (id: string) => {
    setDocuments((prev) => {
      const target = prev.find((d) => d.id === id);
      const currentlyEnabled = target?.enabled !== false;
      const enabledCount = prev.filter((d) => d.enabled !== false).length;
      if (currentlyEnabled && enabledCount <= 1) {
        notify(
          'At Least One Active PDF Required',
          'Keep at least one document active for search and quiz generation.',
          true
        );
        return prev;
      }
      return prev.map((d) =>
        d.id === id ? { ...d, enabled: !(d.enabled !== false) } : d
      );
    });
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (next.length > 0 && !next.some((d) => d.enabled !== false)) {
        next[0] = { ...next[0], enabled: true };
      }
      if (next.length > 0 && !next.some((d) => d.name === readerDocName)) {
        setReaderDocName(next[0].name);
        setReaderPageNumber(next[0].pages[0]?.pageNumber || 1);
      }
      if (selectedScopeDocId === id) {
        setSelectedScopeDocId('all');
      }
      return next;
    });
    notify('Document Removed', 'Updated active document vault.');
  };

  const handleResetSample = () => {
    setDocuments([structuredClone(DEFAULT_SAMPLE_PDF)]);
    setReaderDocName(DEFAULT_SAMPLE_PDF.name);
    setReaderPageNumber(1);
    setSelectedScopeDocId('all');
    setHighlightedCitation(null);
    notify('Sample Restored', 'Loaded CS301_AI_and_RAG_Notes.pdf (4 pages).');
  };

  const handleSubmitQuery = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || isQuerying) return;

    setActiveView('chat');
    setReturnView(null);
    setQueryInput('');
    setIsQuerying(true);

    const userMsg: PdfChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: formatNowTime(),
    };
    const loadingId = `a-load-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: loadingId, role: 'assistant', isLoading: true, timestamp: formatNowTime() },
    ]);

    const scopedDocs = getActiveDocuments(documents);
    const corpus = scopedDocs
      .map((doc) =>
        doc.pages
          .map((p) => `[FILE: ${doc.name} | PAGE: ${p.pageNumber}]\n${p.text}`)
          .join('\n\n')
      )
      .join('\n\n---\n\n');

    let result: DocumentQaResult | null = null;
    try {
      const res = await fetch('/api/ai/document-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corpus, query, lang }),
      });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; data?: DocumentQaResult };
        if (json.ok && json.data) {
          result = { ...json.data, mode: 'ai' };
        }
      }
    } catch {
      // Deterministic local citation retrieval fallback below
    }

    if (!result) {
      result = resolveLocalDocumentQa(scopedDocs, query, lang);
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === loadingId
          ? {
              id: `a-${Date.now()}`,
              role: 'assistant',
              result,
              timestamp: formatNowTime(),
            }
          : m
      )
    );
    setIsQuerying(false);
  };

  const handleGenerateQuiz = async () => {
    if (isGeneratingQuiz) return;
    setIsGeneratingQuiz(true);
    setQuizSubmitted(false);
    setUserAnswers({});

    const scopedDocs =
      selectedScopeDocId === 'all'
        ? getActiveDocuments(documents)
        : documents.filter((d) => d.id === selectedScopeDocId);
    const targetDocs = scopedDocs.length > 0 ? scopedDocs : getActiveDocuments(documents);

    const corpus = targetDocs
      .map((doc) =>
        doc.pages
          .map((p) => `[FILE: ${doc.name} | PAGE: ${p.pageNumber}]\n${p.text}`)
          .join('\n\n')
      )
      .join('\n\n');

    let generated: QuizQuestion[] | null = null;
    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corpus,
          count: quizCount,
          difficulty: quizDifficulty,
          lang,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; data?: QuizQuestion[] };
        if (json.ok && Array.isArray(json.data) && json.data.length >= 5) {
          generated = json.data;
        }
      }
    } catch {
      // Fallback handled below
    }

    if (!generated) {
      generated = buildFallbackQuiz(targetDocs, quizCount, lang, quizDifficulty);
    }

    setActiveQuiz(generated);
    setIsGeneratingQuiz(false);
    notify(
      'Quiz Ready',
      `Generated ${generated.length} ${quizDifficulty.toLowerCase()} questions from your PDFs.`
    );
  };

  const handleGradeQuiz = () => {
    if (Object.keys(userAnswers).length < activeQuiz.length) {
      notify(
        'Incomplete Assessment',
        'Please select an answer for every question before grading.',
        true
      );
      return;
    }
    setQuizSubmitted(true);
    notify('Assessment Graded', 'Score and verified page citations are ready.');
  };

  const handleExportQuizReport = () => {
    const report = formatQuizReportText(activeQuiz, userAnswers, quizDifficulty);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Document_Studio_Quiz_Report.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify('Report Exported', 'Saved Document_Studio_Quiz_Report.txt');
  };

  const handleJumpToCitation = (target: CitationJumpTarget, fromView: WorkspaceView) => {
    setReaderDocName(target.docName);
    setReaderPageNumber(target.pageNumber);
    setHighlightedCitation(target);
    setReturnView(fromView);
    setActiveView('reader');
  };

  const copy = UI_COPY[lang];

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col relative selection:bg-[var(--crimson)] selection:text-white">
      <div
        className="fixed inset-0 pointer-events-none z-0 architectural-grid"
        aria-hidden="true"
      />
      <ArchitecturalCanvas theme={theme} />
      <PreloaderCurtain />

      <input
        ref={fileInputRef}
        id="global-pdf-upload"
        type="file"
        accept="application/pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          void handleUploadFiles(files);
          e.target.value = '';
        }}
      />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <Navbar
          lang={lang}
          activeView={activeView}
          onSelectView={(view) => {
            setActiveView(view);
            if (view !== 'reader') {
              setReturnView(null);
            }
          }}
          onTriggerUpload={() => fileInputRef.current?.click()}
        />

        {/* Mobile View Switcher (kept concise below sticky header so mobile header remains 3-zone) */}
        <div className="md:hidden px-4 pt-3">
          <div
            role="tablist"
            aria-label="Mobile Workspace Views"
            className="surface-card p-1 rounded-xl grid grid-cols-3 gap-1"
          >
            {(
              [
                { id: 'chat' as WorkspaceView, label: copy.navChat, Icon: MessageSquareText },
                { id: 'quiz' as WorkspaceView, label: copy.navQuiz, Icon: ListChecks },
                { id: 'reader' as WorkspaceView, label: copy.navReader, Icon: BookOpen },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = activeView === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveView(id)}
                  className={`px-2 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--bg-inverse)] text-[var(--text-inverse)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[var(--crimson)]' : ''}`} />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Software Workbench */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-full min-h-0 items-stretch">
            <div className="lg:col-span-4 xl:col-span-3 lg:h-full lg:overflow-y-auto min-h-0">
              <VaultSidebar
                lang={lang}
                theme={theme}
                documents={documents}
                onToggleLanguage={() =>
                  setLang((prev) => {
                    const next: Language = prev === 'en' ? 'bn' : 'en';
                    notify(
                      next === 'bn' ? 'বাংলা সংস্করণ সক্রিয়' : 'English Mode Active',
                      next === 'bn'
                        ? 'এখন বাংলা ও ইংরেজি উভয় ভাষায় প্রশ্ন ও কুইজ পাওয়া যাবে।'
                        : 'Interface and assessment tools switched to English.'
                    );
                    return next;
                  })
                }
                onToggleTheme={() =>
                  setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
                }
                onTriggerUpload={() => fileInputRef.current?.click()}
                onDropFiles={(files) => void handleUploadFiles(files)}
                onToggleDocumentScope={handleToggleDocumentScope}
                onRemoveDocument={handleRemoveDocument}
                onInspectDocument={(docName) => {
                  setReaderDocName(docName);
                  setReaderPageNumber(1);
                  setHighlightedCitation(null);
                  setReturnView(activeView === 'reader' ? null : activeView);
                  setActiveView('reader');
                }}
                onResetSample={handleResetSample}
                onRunPrompt={(query) => void handleSubmitQuery(query)}
              />
            </div>

            <div className="lg:col-span-8 xl:col-span-9 lg:h-full min-h-0 lg:overflow-hidden">
              <div className={activeView === 'chat' ? 'h-full min-h-0 workspace-enter' : 'hidden'}>
                <ChatWorkbench
                  lang={lang}
                  messages={messages}
                  queryInput={queryInput}
                  isQuerying={isQuerying}
                  onChangeQueryInput={setQueryInput}
                  onSubmitQuery={(q) => void handleSubmitQuery(q)}
                  onClearChat={() => setMessages([makeWelcomeMessage(lang)])}
                  onJumpToCitation={(target) => handleJumpToCitation(target, 'chat')}
                />
              </div>

              <div className={activeView === 'quiz' ? 'h-full min-h-0 workspace-enter' : 'hidden'}>
                <QuizWorkbench
                  lang={lang}
                  documents={documents}
                  quizCount={quizCount}
                  quizDifficulty={quizDifficulty}
                  selectedScopeDocId={selectedScopeDocId}
                  isGenerating={isGeneratingQuiz}
                  questions={activeQuiz}
                  userAnswers={userAnswers}
                  submitted={quizSubmitted}
                  onChangeCount={setQuizCount}
                  onChangeDifficulty={setQuizDifficulty}
                  onChangeScopeDocId={setSelectedScopeDocId}
                  onGenerate={() => void handleGenerateQuiz()}
                  onSelectAnswer={(qIdx, oIdx) =>
                    setUserAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                  }
                  onGrade={handleGradeQuiz}
                  onRetake={() => {
                    setUserAnswers({});
                    setQuizSubmitted(false);
                  }}
                  onExportReport={handleExportQuizReport}
                  onJumpToCitation={(target) => handleJumpToCitation(target, 'quiz')}
                />
              </div>

              <div className={activeView === 'reader' ? 'h-full min-h-0 workspace-enter' : 'hidden'}>
                <PageReaderPane
                  lang={lang}
                  documents={documents}
                  selectedDocName={readerDocName}
                  selectedPageNumber={readerPageNumber}
                  highlightedCitation={highlightedCitation}
                  returnView={returnView}
                  onSelectDoc={(docName, pageNum) => {
                    setReaderDocName(docName);
                    setReaderPageNumber(pageNum);
                  }}
                  onClearHighlight={() => setHighlightedCitation(null)}
                  onReturnToCaller={() => {
                    if (returnView) {
                      setActiveView(returnView);
                      setReturnView(null);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Toast Stack */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto surface-card rounded-xl p-4 flex items-start gap-3"
            >
              {t.isAlert ? (
                <AlertCircle className="w-4 h-4 text-[var(--crimson)] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[var(--crimson)] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-main)]">{t.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-snug">
                  {t.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
