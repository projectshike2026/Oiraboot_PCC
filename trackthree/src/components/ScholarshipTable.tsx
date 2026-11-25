import { Bookmark, BookmarkCheck, ListChecks } from 'lucide-react';
import type { EvaluatedScholarship, Language } from '../types/scholarship';
import { formatBdt, formatDeadline } from '../utils/scholarshipEngine';

interface ScholarshipTableProps {
  items: EvaluatedScholarship[];
  shortlistIds: Set<number>;
  onToggleShortlist: (id: number) => void;
  onInspectChecklist: (item: EvaluatedScholarship) => void;
  lang: Language;
}

export function ScholarshipTable({
  items,
  shortlistIds,
  onToggleShortlist,
  onInspectChecklist,
  lang,
}: ScholarshipTableProps) {
  return (
    <div className="surface-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">
              <th className="py-3 px-4 font-mono-tabular">ID</th>
              <th className="py-3 px-4">{lang === 'bn' ? 'বৃত্তি ও দাতা' : 'Scholarship & Provider'}</th>
              <th className="py-3 px-4">{lang === 'bn' ? 'বিভাগ' : 'Dept'}</th>
              <th className="py-3 px-4 text-right font-mono-tabular">Min CGPA</th>
              <th className="py-3 px-4">{lang === 'bn' ? 'ধরন' : 'Type'}</th>
              <th className="py-3 px-4 font-mono-tabular">{lang === 'bn' ? 'শেষ তারিখ' : 'Deadline'}</th>
              <th className="py-3 px-4 text-right font-mono-tabular">{lang === 'bn' ? 'অর্থ (BDT)' : 'Amount'}</th>
              <th className="py-3 px-4">{lang === 'bn' ? 'অবস্থান' : 'Status'}</th>
              <th className="py-3 px-4 text-right">{lang === 'bn' ? 'পদক্ষেপ' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)] text-xs">
            {items.map((item) => {
              const { record } = item;
              const isSaved = shortlistIds.has(record.id);
              const statusText =
                item.status === 'eligible'
                  ? lang === 'bn'
                    ? 'যোগ্য'
                    : 'Eligible'
                  : item.status === 'near_miss'
                  ? lang === 'bn'
                    ? 'কাছাকাছি'
                    : 'Near-Miss'
                  : lang === 'bn'
                  ? 'যোগ্য নয়'
                  : 'Ineligible';

              return (
                <tr
                  key={record.id}
                  className="hover:bg-[var(--bg-subtle)] transition-colors align-top"
                >
                  <td className="py-3.5 px-4 font-mono-tabular text-[var(--text-faint)]">
                    #{String(record.id).padStart(3, '0')}
                  </td>
                  <td className="py-3.5 px-4 max-w-[300px]">
                    <p className="font-semibold text-[var(--text-main)] leading-snug">
                      {record.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {record.provider}
                    </p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1 leading-snug">
                      {item.status === 'eligible'
                        ? lang === 'bn'
                          ? item.matchReasonBn
                          : item.matchReasonEn
                        : lang === 'bn'
                        ? item.missingSummaryBn
                        : item.missingSummaryEn}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-[var(--text-main)] whitespace-nowrap">
                    {record.departmentRaw}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold text-[var(--text-main)]">
                    {record.minCgpa.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                    {record.needBased ? (lang === 'bn' ? 'নিড-বেজড' : 'Need') : (lang === 'bn' ? 'মেধা' : 'Merit')}
                    {record.gender === 'Female' ? ' · F' : ''}
                  </td>
                  <td className="py-3.5 px-4 font-mono-tabular text-[var(--text-muted)] whitespace-nowrap">
                    {formatDeadline(record.deadline, lang)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-[var(--crimson)] whitespace-nowrap">
                    {formatBdt(record.amountBdt)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        item.status === 'eligible'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : item.status === 'near_miss'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-[var(--text-faint)]'
                      }`}
                    >
                      {statusText}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInspectChecklist(item)}
                        aria-label={`Open checklist for ${record.name}`}
                        className="px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--crimson)] text-[11px] font-semibold text-[var(--text-main)] inline-flex items-center gap-1"
                      >
                        <ListChecks className="w-3.5 h-3.5 text-[var(--crimson)]" />
                        <span>{lang === 'bn' ? 'ধাপ' : 'Steps'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleShortlist(record.id)}
                        aria-label={`${isSaved ? 'Remove' : 'Save'} ${record.name}`}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isSaved
                            ? 'bg-[var(--crimson-soft)] border-[var(--crimson-border)] text-[var(--crimson)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
