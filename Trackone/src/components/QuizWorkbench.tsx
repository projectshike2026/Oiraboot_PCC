import { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  CheckCheck,
  CheckCircle2,
  Circle,
  ClipboardList,
  Download,
  FileCheck2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UI_COPY } from '../data/seedData';
import type {
  CitationJumpTarget,
  Language,
  PdfDocumentItem,
  QuizDifficulty,
  QuizQuestion,
} from '../types/suite';

interface QuizWorkbenchProps {
  lang: Language;
  documents: PdfDocumentItem[];
  quizCount: number;
  quizDifficulty: QuizDifficulty;
  selectedScopeDocId: string;
  isGenerating: boolean;
  questions: QuizQuestion[];
  userAnswers: Record<number, number>;
  submitted: boolean;
  onChangeCount: (count: number) => void;
  onChangeDifficulty: (diff: QuizDifficulty) => void;
  onChangeScopeDocId: (id: string) => void;
  onGenerate: () => void;
  onSelectAnswer: (questionIdx: number, optionIdx: number) => void;
  onGrade: () => void;
  onRetake: () => void;
  onExportReport: () => void;
  onJumpToCitation: (target: CitationJumpTarget) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function QuizWorkbench({
  lang,
  documents,
  quizCount,
  quizDifficulty,
  selectedScopeDocId,
  isGenerating,
  questions,
  userAnswers,
  submitted,
  onChangeCount,
  onChangeDifficulty,
  onChangeScopeDocId,
  onGenerate,
  onSelectAnswer,
  onGrade,
  onRetake,
  onExportReport,
  onJumpToCitation,
}: QuizWorkbenchProps) {
  const copy = UI_COPY[lang];
  const quizScrollRef = useRef<HTMLDivElement | null>(null);
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = questions.reduce(
    (acc, q, idx) => acc + (userAnswers[idx] === q.correctIndex ? 1 : 0),
    0
  );
  const scorePercent =
    questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  useEffect(() => {
    if (submitted && quizScrollRef.current) {
      quizScrollRef.current.scrollTop = 0;
    }
  }, [submitted]);

  return (
    <section
      aria-label="Quiz Studio Workbench"
      className="surface-card rounded-2xl flex flex-col lg:h-full min-h-[600px] overflow-hidden"
    >
      {/* Quiz Studio Header */}
      <div className="px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-athens text-xl sm:text-2xl font-bold text-[var(--text-main)]">
            {copy.quizTitle}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{copy.quizSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="px-5 py-2.5 rounded-xl bg-[var(--crimson)] hover:bg-[var(--crimson-hover)] text-white font-semibold text-xs tracking-wide transition-colors flex items-center gap-2 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <FileCheck2 className="w-4 h-4 shrink-0" />
          <span>{isGenerating ? copy.quizGenerating : copy.quizGenerate}</span>
        </button>
      </div>

      {/* Builder Parameter Strip */}
      <div className="px-6 py-3.5 border-b border-[var(--border-hairline)] flex flex-wrap items-center gap-5 bg-[var(--bg-surface)]">
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="quiz-count-select"
            className="text-xs font-medium text-[var(--text-faint)] whitespace-nowrap"
          >
            {copy.quizCountLabel}
          </label>
          <select
            id="quiz-count-select"
            value={quizCount}
            onChange={(e) => onChangeCount(Number(e.target.value))}
            className="field-input px-3 py-1.5 rounded-lg text-xs font-semibold font-mono-tabular"
          >
            <option value={5}>5</option>
            <option value={7}>7</option>
            <option value={10}>10</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <label
            htmlFor="quiz-difficulty-select"
            className="text-xs font-medium text-[var(--text-faint)] whitespace-nowrap"
          >
            {copy.quizDifficultyLabel}
          </label>
          <select
            id="quiz-difficulty-select"
            value={quizDifficulty}
            onChange={(e) => onChangeDifficulty(e.target.value as QuizDifficulty)}
            className="field-input px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <option value="Foundational">Foundational</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5 min-w-0">
          <label
            htmlFor="quiz-scope-select"
            className="text-xs font-medium text-[var(--text-faint)] whitespace-nowrap"
          >
            {copy.quizScopeLabel}
          </label>
          <select
            id="quiz-scope-select"
            value={selectedScopeDocId}
            onChange={(e) => onChangeScopeDocId(e.target.value)}
            className="field-input px-3 py-1.5 rounded-lg text-xs font-semibold max-w-[220px] truncate"
          >
            <option value="all">{copy.allActiveDocs}</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>

        {questions.length > 0 && !submitted && (
          <div className="ml-auto font-mono-tabular text-xs text-[var(--text-muted)]">
            {answeredCount} / {questions.length} answered
          </div>
        )}
      </div>

      {/* Main Quiz Body */}
      <div
        ref={quizScrollRef}
        className="flex-1 min-h-0 p-5 sm:p-6 overflow-y-auto max-h-[580px] lg:max-h-none space-y-6"
      >
        {isGenerating ? (
          <div className="py-16 space-y-3 max-w-xl mx-auto">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="p-5 rounded-xl surface-subtle animate-pulse space-y-3"
              >
                <div className="h-4 w-3/4 rounded bg-[var(--border-hairline)]" />
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="h-9 rounded-lg bg-[var(--border-hairline)]" />
                  <div className="h-9 rounded-lg bg-[var(--border-hairline)]" />
                </div>
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center space-y-4 px-4">
            <div className="w-14 h-14 rounded-2xl surface-subtle flex items-center justify-center text-[var(--crimson)]">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h2 className="font-athens text-2xl font-bold text-[var(--text-main)]">
                Ready for PDF Self-Assessment
              </h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Choose your question count, difficulty, and document scope above, then select{' '}
                <strong className="text-[var(--crimson)]">{copy.quizGenerate}</strong> to build a
                verifiable multiple-choice test with page-cited proof quotes.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Graded Score Banner */}
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="p-5 rounded-2xl bg-[var(--bg-inverse)] text-[var(--text-inverse)] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-[var(--crimson)] text-white flex items-center justify-center font-mono-tabular text-lg font-bold shrink-0">
                      {scorePercent}%
                    </div>
                    <div>
                      <p className="text-xs opacity-75">
                        {quizDifficulty} · {scorePercent >= 70 ? 'Mastery Verified' : 'Review Recommended'}
                      </p>
                      <h2 className="font-athens text-2xl font-bold mt-0.5">
                        Score: {correctCount} / {questions.length} Correct
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={onRetake}
                      className="px-3.5 py-2 rounded-xl border border-white/20 text-xs font-semibold hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{copy.quizRetake}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExportReport}
                      className="px-4 py-2 rounded-xl bg-[var(--crimson)] hover:bg-[var(--crimson-hover)] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{copy.quizExport}</span>
                    </button>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${scorePercent}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full bg-[var(--crimson)]"
                  />
                </div>
              </motion.div>
            )}

            {/* Question List */}
            <div className="divide-y divide-[var(--border-hairline)]">
              {questions.map((q, qIdx) => {
                const chosen = userAnswers[qIdx];
                const isCorrectAnswer = chosen === q.correctIndex;

                return (
                  <motion.div
                    key={`${qIdx}-${q.question.slice(0, 18)}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(qIdx * 0.04, 0.24) }}
                    className="py-5 first:pt-1 last:pb-2 space-y-3.5"
                  >
                    <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-4">
                      <p className="text-sm font-semibold text-[var(--text-main)] leading-snug">
                        <span className="font-mono-tabular text-[var(--crimson)] mr-2">
                          {String(qIdx + 1).padStart(2, '0')}.
                        </span>
                        {q.question}
                      </p>
                      <span className="shrink-0 font-mono-tabular text-[11px] text-[var(--text-faint)]">
                        Page {q.pageNumber} · {q.sourceDoc}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, oIdx) => {
                        let style =
                          'bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-main)] hover:border-[var(--crimson)]';
                        let Icon = Circle;

                        if (!submitted && chosen === oIdx) {
                          style =
                            'bg-[var(--bg-inverse)] border-[var(--bg-inverse)] text-[var(--text-inverse)]';
                          Icon = CheckCircle2;
                        } else if (submitted) {
                          if (oIdx === q.correctIndex) {
                            style =
                              'bg-[var(--bg-inverse)] border-[var(--bg-inverse)] text-[var(--text-inverse)]';
                            Icon = CheckCircle2;
                          } else if (chosen === oIdx && chosen !== q.correctIndex) {
                            style =
                              'bg-[var(--crimson-soft)] border-[var(--crimson)] text-[var(--crimson)]';
                            Icon = XCircle;
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={submitted}
                            aria-pressed={chosen === oIdx}
                            onClick={() => onSelectAnswer(qIdx, oIdx)}
                            className={`text-left p-3 rounded-xl border text-xs font-medium transition-colors flex items-start gap-2.5 ${style}`}
                          >
                            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="font-mono-tabular opacity-70 shrink-0">
                              {OPTION_LETTERS[oIdx]}.
                            </span>
                            <span className="leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {submitted && (
                      <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                            {isCorrectAnswer ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Correct — Verified on Page {q.pageNumber}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
                                <span>
                                  Incorrect — Answer is {OPTION_LETTERS[q.correctIndex]} (Page{' '}
                                  {q.pageNumber})
                                </span>
                              </>
                            )}
                          </p>
                          <p className="text-[var(--text-muted)] italic leading-relaxed">
                            "{q.explanationQuote}"
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onJumpToCitation({
                              docName: q.sourceDoc,
                              pageNumber: q.pageNumber,
                              excerpt: q.explanationQuote,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--crimson)] text-[11px] font-semibold text-[var(--text-main)] hover:text-[var(--crimson)] flex items-center gap-1 shrink-0 self-start sm:self-center whitespace-nowrap transition-colors"
                        >
                          <span>
                            {copy.openPage} {q.pageNumber}
                          </span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {!submitted && (
              <div className="pt-4 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-4">
                <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
                  {answeredCount} of {questions.length} answered
                </span>
                <button
                  type="button"
                  onClick={onGrade}
                  className="px-6 py-3 rounded-xl bg-[var(--crimson)] hover:bg-[var(--crimson-hover)] text-white font-semibold text-xs tracking-wide transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{copy.quizGrade}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
