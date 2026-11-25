import { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  BookMarked,
  Quote,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UI_COPY } from '../data/seedData';
import type { CitationJumpTarget, Language, PdfChatMessage } from '../types/suite';

interface ChatWorkbenchProps {
  lang: Language;
  messages: PdfChatMessage[];
  queryInput: string;
  isQuerying: boolean;
  onChangeQueryInput: (val: string) => void;
  onSubmitQuery: (query: string) => void;
  onClearChat: () => void;
  onJumpToCitation: (target: CitationJumpTarget) => void;
}

export function ChatWorkbench({
  lang,
  messages,
  queryInput,
  isQuerying,
  onChangeQueryInput,
  onSubmitQuery,
  onClearChat,
  onJumpToCitation,
}: ChatWorkbenchProps) {
  const copy = UI_COPY[lang];
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages]);

  const handleSpotlightMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <section
      aria-label="Document Chat Workbench"
      onMouseMove={handleSpotlightMove}
      className="surface-card spotlight-card rounded-2xl flex flex-col lg:h-full min-h-[600px] overflow-hidden"
    >
      {/* Workbench Header */}
      <div className="px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-athens text-xl sm:text-2xl font-bold text-[var(--text-main)]">
            {copy.chatTitle}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{copy.chatSubtitle}</p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
            <span>Page-Cited RAG</span>
          </div>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={onClearChat}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--crimson)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--crimson)] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{copy.clearChat}</span>
            </button>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[540px] lg:max-h-none"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-start gap-3.5 ${
              msg.role === 'user' ? 'justify-end' : ''
            }`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-xl space-y-1 text-right">
                <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-[var(--bg-inverse)] text-[var(--text-inverse)] font-medium text-sm text-left">
                  {msg.text}
                </div>
                <p className="font-mono-tabular text-[11px] text-[var(--text-faint)]">
                  {msg.timestamp}
                </p>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-inverse)] text-[var(--text-inverse)] flex items-center justify-center shrink-0 mt-0.5">
                  <BookMarked className="w-4 h-4 text-[var(--crimson)]" />
                </div>

                <div className="flex-1 max-w-3xl space-y-1.5">
                  <div className="surface-subtle rounded-2xl rounded-tl-sm p-4 sm:p-5 space-y-3.5">
                    {msg.isLoading && (
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="flex items-end gap-1 h-4" aria-hidden="true">
                          <span className="w-1 h-2 bg-[var(--crimson)] rounded-full animate-pulse" />
                          <span className="w-1 h-4 bg-[var(--crimson)] rounded-full animate-pulse" />
                          <span className="w-1 h-2.5 bg-[var(--crimson)] rounded-full animate-pulse" />
                        </span>
                        <span>Scanning indexed PDF pages and verifying citations...</span>
                      </div>
                    )}

                    {msg.text && (
                      <p className="text-sm text-[var(--text-main)] leading-relaxed">
                        {msg.text}
                      </p>
                    )}

                    {msg.result && !msg.result.found && (
                      <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--crimson-border)] flex items-start gap-3">
                        <ShieldAlert className="w-4 h-4 text-[var(--crimson)] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-[var(--text-main)]">
                            {msg.result.answer}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                            {copy.notFoundNote}
                          </p>
                        </div>
                      </div>
                    )}

                    {msg.result && msg.result.found && (
                      <div className="space-y-3.5">
                        <p className="text-sm text-[var(--text-main)] leading-relaxed">
                          {msg.result.answer}
                        </p>

                        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--crimson)] flex items-center gap-1.5">
                              <Quote className="w-3.5 h-3.5 shrink-0" />
                              <span>{copy.verifiedExcerpt}</span>
                            </span>

                            <div className="flex items-center gap-3">
                              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                                Page {msg.result.pageNumber} · {msg.result.sourceDoc}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onJumpToCitation({
                                    docName: msg.result!.sourceDoc,
                                    pageNumber: msg.result!.pageNumber,
                                    excerpt: msg.result!.excerpt,
                                  })
                                }
                                className="px-2.5 py-1 rounded-md bg-[var(--crimson-soft)] hover:bg-[var(--crimson)] text-[var(--crimson)] hover:text-white text-[11px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                              >
                                <span>
                                  {copy.openPage} {msg.result.pageNumber}
                                </span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-[var(--text-muted)] italic leading-relaxed">
                            "{msg.result.excerpt}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="font-mono-tabular text-[11px] text-[var(--text-faint)] pl-1">
                    {msg.timestamp}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Prompt Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitQuery(queryInput);
        }}
        className="p-4 sm:p-5 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex items-center gap-3"
      >
        <label htmlFor="pdf-chat-input" className="sr-only">
          {copy.chatPlaceholder}
        </label>
        <input
          id="pdf-chat-input"
          type="text"
          value={queryInput}
          onChange={(e) => onChangeQueryInput(e.target.value)}
          placeholder={copy.chatPlaceholder}
          className="field-input flex-1 px-4 py-3 rounded-xl text-sm"
        />
        <motion.button
          type="submit"
          disabled={isQuerying || !queryInput.trim()}
          whileTap={{ scale: 0.97 }}
          className="px-5 py-3 rounded-xl bg-[var(--crimson)] hover:bg-[var(--crimson-hover)] text-white font-semibold text-xs tracking-wide transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50 whitespace-nowrap"
        >
          <span>{copy.chatSend}</span>
          <Send className="w-3.5 h-3.5" />
        </motion.button>
      </form>
    </section>
  );
}
