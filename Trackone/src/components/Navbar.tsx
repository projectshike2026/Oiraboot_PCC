import { UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';
import { UI_COPY } from '../data/seedData';
import type { Language, WorkspaceView } from '../types/suite';

interface NavbarProps {
  lang: Language;
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onTriggerUpload: () => void;
}

export function Navbar({
  lang,
  activeView,
  onSelectView,
  onTriggerUpload,
}: NavbarProps) {
  const copy = UI_COPY[lang];

  const views: Array<{ id: WorkspaceView; label: string }> = [
    { id: 'chat', label: copy.navChat },
    { id: 'quiz', label: copy.navQuiz },
    { id: 'reader', label: copy.navReader },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] surface-elevated">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('chat')}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 group focus-visible:outline-2 focus-visible:outline-[var(--crimson)] rounded-lg text-left"
        >
          <motion.span
            whileHover={{ rotate: -4, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="w-8 h-8 rounded-lg bg-[var(--bg-inverse)] text-[var(--text-inverse)] flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 48 48" className="w-4.5 h-4.5" fill="none" aria-hidden="true">
              <rect
                x="11"
                y="9"
                width="26"
                height="30"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="2.3"
              />
              <path
                d="M17 18H31M17 24H31M17 30H24"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
              <circle cx="31" cy="30" r="2.2" fill="#C8102E" />
            </svg>
          </motion.span>
          <span className="font-athens font-bold text-lg sm:text-xl tracking-[0.02em] text-[var(--text-main)]">
            {copy.brandPrimary}{' '}
            <span className="italic text-[var(--crimson)]">{copy.brandAccent}</span>
          </span>
        </button>

        {/* Zone 2: Clean Single-Line Workspace View Navigation */}
        <nav aria-label="Workspace Views" className="hidden md:flex items-center gap-7">
          {views.map(({ id, label }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectView(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--crimson)] rounded ${
                  active
                    ? 'text-[var(--text-main)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>{label}</span>
                {active && (
                  <motion.span
                    layoutId="topbar-view-underline"
                    transition={{ type: 'spring', stiffness: 440, damping: 32 }}
                    className="absolute left-0 right-0 bottom-0 h-[2px] bg-[var(--crimson)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <motion.button
          type="button"
          onClick={onTriggerUpload}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          className="px-4 py-2 rounded-lg bg-[var(--crimson)] hover:bg-[var(--crimson-hover)] text-white text-xs font-semibold tracking-wide transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crimson)]"
        >
          <UploadCloud className="w-3.5 h-3.5 shrink-0" />
          <span>{copy.navUpload}</span>
        </motion.button>
      </div>
    </header>
  );
}
