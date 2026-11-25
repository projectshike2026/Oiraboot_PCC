import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bookmark, CheckCircle2, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ArchitecturalCanvas } from './components/ArchitecturalCanvas';
import { ChecklistModal } from './components/ChecklistModal';
import { Navbar } from './components/Navbar';
import { PreloaderCurtain } from './components/PreloaderCurtain';
import { ProfileSidebar } from './components/ProfileSidebar';
import { ScholarshipCardList } from './components/ScholarshipCardList';
import { ScholarshipTable } from './components/ScholarshipTable';
import { ScholarshipToolbar } from './components/ScholarshipToolbar';
import { PROFILE_PRESETS, TRACK3_CSV_PATH, UI_COPY } from './data/scholarshipsData';
import type {
  DisplayLayout,
  EvaluatedScholarship,
  Language,
  NeedFilter,
  ScholarshipRecord,
  SortOption,
  StudentProfile,
  ThemeMode,
  ViewMode,
} from './types/scholarship';
import { parseScholarshipsCsv } from './utils/csvParser';
import {
  buildExportCsvReport,
  evaluateStudentProfile,
  filterAndSortScholarships,
} from './utils/scholarshipEngine';

interface ToastMessage {
  id: number;
  title: string;
  detail: string;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [lang, setLang] = useState<Language>('en');
  const [activeView, setActiveView] = useState<ViewMode>('eligible');
  const [layout, setLayout] = useState<DisplayLayout>('cards');

  const [records, setRecords] = useState<ScholarshipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profile, setProfile] = useState<StudentProfile>(PROFILE_PRESETS[0].profile);
  const [searchQuery, setSearchQuery] = useState('');
  const [needFilter, setNeedFilter] = useState<NeedFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('amount_desc');

  const [shortlistIds, setShortlistIds] = useState<Set<number>>(() => new Set());
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [modalItem, setModalItem] = useState<EvaluatedScholarship | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = (title: string, detail: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-1), { id, title, detail }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Sync Tailwind v4 .dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Subtle spotlight cursor highlight for cards
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('.spotlight-card') as
        | HTMLElement
        | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      target.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  // Load canonical Track 3 CSV directly
  const loadDataset = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let res = await fetch(TRACK3_CSV_PATH);
      if (!res.ok) {
        res = await fetch('/api/scholarships/csv');
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const rawCsv = await res.text();
      const parsed = parseScholarshipsCsv(rawCsv);
      setRecords(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load scholarship CSV.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDataset();
  }, []);

  const evaluation = useMemo(
    () => evaluateStudentProfile(records, profile),
    [records, profile]
  );

  const activeSourceList = useMemo(() => {
    if (!evaluation.isValidProfile) return [];
    switch (activeView) {
      case 'eligible':
        return evaluation.eligible;
      case 'near_miss':
        return evaluation.nearMiss;
      case 'shortlist':
        return evaluation.allEvaluated.filter((item) => shortlistIds.has(item.record.id));
      case 'atlas':
      default:
        return evaluation.allEvaluated;
    }
  }, [activeView, evaluation, shortlistIds]);

  const displayedItems = useMemo(
    () =>
      filterAndSortScholarships(activeSourceList, {
        searchQuery,
        needFilter,
        sortBy,
        isNearMissTab: activeView === 'near_miss',
      }),
    [activeSourceList, searchQuery, needFilter, sortBy, activeView]
  );

  const toggleShortlist = (id: number) => {
    setShortlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStep = (stepId: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleDownloadCsv = () => {
    const itemsToExport =
      displayedItems.length > 0 ? displayedItems : evaluation.eligible;
    if (itemsToExport.length === 0) return;

    const csvContent = buildExportCsvReport(itemsToExport, profile, lang);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `biu-scholarships-${profile.department.toLowerCase()}-${profile.cgpaInput || 'report'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pushToast(
      lang === 'bn' ? 'রিপোর্ট ডাউনলোড হয়েছে' : 'CSV Report Downloaded',
      lang === 'bn'
        ? `${itemsToExport.length}টি বৃত্তির সম্পূর্ণ তালিকা সংরক্ষিত হয়েছে।`
        : `Exported ${itemsToExport.length} verified scholarship records.`
    );
  };

  const copy = UI_COPY[lang];
  const validationError =
    lang === 'bn' ? evaluation.validationErrorBn : evaluation.validationErrorEn;

  const mobileTabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'eligible', label: copy.navEligible },
    { id: 'near_miss', label: copy.navNearMiss },
    { id: 'shortlist', label: copy.navShortlist },
    { id: 'atlas', label: copy.navAtlas },
  ];

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col relative bg-[var(--bg-page)] text-[var(--text-main)]">
      <PreloaderCurtain />
      <ArchitecturalCanvas theme={theme} />
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none architectural-grid"
      />

      <Navbar
        activeView={activeView}
        onSelectView={setActiveView}
        onDownloadCsv={handleDownloadCsv}
        canDownload={evaluation.isValidProfile && (displayedItems.length > 0 || evaluation.eligible.length > 0)}
        lang={lang}
      />

      {/* Mobile Segmented Tab Switcher */}
      <div className="lg:hidden relative z-20 px-4 pt-3">
        <div
          role="tablist"
          aria-label="Mobile Scholarship Views"
          className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)]"
        >
          {mobileTabs.map((tab) => {
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setActiveView(tab.id)}
                className={`py-2 px-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap truncate ${
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Split */}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
        <div className="flex flex-col lg:flex-row gap-5 lg:h-full">
          {/* Left Rail: Student Eligibility Profile */}
          <div className="w-full lg:w-[332px] shrink-0 lg:h-full">
            <ProfileSidebar
              profile={profile}
              onChangeProfile={setProfile}
              validationError={validationError}
              cgpaValue={evaluation.cgpaValue}
              totalCatalogCount={records.length}
              lang={lang}
              theme={theme}
              onToggleLanguage={() => {
                const next = lang === 'en' ? 'bn' : 'en';
                setLang(next);
                pushToast(
                  next === 'bn' ? 'বাংলা সংস্করণ সক্রিয়' : 'English Mode Active',
                  next === 'bn'
                    ? 'সব বৃত্তির ব্যাখ্যা ও চেকলিস্ট এখন বাংলায় প্রদর্শিত হচ্ছে।'
                    : 'All match reasons and checklists switched to English.'
                );
              }}
              onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            />
          </div>

          {/* Right Workspace Stage */}
          <section
            aria-label="Scholarship Matching Results"
            className="flex-1 min-w-0 surface-card rounded-2xl p-4 sm:p-6 flex flex-col gap-4 lg:h-full lg:overflow-hidden"
          >
            <ScholarshipToolbar
              eligibleCount={evaluation.eligible.length}
              totalCatalogCount={records.length}
              totalPotentialBdt={evaluation.totalPotentialBdt}
              nearMissCount={evaluation.nearMiss.length}
              shortlistCount={shortlistIds.size}
              searchQuery={searchQuery}
              onChangeSearch={setSearchQuery}
              needFilter={needFilter}
              onChangeNeedFilter={setNeedFilter}
              sortBy={sortBy}
              onChangeSort={setSortBy}
              layout={layout}
              onChangeLayout={setLayout}
              lang={lang}
            />

            {/* Contextual View Header Banner (subtle unboxed text) */}
            {!isLoading && !loadError && evaluation.isValidProfile && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <p>
                  {activeView === 'eligible' &&
                    (lang === 'bn'
                      ? `${profile.department} বিভাগে ${evaluation.cgpaValue?.toFixed(2)} CGPA-তে ${displayedItems.length}টি বৃত্তি প্রযোজ্য।`
                      : `Showing ${displayedItems.length} eligible scholarships for ${profile.department} at ${evaluation.cgpaValue?.toFixed(2)} CGPA.`)}
                  {activeView === 'near_miss' &&
                    (lang === 'bn'
                      ? `আরও সামান্য শর্ত পূরণ করলে পাওয়া যাবে এমন ${displayedItems.length}টি বৃত্তি।`
                      : `Showing ${displayedItems.length} near-miss scholarships ranked by smallest eligibility gap.`)}
                  {activeView === 'shortlist' &&
                    (lang === 'bn'
                      ? `আপনার সংরক্ষিত তালিকায় ${displayedItems.length}টি বৃত্তি রয়েছে।`
                      : `Showing ${displayedItems.length} shortlisted scholarships.`)}
                  {activeView === 'atlas' &&
                    (lang === 'bn'
                      ? `অফিসিয়াল CSV থেকে সম্পূর্ণ ${displayedItems.length}টি বৃত্তির তালিকা।`
                      : `Complete audited catalog (${displayedItems.length} records loaded from official CSV).`)}
                </p>

                {activeView === 'near_miss' && evaluation.cgpaValue !== null && evaluation.cgpaValue < 3.9 && (
                  <button
                    type="button"
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        cgpaInput: Math.min(4, Number(((evaluation.cgpaValue ?? 0) + 0.1).toFixed(2))).toFixed(2),
                      }))
                    }
                    className="text-xs font-semibold text-[var(--crimson)] hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'bn' ? '+০.১০ CGPA বাড়িয়ে দেখুন' : 'Simulate +0.10 CGPA'}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Results Scroll Stage */}
            <div className="flex-1 min-h-0 lg:overflow-y-auto pr-0.5">
              {isLoading ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-44 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] animate-pulse"
                    />
                  ))}
                </div>
              ) : loadError ? (
                <div className="py-12 px-6 text-center flex flex-col items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-[var(--crimson)]" />
                  <p className="font-athens text-xl font-bold text-[var(--text-main)]">
                    Failed to Load Scholarship CSV
                  </p>
                  <p className="text-xs text-[var(--text-muted)] max-w-md">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadDataset()}
                    className="px-4 py-2 rounded-xl bg-[var(--crimson)] text-white text-xs font-semibold"
                  >
                    Retry Loading CSV
                  </button>
                </div>
              ) : !evaluation.isValidProfile ? (
                <div className="py-12 px-6 text-center flex flex-col items-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-[var(--crimson)]" />
                  <p className="font-athens text-xl font-bold text-[var(--text-main)]">
                    {validationError}
                  </p>
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="py-14 px-6 text-center flex flex-col items-center gap-3">
                  <Bookmark className="w-8 h-8 text-[var(--text-faint)]" />
                  <p className="font-athens text-xl font-bold text-[var(--text-main)]">
                    {activeView === 'shortlist'
                      ? copy.emptyShortlistTitle
                      : copy.emptyTitle}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] max-w-md">
                    {activeView === 'shortlist'
                      ? copy.emptyShortlistSubtitle
                      : copy.emptySubtitle}
                  </p>
                  {activeView !== 'near_miss' && evaluation.nearMiss.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setNeedFilter('all');
                        setActiveView('near_miss');
                      }}
                      className="mt-1 px-4 py-2 rounded-xl bg-[var(--crimson)] text-white text-xs font-semibold"
                    >
                      {lang === 'bn' ? 'কাছাকাছি বৃত্তি দেখুন' : 'Inspect Near-Miss Opportunities'}
                    </button>
                  )}
                </div>
              ) : layout === 'cards' ? (
                <ScholarshipCardList
                  items={displayedItems}
                  shortlistIds={shortlistIds}
                  checkedSteps={checkedSteps}
                  onToggleShortlist={toggleShortlist}
                  onToggleStep={toggleStep}
                  lang={lang}
                />
              ) : (
                <ScholarshipTable
                  items={displayedItems}
                  shortlistIds={shortlistIds}
                  onToggleShortlist={toggleShortlist}
                  onInspectChecklist={setModalItem}
                  lang={lang}
                />
              )}
            </div>
          </section>
        </div>
      </main>

      <ChecklistModal
        item={modalItem}
        onClose={() => setModalItem(null)}
        isShortlisted={modalItem ? shortlistIds.has(modalItem.record.id) : false}
        onToggleShortlist={toggleShortlist}
        checkedSteps={checkedSteps}
        onToggleStep={toggleStep}
        lang={lang}
      />

      {/* Non-intrusive Toast Stack */}
      <div
        aria-live="polite"
        className="fixed top-20 sm:top-auto sm:bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-xs"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="surface-elevated rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5 pointer-events-auto"
            >
              <CheckCircle2 className="w-4 h-4 text-[var(--crimson)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-main)]">{toast.title}</p>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                  {toast.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
