import { Bookmark, BookmarkCheck, Check, X } from 'lucide-react';
import type { EvaluatedScholarship, Language } from '../types/scholarship';
import { UI_COPY } from '../data/scholarshipsData';
import { formatBdt, formatDeadline } from '../utils/scholarshipEngine';

interface ChecklistModalProps {
  item: EvaluatedScholarship | null;
  onClose: () => void;
  isShortlisted: boolean;
  onToggleShortlist: (id: number) => void;
  checkedSteps: Record<string, boolean>;
  onToggleStep: (stepId: string) => void;
  lang: Language;
}

export function ChecklistModal({
  item,
  onClose,
  isShortlisted,
  onToggleShortlist,
  checkedSteps,
  onToggleStep,
  lang,
}: ChecklistModalProps) {
  if (!item) return null;

  const { record } = item;
  const copy = UI_COPY[lang];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={record.name}
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="surface-card rounded-2xl max-w-xl w-full p-5 sm:p-6 flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[var(--border-hairline)]">
          <div>
            <p className="font-mono-tabular text-xs text-[var(--text-muted)]">
              #{String(record.id).padStart(3, '0')} · {record.provider} ·{' '}
              {formatDeadline(record.deadline, lang)}
            </p>
            <h2 className="font-athens text-2xl font-bold text-[var(--text-main)] mt-1">
              {record.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--crimson)] text-[var(--text-main)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
            <span className="font-mono-tabular">
              Min CGPA <strong className="text-[var(--text-main)]">{record.minCgpa.toFixed(2)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{record.departmentRaw}</span>
            <span aria-hidden="true">·</span>
            <span>{record.needBased ? 'Need-Based' : 'Merit / Open'}</span>
            {record.gender === 'Female' && (
              <>
                <span aria-hidden="true">·</span>
                <span>Female Only</span>
              </>
            )}
          </div>
          <span className="font-mono-tabular text-base font-bold text-[var(--crimson)]">
            {formatBdt(record.amountBdt)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs leading-relaxed">
          <p className="font-semibold text-[var(--text-muted)] mb-1">
            {item.status === 'eligible' ? copy.whyMatchLabel : copy.missingLabel}
          </p>
          <p className="text-[var(--text-main)]">
            {item.status === 'eligible'
              ? lang === 'bn'
                ? item.matchReasonBn
                : item.matchReasonEn
              : lang === 'bn'
              ? item.missingSummaryBn
              : item.missingSummaryEn}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--text-main)]">{copy.howToApply}</p>
          {item.checklist.map((step, idx) => {
            const done = Boolean(checkedSteps[step.id]);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onToggleStep(step.id)}
                className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--crimson)] transition-colors"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
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
                      0{idx + 1}.
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

        <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onToggleShortlist(record.id)}
            className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
              isShortlisted
                ? 'bg-[var(--crimson-soft)] border-[var(--crimson-border)] text-[var(--crimson)]'
                : 'bg-[var(--bg-subtle)] border-[var(--border-hairline)] text-[var(--text-main)]'
            }`}
          >
            {isShortlisted ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
            <span>{isShortlisted ? copy.savedShortlist : copy.saveShortlist}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--bg-inverse)] text-[var(--text-inverse)] text-xs font-semibold"
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
