import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SAMPLE_PDF } from '../data/seedData';
import type { PdfDocumentItem } from '../types/suite';
import {
  buildFallbackQuiz,
  countCorpusWords,
  formatQuizReportText,
  resolveLocalDocumentQa,
} from './documentEngine';

test('Document Q&A: retrieves exact page-cited answer and sentence excerpt from sample PDF', () => {
  const res = resolveLocalDocumentQa(
    [DEFAULT_SAMPLE_PDF],
    'What is Retrieval-Augmented Generation and why is it used?',
    'en'
  );
  assert.equal(res.found, true);
  assert.equal(res.pageNumber, 1);
  assert.equal(res.sourceDoc, DEFAULT_SAMPLE_PDF.name);
  assert.match(res.excerpt, /Retrieval-Augmented Generation/i);
});

test('Document Q&A: refuses out-of-document question strictly', () => {
  const res = resolveLocalDocumentQa(
    [DEFAULT_SAMPLE_PDF],
    'Who won the 2022 FIFA World Cup?',
    'en'
  );
  assert.equal(res.found, false);
  assert.equal(res.answer, 'Not found in the document.');
  assert.equal(res.pageNumber, 0);
});

test('Document Q&A: resolves Bangla query using semantic synonym mapping', () => {
  const res = resolveLocalDocumentQa(
    [DEFAULT_SAMPLE_PDF],
    'ওভারফিটিং (Overfitting) কী এবং কীভাবে কমানো যায়?',
    'bn'
  );
  assert.equal(res.found, true);
  assert.equal(res.pageNumber, 3);
  assert.match(res.answer, /ওভারফিটিং/);
  assert.match(res.excerpt, /Overfitting/i);
});

test('Document Scope: respects enabled flag across multiple uploaded PDFs', () => {
  const customDoc: PdfDocumentItem = {
    id: 'custom-networks',
    name: 'Computer_Networks_Ch4.pdf',
    enabled: true,
    pages: [
      {
        pageNumber: 2,
        text: 'Dijkstra shortest path routing computes minimum-cost trees across weighted autonomous graphs. Link-state packets flood topology updates reliably across routers.',
      },
    ],
  };

  const disabledSample = { ...DEFAULT_SAMPLE_PDF, enabled: false };
  const activeRes = resolveLocalDocumentQa(
    [disabledSample, customDoc],
    'How does Dijkstra routing compute minimum-cost trees?',
    'en'
  );
  assert.equal(activeRes.found, true);
  assert.equal(activeRes.sourceDoc, 'Computer_Networks_Ch4.pdf');
  assert.equal(activeRes.pageNumber, 2);

  const blockedSampleQuery = resolveLocalDocumentQa(
    [disabledSample, customDoc],
    'Explain Scaled Dot-Product Attention.',
    'en'
  );
  assert.equal(blockedSampleQuery.found, false);
});

test('Quiz Generator: generates 5+ varied MCQs for custom uploaded PDFs with shuffled correctIndex', () => {
  const customDoc: PdfDocumentItem = {
    id: 'custom-db',
    name: 'Database_Transactions.pdf',
    enabled: true,
    pages: [
      {
        pageNumber: 1,
        text: 'Atomicity guarantees that database transactions complete entirely or roll back without partial mutations. Consistency preserves schema invariants across committed states.',
      },
      {
        pageNumber: 2,
        text: 'Isolation prevents concurrent schedules from exposing uncommitted intermediate writes. Durability ensures committed logs survive sudden power outages via write-ahead logging.',
      },
    ],
  };

  const quiz = buildFallbackQuiz([customDoc], 5, 'en', 'Intermediate');
  assert.equal(quiz.length, 5);
  const indices = new Set<number>();
  quiz.forEach((q) => {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
    assert.equal(q.sourceDoc, 'Database_Transactions.pdf');
    assert.ok(q.explanationQuote.length > 15);
    indices.add(q.correctIndex);
  });
  assert.ok(indices.size > 1, 'Expected shuffled correctIndex values across generated MCQs');
});

test('Quiz Report & Corpus Word Count: formats graded report and tallies corpus words', () => {
  const quiz = buildFallbackQuiz([DEFAULT_SAMPLE_PDF], 7, 'en', 'Foundational');
  assert.equal(quiz.length, 7);
  const report = formatQuizReportText(quiz, { 0: quiz[0].correctIndex }, 'Foundational');
  assert.match(report, /Score: 1\/7/);
  assert.match(report, /Difficulty: Foundational/);
  assert.match(report, /\[CORRECT\]/);

  const words = countCorpusWords([DEFAULT_SAMPLE_PDF]);
  assert.ok(words > 150);
});
