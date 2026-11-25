export type Language = 'en' | 'bn';
export type ThemeMode = 'light' | 'dark';
export type WorkspaceView = 'chat' | 'quiz' | 'reader';

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfDocumentItem {
  id: string;
  name: string;
  pages: PdfPage[];
  enabled?: boolean;
}

export interface DocumentQaResult {
  found: boolean;
  answer: string;
  sourceDoc: string;
  pageNumber: number;
  excerpt: string;
  mode?: 'ai' | 'local';
}

export interface PdfChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  result?: DocumentQaResult;
  isLoading?: boolean;
  timestamp: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  pageNumber: number;
  sourceDoc: string;
  explanationQuote: string;
}

export type QuizDifficulty = 'Foundational' | 'Intermediate' | 'Advanced';

export interface CitationJumpTarget {
  docName: string;
  pageNumber: number;
  excerpt: string;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  isAlert?: boolean;
}
