import { motion } from 'motion/react';
import { Download } from 'lucide-react';
import type { Language, ViewMode } from '../types/scholarship';
import { UI_COPY } from '../data/scholarshipsData';

interface NavbarProps {
  activeView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onDownloadCsv: () => void;
  canDownload: boolean;
  lang: Language;
}

export function Navbar({
  activeView,
  onSelectView,
  onDownloadCsv,
  canDownload,
  lang,
}: NavbarProps) {
  const copy = UI_COPY[lang];

  const navItems: Array<{ id: ViewMode; label: string }> = [
    { id: 'eligible', label: copy.navEligible },
    { id: 'near_miss', label: copy.navNearMiss },
    { id: 'shortlist', label: copy.navShortlist },
    { id: 'atlas', label: copy.navAtlas },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] transition-colors duration-300">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between gap-6 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('eligible')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 group focus-visible:outline-2 focus-visible:outline-[var(--crimson)] rounded-lg"
        >
          <span className="w-8 h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
            <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none" aria-hidden="true">
              <path
                d="M7 24H25M10 22V14M16 22V14M22 22V14M7 14L16 8L25 14H7Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="11.5" r="1.6" fill="var(--crimson)" />
            </svg>
          </span>
          <span className="font-athens text-base sm:text-lg font-bold tracking-tight text-[var(--text-main)]">
            {copy.brandTitle}{' '}
            <span className="italic text-[var(--crimson)]">{copy.brandAccent}</span>
          </span>
        </button>

        {/* Zone 2: Concise single-line desktop navigation links */}
        <nav
          aria-label="Scholarship Atlas Views"
          className="hidden lg:flex items-center gap-7"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--crimson)] rounded ${
                  isActive
                    ? 'text-[var(--text-main)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="activeAtlasNavUnderline"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-x-0 -bottom-[11px] h-[2px] bg-[var(--crimson)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onDownloadCsv}
            disabled={!canDownload}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[var(--crimson)] hover:bg-[var(--crimson-hover)] text-white text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[var(--crimson)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{copy.downloadReport}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
