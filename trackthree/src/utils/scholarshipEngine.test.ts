import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScholarshipsCsv } from './csvParser';
import {
  buildExportCsvReport,
  evaluateStudentProfile,
  filterAndSortScholarships,
} from './scholarshipEngine';

const csvPath = path.resolve(
  process.cwd(),
  'public/assets/aistudio/track3_scholarships__1__8b56b284.csv'
);
const rawCsv = fs.readFileSync(csvPath, 'utf8');
const allRecords = parseScholarshipsCsv(rawCsv);

test('CSV Parser: loads all 136 BIU scholarships including quoted multi-clause descriptions', () => {
  assert.equal(allRecords.length, 136);
  assert.equal(allRecords[0].id, 1);
  assert.equal(allRecords[0].name, 'Merit Excellence Award');
  assert.equal(allRecords[135].id, 136);

  const journalist = allRecords.find((r) => r.id === 21);
  assert.ok(journalist);
  assert.equal(
    journalist.description,
    'For students who write for a campus magazine, newspaper or news page.'
  );

  const cultural = allRecords.find((r) => r.id === 134);
  assert.ok(cultural);
  assert.equal(
    cultural.description,
    'For students who take part in cultural events such as music, drama or dance.'
  );
  assert.equal(cultural.amountBdt, 28000);
});

test('Eligibility Engine: strictly checks CGPA, multi-department semicolon list, need_based, and gender', () => {
  const summary = evaluateStudentProfile(allRecords, {
    cgpaInput: '3.50',
    department: 'CSE',
    financialSupportNeeded: false,
    gender: 'Male',
  });

  assert.equal(summary.isValidProfile, true);
  const eligibleIds = new Set(summary.eligible.map((e) => e.record.id));
  const nearMissIds = new Set(summary.nearMiss.map((e) => e.record.id));

  // ID 2: min_cgpa 3.5, CSE;EEE;CE, no, All -> MUST be eligible at exact 3.50
  assert.equal(eligibleIds.has(2), true);
  // ID 13: min_cgpa 3.0, BBA;CSE, no, All -> MUST be eligible
  assert.equal(eligibleIds.has(13), true);
  // ID 6: BBA only -> MUST NOT be eligible or nearMiss for CSE
  assert.equal(eligibleIds.has(6), false);
  assert.equal(nearMissIds.has(6), false);
  // ID 5: Women in Tech (3.0, CSE;EEE, no, Female) -> Male missing Female status -> nearMiss
  assert.equal(eligibleIds.has(5), false);
  assert.equal(nearMissIds.has(5), true);
  // ID 4: Need-Based Tuition Support (2.5, All, yes, All) -> financialSupportNeeded=false -> nearMiss
  assert.equal(eligibleIds.has(4), false);
  assert.equal(nearMissIds.has(4), true);
  // ID 24: Research Starter Scholarship (3.6, CSE;EEE, no, All) -> +0.10 CGPA short -> nearMiss
  assert.equal(eligibleIds.has(24), false);
  assert.equal(nearMissIds.has(24), true);

  const researchGap = summary.nearMiss.find((e) => e.record.id === 24);
  assert.ok(researchGap);
  assert.equal(researchGap.cgpaGap, 0.1);
  assert.match(researchGap.missingSummaryEn, /\+0\.10/);
});

test('Eligibility Engine: unlocks need-based and Female-only awards when profile matches', () => {
  const summary = evaluateStudentProfile(allRecords, {
    cgpaInput: '3.65',
    department: 'CSE',
    financialSupportNeeded: true,
    gender: 'Female',
  });

  const eligibleIds = new Set(summary.eligible.map((e) => e.record.id));
  assert.equal(eligibleIds.has(5), true); // Women in Tech
  assert.equal(eligibleIds.has(4), true); // Need-Based Tuition Support
  assert.equal(eligibleIds.has(24), true); // Research Starter Scholarship (3.6)
  assert.equal(eligibleIds.has(1), false); // Merit Excellence (3.8 -> nearMiss)

  const nearMiss1 = summary.nearMiss.find((e) => e.record.id === 1);
  assert.ok(nearMiss1);
  assert.equal(nearMiss1.cgpaGap, 0.15);
});

test('Validation: rejects out-of-range or empty CGPA without fabricating matches', () => {
  const tooHigh = evaluateStudentProfile(allRecords, {
    cgpaInput: '4.25',
    department: 'EEE',
    financialSupportNeeded: true,
    gender: 'Any',
  });
  assert.equal(tooHigh.isValidProfile, false);
  assert.equal(tooHigh.eligible.length, 0);
  assert.ok(tooHigh.validationErrorEn);

  const empty = evaluateStudentProfile(allRecords, {
    cgpaInput: '',
    department: 'English',
    financialSupportNeeded: false,
    gender: 'Any',
  });
  assert.equal(empty.isValidProfile, false);
  assert.equal(empty.eligible.length, 0);
});

test('Sorting, Checklist, Bangla output & CSV Report generation work accurately', () => {
  const summary = evaluateStudentProfile(allRecords, {
    cgpaInput: '3.90',
    department: 'EEE',
    financialSupportNeeded: true,
    gender: 'Female',
  });

  const byAmount = filterAndSortScholarships(summary.eligible, {
    searchQuery: '',
    needFilter: 'all',
    sortBy: 'amount_desc',
  });
  assert.equal(byAmount[0].record.amountBdt, 50000);
  assert.ok(byAmount[0].checklist.length >= 3);
  assert.ok(byAmount[0].matchReasonBn.includes('CGPA'));

  const byDeadline = filterAndSortScholarships(summary.eligible, {
    searchQuery: '',
    needFilter: 'all',
    sortBy: 'deadline_asc',
  });
  assert.ok(byDeadline[0].record.deadline <= byDeadline[1].record.deadline);

  const csvOut = buildExportCsvReport(
    byAmount.slice(0, 3),
    {
      cgpaInput: '3.90',
      department: 'EEE',
      financialSupportNeeded: true,
      gender: 'Female',
    },
    'en'
  );
  assert.match(csvOut, /Scholarship Name/);
  assert.match(csvOut, /50000/);
});

test('Near-Miss sorting ranks actionable CGPA gaps first before demographic or need mismatches', () => {
  const bbaSummary = evaluateStudentProfile(allRecords, {
    cgpaInput: '3.40',
    department: 'BBA',
    financialSupportNeeded: false,
    gender: 'Male',
  });
  const nearMissRanked = filterAndSortScholarships(bbaSummary.nearMiss, {
    searchQuery: '',
    needFilter: 'all',
    sortBy: 'amount_desc',
    isNearMissTab: true,
  });
  assert.ok(nearMissRanked.length > 0);
  assert.equal(nearMissRanked[0].gaps.length, 1);
  assert.equal(nearMissRanked[0].gaps[0].type, 'cgpa');
  assert.equal(nearMissRanked[0].cgpaGap, 0.1);
});

