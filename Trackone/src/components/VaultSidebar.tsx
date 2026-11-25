import { useState } from 'react';
import {
  BookOpen,
  Compass,
  FileText,
  Languages,
  Moon,
  RotateCcw,
  ShieldAlert,
  Sun,
  UploadCloud,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SAMPLE_PROMPTS, UI_COPY } from '../data/seedData';
import type { Language, PdfDocumentItem, ThemeMode } from '../types/suite';
import { countCorpusWords, getActiveDocuments } from '../utils/documentEngine';

interface VaultSidebarProps {
  lang: Language;
  theme: ThemeMode;
  documents: PdfDocumentItem[];
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onTriggerUpload: () => void;
  onDropFiles: (files: File[]) => void;
  onToggleDocumentScope: (id: string) => void;
  onRemoveDocument: (id: string) => void;
  onInspectDocument: (docName: string) => void;
  onResetSample: () => void;
  onRunPrompt: (query: string) => void;
}

export function VaultSidebar({
  lang,
  theme,
  documents,
  onToggleLanguage,
  onToggleTheme,
  onTriggerUpload,
  onDropFiles,
  onToggleDocumentScope,
  onRemoveDocument,
  onInspectDocument,
  onResetSample,
  onRunPrompt,
}: VaultSidebarProps) {
  const copy = UI_COPY[lang];
  const [isDragging, setIsDragging] = useState(false);

  const activeDocs = getActiveDocuments(documents);
  const totalPages = activeDocs.reduce((sum, d) => sum + d.pages.length, 0);
  const totalWords = countCorpusWords(activeDocs);

  return (
    <aside
      aria-label="Document Vault Sidebar"
      className="surface-card rounded-2xl p-5 flex flex-col gap-5 lg:h-full"
    >
      {/* Vault Header + Unboxed Tabular Corpus Metrics */}
      <div className="pb-4 border-b border-[var(--border-hairline)]">
        <p className="text-[11px] font-medium text-[var(--crimson)] tracking-wide">
          {copy.vaultEyebrow}
        </p>
        <div className="flex items-baseline justify-between gap-2 mt-0.5">
          <h2 className="font-athens text-2xl font-bold text-[var(--text-main)]">
            {copy.vaultTitle}
          </h2>
          <span className="font-mono-tabular text-xs text-[var(--text-muted)] shrink-0">
            {activeDocs.length}/{documents.length} active
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-faint)] font-mono-tabular">
          <span>{totalPages} Pages</span>
          <span aria-hidden="true">·</span>
          <span>{totalWords.toLocaleString()} Words</span>
        </div>
      </div>

      {/* Drag & Drop Multi-PDF Uploader */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files || []).filter(
            (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
          );
          onDropFiles(files);
        }}
      >
        <button
          type="button"
          onClick={onTriggerUpload}
          className={`w-full rounded-xl border border-dashed transition-all p-4 text-center group focus-visible:outline-2 focus-visible:outline-[var(--crimson)] ${
            isDragging
              ? 'border-[var(--crimson)] bg-[var(--crimson-soft)] scale-[1.01]'
              : 'border-[var(--border-strong)] hover:border-[var(--crimson)] bg-[var(--bg-subtle)]'
          }`}
        >
          <span className="w-9 h-9 mx-auto rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--crimson)] group-hover:-translate-y-0.5 transition-transform mb-2.5">
            <UploadCloud className="w-4 h-4" />
          </span>
          <span className="block text-xs font-semibold text-[var(--text-main)]">
            {copy.uploadTitle}
          </span>
          <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
            {copy.uploadSub}
          </span>
        </button>
      </div>

      {/* Document Archive List */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {documents.map((doc) => {
          const isEnabled = doc.enabled !== false;
          return (
            <div
              key={doc.id}
              className={`px-3 py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2.5 ${
                isEnabled
                  ? 'surface-subtle'
                  : 'bg-transparent border-[var(--border-hairline)] opacity-60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => onToggleDocumentScope(doc.id)}
                  aria-label={`Include ${doc.name} in active search`}
                  className="w-3.5 h-3.5 accent-[var(--crimson)] rounded shrink-0 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onInspectDocument(doc.name)}
                  aria-label={`Read ${doc.name} (${doc.pages.length} pages)`}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                >
                  <FileText className="w-4 h-4 text-[var(--crimson)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-main)] truncate group-hover:text-[var(--crimson)] transition-colors">
                      {doc.name}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-[var(--text-faint)]">
                      {doc.pages.length} {doc.pages.length === 1 ? 'Page' : 'Pages'}
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onInspectDocument(doc.name)}
                  aria-label={`Open ${doc.name} in Page Reader`}
                  className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--crimson)] transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
                {documents.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveDocument(doc.id)}
                    aria-label={`Remove ${doc.name}`}
                    className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--crimson)] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onResetSample}
        className="w-full py-2 px-3 rounded-xl surface-subtle hover:border-[var(--crimson)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
      >
        <RotateCcw className="w-3.5 h-3.5 text-[var(--crimson)]" />
        <span>{copy.restoreSample}</span>
      </button>

      {/* Verification Quick Prompts */}
      <div className="pt-4 border-t border-[var(--border-hairline)] space-y-2.5">
        <p className="text-xs font-medium text-[var(--text-faint)] flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
          <span>{copy.promptsTitle}</span>
        </p>
        <div className="space-y-1.5">
          {SAMPLE_PROMPTS.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.16 }}
              onClick={() => onRunPrompt(item.query)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center gap-2 ${
                item.isRefusalTest
                  ? 'bg-[var(--crimson-soft)] border border-[var(--crimson-border)] font-medium text-[var(--crimson)] hover:bg-[var(--crimson)] hover:text-white'
                  : 'surface-subtle hover:border-[var(--crimson)] text-[var(--text-main)]'
              }`}
            >
              {item.isRefusalTest && <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">
                {lang === 'bn' ? item.labelBn : item.labelEn}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom Workspace Preferences (Language + Theme) */}
      <div className="mt-auto pt-4 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleLanguage}
          aria-label={lang === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}
          className="px-3 py-2 rounded-xl surface-subtle hover:border-[var(--crimson)] text-xs font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Languages className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
          <span>{lang === 'en' ? 'EN / বাংলা' : 'বাংলা / EN'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="px-3 py-2 rounded-xl surface-subtle hover:border-[var(--crimson)] text-xs font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
              <span>{copy.darkMode}</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
              <span>{copy.lightMode}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
