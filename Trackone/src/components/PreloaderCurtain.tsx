import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export function PreloaderCurtain() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  });

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 480);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-[#08080A] text-[#FAF9F6] flex flex-col items-center justify-center px-6"
          role="status"
          aria-label="Loading Document Studio"
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl border border-white/15 bg-white/[0.03] flex items-center justify-center">
              <svg viewBox="0 0 48 48" className="w-8 h-8" fill="none" aria-hidden="true">
                <rect
                  x="11"
                  y="9"
                  width="26"
                  height="30"
                  rx="2.5"
                  stroke="#FAF9F6"
                  strokeWidth="2"
                />
                <path
                  d="M17 18H31M17 24H31M17 30H25"
                  stroke="#FAF9F6"
                  strokeOpacity="0.72"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="31" cy="30" r="2.2" fill="#C8102E" />
              </svg>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[#C8102E]">
                Document Intelligence
              </p>
              <h2 className="font-athens text-2xl font-bold tracking-[0.06em] text-white mt-1">
                Document Studio
              </h2>
            </div>
            <div className="w-36 h-[2px] bg-white/15 overflow-hidden rounded-full">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 0.65, ease: 'easeInOut', repeat: Infinity }}
                className="w-full h-full bg-[#C8102E]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
