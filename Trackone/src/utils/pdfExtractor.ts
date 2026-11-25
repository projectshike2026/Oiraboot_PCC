import * as pdfjsLib from 'pdfjs-dist';
import type { PdfDocumentItem, PdfPage } from '../types/suite';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PdfExtractionOutcome {
  loaded: PdfDocumentItem[];
  errors: Array<{ fileName: string; reason: 'empty' | 'parse' }>;
}

export async function extractPdfFiles(files: File[]): Promise<PdfExtractionOutcome> {
  const loaded: PdfDocumentItem[] = [];
  const errors: Array<{ fileName: string; reason: 'empty' | 'parse' }> = [];

  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages: PdfPage[] = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 0) {
          pages.push({ pageNumber: p, text });
        }
      }

      if (pages.length === 0) {
        errors.push({ fileName: file.name, reason: 'empty' });
        continue;
      }

      loaded.push({
        id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        pages,
        enabled: true,
      });
    } catch {
      errors.push({ fileName: file.name, reason: 'parse' });
    }
  }

  return { loaded, errors };
}
