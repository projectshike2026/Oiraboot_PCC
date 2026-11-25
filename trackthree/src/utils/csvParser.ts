import type { DepartmentCode, ScholarshipRecord } from '../types/scholarship';

const VALID_DEPARTMENTS = new Set<DepartmentCode | 'All'>([
  'All',
  'CSE',
  'EEE',
  'CE',
  'BBA',
  'English',
]);

/**
 * RFC-4180 compliant CSV line splitter supporting quoted fields with embedded commas.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseScholarshipsCsv(csvText: string): ScholarshipRecord[] {
  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV dataset is empty or missing header row.');
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expected = [
    'id',
    'name',
    'provider',
    'min_cgpa',
    'department',
    'need_based',
    'gender',
    'amount_bdt',
    'deadline',
    'description',
  ];

  for (const col of expected) {
    if (!header.includes(col)) {
      throw new Error(`Missing required CSV column: ${col}`);
    }
  }

  const idx = Object.fromEntries(expected.map((col) => [col, header.indexOf(col)])) as Record<
    string,
    number
  >;

  const records: ScholarshipRecord[] = [];
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cols = parseCsvLine(lines[rowIdx]);
    if (cols.length < expected.length) {
      continue;
    }

    const id = Number.parseInt(cols[idx.id], 10);
    const minCgpa = Number.parseFloat(cols[idx.min_cgpa]);
    const amountBdt = Number.parseInt(cols[idx.amount_bdt], 10);
    const departmentRaw = cols[idx.department];
    const departments = departmentRaw
      .split(';')
      .map((part) => part.trim())
      .filter((part): part is DepartmentCode | 'All' =>
        VALID_DEPARTMENTS.has(part as DepartmentCode | 'All')
      );

    const needRaw = cols[idx.need_based].toLowerCase();
    const genderRaw = cols[idx.gender];

    if (Number.isNaN(id) || Number.isNaN(minCgpa) || Number.isNaN(amountBdt)) {
      throw new Error(`Invalid numeric value at CSV row ${rowIdx + 1}`);
    }

    records.push({
      id,
      name: cols[idx.name],
      provider: cols[idx.provider],
      minCgpa,
      departmentRaw,
      departments: departments.length > 0 ? departments : ['All'],
      needBased: needRaw === 'yes',
      gender: genderRaw === 'Female' ? 'Female' : 'All',
      amountBdt,
      deadline: cols[idx.deadline],
      description: cols[idx.description],
    });
  }

  return records;
}
