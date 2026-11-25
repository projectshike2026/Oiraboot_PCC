import { LayoutGrid, Search, Table2 } from 'lucide-react';
import type {
  DisplayLayout,
  Language,
  NeedFilter,
  SortOption,
} from '../types/scholarship';
import { UI_COPY } from '../data/scholarshipsData';
import { formatBdt } from '../utils/scholarshipEngine';

interface ScholarshipToolbarProps {
  eligibleCount: number;
  totalCatalogCount: number;
  totalPotentialBdt: number;
  nearMissCount: number;
  shortlistCount: number;
  searchQuery: string;
  onChangeSearch: (value: string) => void;
  needFilter: NeedFilter;
  onChangeNeedFilter: (value: NeedFilter) => void;
  sortBy: SortOption;
  onChangeSort: (value: SortOption) => void;
  layout: DisplayLayout;
  onChangeLayout: (value: DisplayLayout) => void;
  lang: Language;
}

export function ScholarshipToolbar({
  eligibleCount,
  totalCatalogCount,
  totalPotentialBdt,
  nearMissCount,
  shortlistCount,
  searchQuery,
  onChangeSearch,
  needFilter,
  onChangeNeedFilter,
  sortBy,
  onChangeSort,
  layout,
  onChangeLayout,
  lang,
}: ScholarshipToolbarProps) {
  const copy = UI_COPY[lang];

  return (
    <div className="flex flex-col gap-4 pb-4 border-b border-[var(--border-hairline)]">
      {/* Unboxed KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-2xl bg-[var(--bg-subtle)]">
        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            {copy.kpiEligible}
          </p>
          <p className="font-mono-tabular text-xl font-bold text-[var(--text-main)] mt-0.5">
            {eligibleCount}
            <span className="text-xs font-normal text-[var(--text-faint)]">
              {' '}
              / {totalCatalogCount}
            </span>
          </p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            {copy.kpiMaxAid}
          </p>
          <p className="font-mono-tabular text-xl font-bold text-[var(--crimson)] mt-0.5 truncate">
            {formatBdt(totalPotentialBdt)}
          </p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            {copy.kpiNearMiss}
          </p>
          <p className="font-mono-tabular text-xl font-bold text-[var(--text-main)] mt-0.5">
            {nearMissCount}
          </p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            {copy.kpiShortlisted}
          </p>
          <p className="font-mono-tabular text-xl font-bold text-[var(--text-main)] mt-0.5">
            {shortlistCount}
          </p>
        </div>
      </div>

      {/* Filter, Search, Sort & View Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="scholarship-search-input" className="sr-only">
            {copy.searchPlaceholder}
          </label>
          <input
            id="scholarship-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="field-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Need-Based Segmented Control */}
          <div
            role="group"
            aria-label="Scholarship Type Filter"
            className="flex items-center p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]"
          >
            {(
              [
                { id: 'all', label: copy.filterAll },
                { id: 'need_based', label: copy.filterNeed },
                { id: 'merit_open', label: copy.filterMerit },
              ] as Array<{ id: NeedFilter; label: string }>
            ).map((opt) => {
              const active = needFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeNeedFilter(opt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Sort Dropdown */}
          <label htmlFor="scholarship-sort-select" className="sr-only">
            Sort scholarships
          </label>
          <select
            id="scholarship-sort-select"
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value as SortOption)}
            className="field-input px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
          >
            <option value="amount_desc">{copy.sortAmount}</option>
            <option value="deadline_asc">{copy.sortDeadline}</option>
            <option value="min_cgpa_desc">{copy.sortCgpa}</option>
            <option value="id_asc">{copy.sortId}</option>
          </select>

          {/* Cards vs Table Switch */}
          <div
            role="group"
            aria-label="Results Layout"
            className="flex items-center p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]"
          >
            <button
              type="button"
              aria-pressed={layout === 'cards'}
              onClick={() => onChangeLayout('cards')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
                layout === 'cards'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{copy.viewCards}</span>
            </button>
            <button
              type="button"
              aria-pressed={layout === 'table'}
              onClick={() => onChangeLayout('table')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
                layout === 'table'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] font-semibold shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>{copy.viewTable}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
