import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  X,
} from 'lucide-react';
import { UI_COPY } from '../data/seedData';
import type {
  CitationJumpTarget,
  Language,
  PdfDocumentItem,
  WorkspaceView,
} from '../types/suite';

interface PageReaderPaneProps {
  lang: Language;
  documents: PdfDocumentItem[];
  selectedDocName: string;
  selectedPageNumber: number;
  highlightedCitation: CitationJumpTarget | null;
  returnView: WorkspaceView | null;
  onSelectDoc: (docName: string, pageNumber: number) => void;
  onClearHighlight: () => void;
  onReturnToCaller: () => void;
}

function renderHighlightedText(text: string, needle: string) {
  const cleanNeedle = needle.replace(/\.\.\.$/, '').trim();
  if (!cleanNeedle || cleanNeedle.length < 3) {
    return text;
  }

  const probe = cleanNeedle.slice(0, Math.min(cleanNeedle.length, 90));
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(probe.toLowerCase());

  if (idx === -1) {
    return text;
  }

  const matchLen = Math.min(cleanNeedle.length, text.length - idx);
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + matchLen);
  const after = text.slice(idx + matchLen);

  return (
    <>
      {before}
      <mark className="bg-[var(--crimson-soft)] text-[var(--crimson)] font-medium px-1 py-0.5 rounded">
        {match}
      </mark>
      {after}
    </>
  );
}

export function PageReaderPane({
  lang,
  documents,
  selectedDocName,
  selectedPageNumber,
  highlightedCitation,
  returnView,
  onSelectDoc,
  onClearHighlight,
  onReturnToCaller,
}: PageReaderPaneProps) {
  const copy = UI_COPY[lang];
  const [searchTerm, setSearchTerm] = useState('');

  const activeDoc = useMemo(
    () => documents.find((d) => d.name === selectedDocName) || documents[0],
    [documents, selectedDocName]
  );

  const filteredHits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    const hits: Array<{ docName: string; pageNumber: number; snippet: string }> = [];
    for (const doc of documents) {
      for (const p of doc.pages) {
        const idx = p.text.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 45);
          const end = Math.min(p.text.length, idx + q.length + 75);
          hits.push({
            docName: doc.name,
            pageNumber: p.pageNumber,
            snippet: p.text.slice(start, end),
          });
        }
      }
    }
    return hits;
  }, [documents, searchTerm]);

  const currentPage =
    activeDoc?.pages.find((p) => p.pageNumber === selectedPageNumber) || activeDoc?.pages[0];

  const currentIdx = activeDoc?.pages.findIndex((p) => p.pageNumber === currentPage?.pageNumber) ?? 0;
  const prevPage = currentIdx > 0 ? activeDoc?.pages[currentIdx - 1] : null;
  const nextPage =
    activeDoc && currentIdx >= 0 && currentIdx < activeDoc.pages.length - 1
      ? activeDoc.pages[currentIdx + 1]
      : null;

  const activeHighlightNeedle =
    searchTerm.trim().length >= 3
      ? searchTerm.trim()
      : highlightedCitation &&
          highlightedCitation.docName === activeDoc?.name &&
          highlightedCitation.pageNumber === currentPage?.pageNumber
        ? highlightedCitation.excerpt
        : '';

  return (
    <section
      aria-label="Indexed Page Reader"
      className="surface-card rounded-2xl flex flex-col lg:h-full min-h-[600px] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {returnView && (
            <button
              type="button"
              onClick={onReturnToCaller}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--crimson)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[var(--crimson)]" />
              <span>{returnView === 'quiz' ? 'Back to Quiz' : 'Back to Chat'}</span>
            </button>
          )}
          <div>
            <h1 className="font-athens text-xl sm:text-2xl font-bold text-[var(--text-main)]">
              {copy.readerTitle}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{copy.readerSubtitle}</p>
          </div>
        </div>

        {/* Keyword Search in PDFs */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="reader-search-input" className="sr-only">
            {copy.readerSearchPlaceholder}
          </label>
          <input
            id="reader-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={copy.readerSearchPlaceholder}
            className="field-input w-full pl-9 pr-8 py-2 rounded-xl text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear page search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--crimson)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Document & Page Navigation Bar */}
      <div className="px-6 py-3 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)]">
        <div className="flex flex-wrap items-center gap-2">
          {documents.map((doc) => {
            const isSelected = doc.name === activeDoc?.name;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDoc(doc.name, doc.pages[0]?.pageNumber || 1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-[var(--bg-inverse)] text-[var(--text-inverse)]'
                    : 'surface-subtle text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[180px] truncate">{doc.name}</span>
              </button>
            );
          })}
        </div>

        {activeDoc && currentPage && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!prevPage}
              onClick={() => prevPage && onSelectDoc(activeDoc.name, prevPage.pageNumber)}
              aria-label="Previous page"
              className="p-1.5 rounded-lg surface-subtle hover:border-[var(--crimson)] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono-tabular text-xs font-semibold text-[var(--text-main)] px-1">
              Page {currentPage.pageNumber} / {activeDoc.pages.length}
            </span>
            <button
              type="button"
              disabled={!nextPage}
              onClick={() => nextPage && onSelectDoc(activeDoc.name, nextPage.pageNumber)}
              aria-label="Next page"
              className="p-1.5 rounded-lg surface-subtle hover:border-[var(--crimson)] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Page Content + Page Strip */}
      <div className="flex-1 min-h-0 p-5 sm:p-6 overflow-y-auto space-y-5 max-h-[580px] lg:max-h-none">
        {searchTerm.trim().length >= 3 && (
          <div className="p-4 rounded-xl surface-subtle space-y-2.5">
            <p className="font-mono-tabular text-xs font-semibold text-[var(--crimson)]">
              {filteredHits.length} matching page{filteredHits.length === 1 ? '' : 's'} for "
              {searchTerm.trim()}"
            </p>
            {filteredHits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filteredHits.map((hit, idx) => (
                  <button
                    key={`${hit.docName}-${hit.pageNumber}-${idx}`}
                    type="button"
                    onClick={() => onSelectDoc(hit.docName, hit.pageNumber)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--crimson)] text-xs text-left transition-colors"
                  >
                    <span className="font-semibold text-[var(--text-main)]">
                      {hit.docName} · Page {hit.pageNumber}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {highlightedCitation &&
          highlightedCitation.docName === activeDoc?.name &&
          highlightedCitation.pageNumber === currentPage?.pageNumber && (
            <div className="px-4 py-2.5 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson-border)] flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-[var(--crimson)]">
                Citation highlighted on Page {currentPage.pageNumber} of {activeDoc.name}
              </span>
              <button
                type="button"
                onClick={onClearHighlight}
                className="text-[var(--crimson)] hover:underline font-semibold shrink-0"
              >
                Clear highlight
              </button>
            </div>
          )}

        {currentPage ? (
          <article className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-4">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--crimson)]">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>
                  {activeDoc.name} · Page {currentPage.pageNumber}
                </span>
              </div>
              <span className="font-mono-tabular text-xs text-[var(--text-faint)]">
                {currentPage.text.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            <p className="text-sm sm:text-[15px] text-[var(--text-main)] leading-[1.8] whitespace-pre-wrap">
              {renderHighlightedText(currentPage.text, activeHighlightNeedle)}
            </p>
          </article>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No extracted text pages available.</p>
        )}

        {/* Quick Page Index Row */}
        {activeDoc && activeDoc.pages.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-[var(--text-faint)] mr-1">Jump to page:</span>
            {activeDoc.pages.map((p) => {
              const active = p.pageNumber === currentPage?.pageNumber;
              return (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => onSelectDoc(activeDoc.name, p.pageNumber)}
                  className={`px-3 py-1 rounded-lg font-mono-tabular text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[var(--crimson)] text-white'
                      : 'surface-subtle text-[var(--text-muted)] hover:border-[var(--crimson)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {p.pageNumber}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
