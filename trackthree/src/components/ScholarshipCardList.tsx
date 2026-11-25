import { useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  ListChecks,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { EvaluatedScholarship, Language } from '../types/scholarship';
import { UI_COPY } from '../data/scholarshipsData';
import { formatBdt, formatDeadline } from '../utils/scholarshipEngine';

interface ScholarshipCardListProps {
  items: EvaluatedScholarship[];
  shortlistIds: Set<number>;
  checkedSteps: Record<string, boolean>;
  onToggleShortlist: (id: number) => void;
  onToggleStep: (stepId: string) => void;
  lang: Language;
}

export function ScholarshipCardList({
  items,
  shortlistIds,
  checkedSteps,
  onToggleShortlist,
  onToggleStep,
  lang,
}: ScholarshipCardListProps) {
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const copy = UI_COPY[lang];

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {items.map((item) => {
        const { record } = item;
        const isSaved = shortlistIds.has(record.id);
        const isExpanded = Boolean(expandedIds[record.id]);
        const completedCount = item.checklist.filter((s) => checkedSteps[s.id]).length;
        const isEligible = item.status === 'eligible';
        const isNearMiss = item.status === 'near_miss';

        const statusLabel = isEligible
          ? lang === 'bn'
            ? 'যোগ্য'
            : 'Eligible'
          : isNearMiss
          ? lang === 'bn'
            ? 'প্রায় যোগ্য'
            : 'Almost Qualifies'
          : lang === 'bn'
          ? 'যোগ্য নয়'
          : 'Not Eligible';

        const verifyNote = lang === 'bn' ? item.verificationNoteBn : item.verificationNoteEn;

        return (
          <motion.article
            key={record.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="surface-card spotlight-card rounded-2xl p-5 flex flex-col gap-3.5"
          >
            {/* Unboxed Metadata Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="font-mono-tabular font-semibold text-[var(--text-main)]">
                  #{String(record.id).padStart(3, '0')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{record.provider}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular whitespace-nowrap">
                  {formatDeadline(record.deadline, lang)}
                </span>
              </div>
              <span
                className={`font-mono-tabular text-xs font-semibold whitespace-nowrap ${
                  isEligible
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : isNearMiss
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-[var(--text-faint)]'
                }`}
              >
                {statusLabel}
              </span>
            </div>

            {/* Title & Amount */}
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-athens text-xl font-bold text-[var(--text-main)] leading-snug">
                {record.name}
              </h3>
              <span className="font-mono-tabular text-base sm:text-lg font-bold text-[var(--crimson)] whitespace-nowrap shrink-0">
                {formatBdt(record.amountBdt)}
              </span>
            </div>

            {/* Grounded Criteria Strip */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-muted)] pb-3 border-b border-[var(--border-hairline)]">
              <span className="font-mono-tabular">
                Min CGPA <strong className="text-[var(--text-main)]">{record.minCgpa.toFixed(2)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Dept: <strong className="text-[var(--text-main)]">{record.departmentRaw}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>{record.needBased ? (lang === 'bn' ? 'নিড-বেজড' : 'Need-Based') : (lang === 'bn' ? 'মেধা/উন্মুক্ত' : 'Merit / Open')}</span>
              {record.gender === 'Female' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{lang === 'bn' ? 'শুধু ছাত্রী' : 'Female Only'}</span>
                </>
              )}
            </div>

            {/* Explanation OR Missing Requirements */}
            {isEligible ? (
              <div className="text-xs sm:text-[13px] text-[var(--text-main)] leading-relaxed">
                <p className="text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  {copy.whyMatchLabel}
                </p>
                <p>{lang === 'bn' ? item.matchReasonBn : item.matchReasonEn}</p>
              </div>
            ) : (
              <div className="text-xs sm:text-[13px] leading-relaxed">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{copy.missingLabel}</span>
                </p>
                <p className="text-[var(--text-main)] font-medium">
                  {lang === 'bn' ? item.missingSummaryBn : item.missingSummaryEn}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {record.description}
                </p>
              </div>
            )}

            {/* Factual condition reminder (never fabricated) */}
            {verifyNote && isEligible && (
              <div className="flex items-start gap-2 text-xs text-[var(--text-muted)] pt-1">
                <Info className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0 mt-0.5" />
                <p>
                  <strong className="text-[var(--text-main)]">{copy.verifyNotePrefix}</strong>{' '}
                  {verifyNote}
                </p>
              </div>
            )}

            {/* Action Row */}
            <div className="mt-auto pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleExpand(record.id)}
                className="px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ListChecks className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
                <span>{isExpanded ? copy.hideChecklist : copy.howToApply}</span>
                <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                  ({completedCount}/{item.checklist.length})
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
              </button>

              <button
                type="button"
                aria-pressed={isSaved}
                onClick={() => onToggleShortlist(record.id)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isSaved
                    ? 'bg-[var(--crimson-soft)] border-[var(--crimson-border)] text-[var(--crimson)]'
                    : 'bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {isSaved ? (
                  <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{isSaved ? copy.savedShortlist : copy.saveShortlist}</span>
              </button>
            </div>

            {/* Expandable How-to-Apply Checklist */}
            {isExpanded && (
              <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-col gap-2">
                {item.checklist.map((step, stepIdx) => {
                  const done = Boolean(checkedSteps[step.id]);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => onToggleStep(step.id)}
                      className="w-full text-left flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          done
                            ? 'bg-[var(--crimson)] border-[var(--crimson)] text-white'
                            : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
                        }`}
                      >
                        {done && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-xs font-semibold ${
                            done
                              ? 'line-through text-[var(--text-faint)]'
                              : 'text-[var(--text-main)]'
                          }`}
                        >
                          <span className="font-mono-tabular text-[var(--crimson)] mr-1">
                            0{stepIdx + 1}.
                          </span>
                          {lang === 'bn' ? step.titleBn : step.titleEn}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                          {lang === 'bn' ? step.detailBn : step.detailEn}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
