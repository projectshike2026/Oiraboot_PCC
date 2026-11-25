import type {
  ChecklistStep,
  DepartmentCode,
  EligibilityGap,
  EligibilityStatus,
  EvaluatedScholarship,
  NeedFilter,
  ProfileEvaluationSummary,
  ScholarshipRecord,
  SortOption,
  StudentProfile,
} from '../types/scholarship';

const NEAR_MISS_CGPA_WINDOW = 0.5;
const NEAR_MISS_COMBO_WINDOW = 0.3;

export function toBasisPoints(value: number): number {
  return Math.round(value * 100);
}

export function parseValidCgpa(cgpaInput: string): {
  valid: boolean;
  value: number | null;
  errorEn: string | null;
  errorBn: string | null;
} {
  const trimmed = cgpaInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      value: null,
      errorEn: 'Enter your current CGPA (0.00 to 4.00) to compute exact matches.',
      errorBn: 'সঠিক ফলাফল দেখতে আপনার বর্তমান CGPA (0.00 থেকে 4.00) লিখুন।',
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 4) {
    return {
      valid: false,
      value: null,
      errorEn: 'CGPA must be between 0.00 and 4.00.',
      errorBn: 'CGPA অবশ্যই 0.00 থেকে 4.00 এর মধ্যে হতে হবে।',
    };
  }

  return {
    valid: true,
    value: Math.round(parsed * 100) / 100,
    errorEn: null,
    errorBn: null,
  };
}

export function formatBdt(amount: number): string {
  return `BDT ${amount.toLocaleString('en-US')}`;
}

export function formatDeadline(isoDate: string, lang: 'en' | 'bn' = 'en'): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function departmentDisplayLabel(deptRaw: string, lang: 'en' | 'bn'): string {
  if (deptRaw === 'All') {
    return lang === 'bn' ? 'সকল বিভাগ' : 'All departments';
  }
  return deptRaw.split(';').join(', ');
}

function detectAdditionalCondition(description: string): {
  conditionEn: string | null;
  conditionBn: string | null;
  docStepEn: string;
  docStepBn: string;
} {
  const d = description.toLowerCase();

  if (d.includes('github')) {
    return {
      conditionEn: 'Requires a public GitHub profile demonstrating real project work.',
      conditionBn: 'বাস্তব প্রজেক্টসহ একটি পাবলিক GitHub প্রোফাইল থাকা প্রয়োজন।',
      docStepEn: 'Prepare your public GitHub profile URL with pinned software repositories.',
      docStepBn: 'আপনার প্রজেক্টগুলোসহ পাবলিক GitHub প্রোফাইলের লিংক প্রস্তুত করুন।',
    };
  }
  if (d.includes('research') || d.includes('join a lab') || d.includes('higher studies')) {
    return {
      conditionEn: 'Targets students pursuing research, lab work, or higher studies.',
      conditionBn: 'গবেষণা, ল্যাব কার্যক্রম বা উচ্চশিক্ষায় আগ্রহী শিক্ষার্থীদের জন্য প্রযোজ্য।',
      docStepEn: 'Draft a short statement of research interest or faculty lab preference.',
      docStepBn: 'গবেষণার আগ্রহ বা ল্যাব সংক্রান্ত একটি সংক্ষিপ্ত বিবরণী প্রস্তুত করুন।',
    };
  }
  if (d.includes('startup') || d.includes('small business') || d.includes('online business')) {
    return {
      conditionEn: 'Requires a startup concept or active small/online business.',
      conditionBn: 'স্টার্টআপ আইডিয়া অথবা চলমান ক্ষুদ্র বা অনলাইন ব্যবসা থাকা প্রয়োজন।',
      docStepEn: 'Prepare a 1-page summary of your startup idea or business activity.',
      docStepBn: 'আপনার স্টার্টআপ আইডিয়া বা ব্যবসার ১ পৃষ্ঠার সংক্ষিপ্তসার তৈরি করুন।',
    };
  }
  if (d.includes('volunteer') || d.includes('community') || d.includes('blood donor')) {
    return {
      conditionEn: 'Requires verified community service, volunteer hours, or blood donation record.',
      conditionBn: 'স্বেচ্ছাসেবামূলক কাজ, কমিউনিটি সেবা বা রক্তদানের প্রমাণপত্র প্রয়োজন।',
      docStepEn: 'Collect volunteer certificates or organization verification letters.',
      docStepBn: 'স্বেচ্ছাসেবী সনদ বা সংশ্লিষ্ট সংগঠনের প্রত্যয়নপত্র সংগ্রহ করুন।',
    };
  }
  if (d.includes('hackathon') || d.includes('programming contest') || d.includes('competition') || d.includes('debate') || d.includes('sports')) {
    return {
      conditionEn: 'Prioritizes documented competition, hackathon, debate, or sports participation.',
      conditionBn: 'প্রতিযোগিতা, হ্যাকাথন, বিতর্ক বা খেলাধুলায় অংশগ্রহণের প্রমাণপত্র প্রয়োজন।',
      docStepEn: 'Attach participation certificates, awards, or team selection proof.',
      docStepBn: 'অংশগ্রহণ সনদ, পুরস্কার বা টিম নির্বাচনের প্রমাণপত্র সংযুক্ত করুন।',
    };
  }
  if (d.includes('software project') || d.includes('electronics') || d.includes('power project') || d.includes('buildings') || d.includes('roads, bridges')) {
    return {
      conditionEn: 'Requires documented hands-on academic or technical project work.',
      conditionBn: 'সংশ্লিষ্ট একাডেমিক বা টেকনিক্যাল প্রজেক্টের বিবরণ ও প্রমাণ প্রয়োজন।',
      docStepEn: 'Compile a brief portfolio or report of your relevant technical projects.',
      docStepBn: 'আপনার সংশ্লিষ্ট টেকনিক্যাল প্রজেক্টগুলোর সংক্ষিপ্ত রিপোর্ট বা পোর্টফোলিও তৈরি করুন।',
    };
  }
  if (d.includes('first in their family') || d.includes('rural') || d.includes('coastal') || d.includes('haor') || d.includes('hill tracts') || d.includes('freedom fighter') || d.includes('disability')) {
    return {
      conditionEn: 'Includes specific background or regional eligibility criteria — verify status.',
      conditionBn: 'নির্দিষ্ট আঞ্চলিক বা পারিবারিক যোগ্যতার শর্ত রয়েছে — প্রযোজ্যতা যাচাই করুন।',
      docStepEn: 'Keep supporting background, regional residency, or official status documents ready.',
      docStepBn: 'প্রযোজ্য আঞ্চলিক, পারিবারিক বা সরকারি সনদপত্র প্রস্তুত রাখুন।',
    };
  }
  if (d.includes('writing') || d.includes('journalist') || d.includes('magazine') || d.includes('music') || d.includes('photography')) {
    return {
      conditionEn: 'Requires writing, journalism, arts, or media portfolio samples.',
      conditionBn: 'লেখালেখি, সাংবাদিকতা, শিল্পকলা বা মিডিয়া কাজের নমুনা প্রয়োজন।',
      docStepEn: 'Select 2–3 published articles, creative pieces, or media work samples.',
      docStepBn: 'আপনার প্রকাশিত লেখা, সৃজনশীল কাজ বা মিডিয়া নমুনা সংগ্রহ করুন।',
    };
  }
  if (d.includes('top 5 students')) {
    return {
      conditionEn: 'Restricted to the top 5 ranked students by CGPA in each department.',
      conditionBn: 'প্রতিটি বিভাগের CGPA অনুযায়ী শীর্ষ ৫ শিক্ষার্থীর জন্য নির্ধারিত।',
      docStepEn: 'Confirm your departmental rank standing via the registrar / department office.',
      docStepBn: 'বিভাগীয় অফিস থেকে আপনার শীর্ষ ৫ মেধাক্রমের অবস্থান যাচাই করুন।',
    };
  }

  return {
    conditionEn: null,
    conditionBn: null,
    docStepEn: 'Prepare a brief 1-paragraph statement explaining how you fit the scholarship focus.',
    docStepBn: 'বৃত্তির লক্ষ্যের সাথে আপনার সামঞ্জস্য তুলে ধরে ১ অনুচ্ছেদের একটি বিবৃতি লিখুন।',
  };
}

export function buildChecklist(record: ScholarshipRecord): ChecklistStep[] {
  const extra = detectAdditionalCondition(record.description);
  const steps: ChecklistStep[] = [
    {
      id: `sch-${record.id}-step-1`,
      titleEn: `Verify CGPA (${record.minCgpa.toFixed(2)}+) & Department (${departmentDisplayLabel(record.departmentRaw, 'en')})`,
      titleBn: `CGPA (${record.minCgpa.toFixed(2)}+) ও বিভাগ (${departmentDisplayLabel(record.departmentRaw, 'bn')}) যাচাই করুন`,
      detailEn: 'Download your latest official Bayview University grade sheet / academic transcript.',
      detailBn: 'আপনার সর্বশেষ অফিসিয়াল একাডেমিক ট্রান্সক্রিপ্ট বা গ্রেড শিট সংগ্রহ করুন।',
    },
  ];

  if (record.needBased) {
    steps.push({
      id: `sch-${record.id}-step-need`,
      titleEn: 'Prepare Financial Support Documentation',
      titleBn: 'আর্থিক সহায়তার প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন',
      detailEn: 'Include family income certificate or hardship explanation required for need-based review.',
      detailBn: 'নিড-বেজড যাচাইয়ের জন্য পারিবারিক আয়ের সনদ বা আর্থিক বিবরণী সংযুক্ত করুন।',
    });
  }

  if (record.gender === 'Female') {
    steps.push({
      id: `sch-${record.id}-step-gender`,
      titleEn: 'Include Student ID / Female Applicant Verification',
      titleBn: 'শিক্ষার্থী আইডি ও ছাত্রী হিসেবে পরিচয় নিশ্চিত করুন',
      detailEn: 'Attach your valid BIU Student ID card confirming enrollment under female applicant eligibility.',
      detailBn: 'বৈধ BIU স্টুডেন্ট আইডি কার্ড সংযুক্ত করুন।',
    });
  }

  steps.push({
    id: `sch-${record.id}-step-focus`,
    titleEn: 'Prepare Criterion-Specific Supporting Evidence',
    titleBn: 'বৃত্তির নির্ধারিত শর্ত অনুযায়ী প্রমাণপত্র প্রস্তুত করুন',
    detailEn: `${extra.docStepEn} (${record.description})`,
    detailBn: `${extra.docStepBn} (${record.description})`,
  });

  steps.push({
    id: `sch-${record.id}-step-submit`,
    titleEn: `Submit to ${record.provider} before ${formatDeadline(record.deadline, 'en')}`,
    titleBn: `${formatDeadline(record.deadline, 'bn')} তারিখের আগে ${record.provider}-এ আবেদন জমা দিন`,
    detailEn: `Confirm all attachments for the ${formatBdt(record.amountBdt)} award prior to the ${record.deadline} cutoff.`,
    detailBn: `${record.deadline} শেষ তারিখের আগে ${formatBdt(record.amountBdt)} বৃত্তির সম্পূর্ণ আবেদন জমা দিন।`,
  });

  return steps;
}

export function evaluateScholarshipForStudent(
  record: ScholarshipRecord,
  studentCgpa: number,
  department: DepartmentCode,
  financialSupportNeeded: boolean,
  gender: 'Female' | 'Male' | 'Any'
): EvaluatedScholarship {
  const studentBp = toBasisPoints(studentCgpa);
  const minBp = toBasisPoints(record.minCgpa);
  const cgpaDiff = (studentBp - minBp) / 100;
  const cgpaGap = cgpaDiff < 0 ? Math.abs(cgpaDiff) : 0;
  const cgpaPasses = studentBp >= minBp;

  const deptPasses =
    record.departments.includes('All') || record.departments.includes(department);
  const needPasses = !record.needBased || financialSupportNeeded;
  const genderPasses = record.gender === 'All' || gender === 'Female';

  const gaps: EligibilityGap[] = [];
  if (!deptPasses) {
    gaps.push({
      type: 'department',
      labelEn: `Department: requires ${departmentDisplayLabel(record.departmentRaw, 'en')} (your department: ${department})`,
      labelBn: `বিভাগ: ${departmentDisplayLabel(record.departmentRaw, 'bn')} প্রয়োজন (আপনার বিভাগ: ${department})`,
    });
  }
  if (!cgpaPasses) {
    gaps.push({
      type: 'cgpa',
      cgpaDelta: Number(cgpaGap.toFixed(2)),
      labelEn: `CGPA: need +${cgpaGap.toFixed(2)} more (requires ${record.minCgpa.toFixed(2)}, yours is ${studentCgpa.toFixed(2)})`,
      labelBn: `CGPA: আরও +${cgpaGap.toFixed(2)} প্রয়োজন (ন্যূনতম ${record.minCgpa.toFixed(2)}, আপনার ${studentCgpa.toFixed(2)})`,
    });
  }
  if (!needPasses) {
    gaps.push({
      type: 'need_based',
      labelEn: 'Financial Need: restricted to students requiring financial support',
      labelBn: 'আর্থিক সহায়তা: শুধুমাত্র আর্থিকভাবে অসচ্ছল শিক্ষার্থীদের জন্য প্রযোজ্য',
    });
  }
  if (!genderPasses) {
    gaps.push({
      type: 'gender',
      labelEn: 'Gender: open exclusively to Female students',
      labelBn: 'লিঙ্গ শর্ত: শুধুমাত্র নারী শিক্ষার্থীদের জন্য নির্ধারিত',
    });
  }

  let status: EligibilityStatus = 'ineligible';
  if (gaps.length === 0) {
    status = 'eligible';
  } else if (deptPasses) {
    const onlyCgpaGap =
      !cgpaPasses && needPasses && genderPasses && cgpaGap <= NEAR_MISS_CGPA_WINDOW;
    const onlySingleNonDeptGap =
      cgpaPasses && (!needPasses || !genderPasses) && gaps.length === 1;
    const smallCgpaPlusOneGap =
      !cgpaPasses && cgpaGap <= NEAR_MISS_COMBO_WINDOW && gaps.length === 2;

    if (onlyCgpaGap || onlySingleNonDeptGap || smallCgpaPlusOneGap) {
      status = 'near_miss';
    }
  }

  const cgpaClauseEn =
    cgpaDiff > 0
      ? `Your ${studentCgpa.toFixed(2)} CGPA clears the ${record.minCgpa.toFixed(2)} requirement by +${cgpaDiff.toFixed(2)}.`
      : cgpaDiff === 0
      ? `Your ${studentCgpa.toFixed(2)} CGPA meets the exact ${record.minCgpa.toFixed(2)} minimum.`
      : `Requires ${record.minCgpa.toFixed(2)} CGPA (+${cgpaGap.toFixed(2)} above your ${studentCgpa.toFixed(2)}).`;

  const cgpaClauseBn =
    cgpaDiff > 0
      ? `আপনার ${studentCgpa.toFixed(2)} CGPA নির্ধারিত ${record.minCgpa.toFixed(2)} শর্তের চেয়ে +${cgpaDiff.toFixed(2)} বেশি।`
      : cgpaDiff === 0
      ? `আপনার ${studentCgpa.toFixed(2)} CGPA ঠিক ${record.minCgpa.toFixed(2)} ন্যূনতম শর্ত পূরণ করে।`
      : `ন্যূনতম ${record.minCgpa.toFixed(2)} CGPA প্রয়োজন (আপনার ${studentCgpa.toFixed(2)} থেকে +${cgpaGap.toFixed(2)} বেশি)।`;

  const deptClauseEn = record.departments.includes('All')
    ? `Open to all BIU departments including ${department}.`
    : `Specifically targets ${departmentDisplayLabel(record.departmentRaw, 'en')} including ${department}.`;

  const deptClauseBn = record.departments.includes('All')
    ? `${department}-সহ BIU-এর সকল বিভাগের জন্য উন্মুক্ত।`
    : `বিশেষভাবে ${department}-সহ ${departmentDisplayLabel(record.departmentRaw, 'bn')} বিভাগের জন্য নির্ধারিত।`;

  const needClauseEn = record.needBased
    ? 'Matches your financial support profile (need-based).'
    : 'Open merit/activity award (financial need proof not required).';

  const needClauseBn = record.needBased
    ? 'আপনার আর্থিক সহায়তার প্রয়োজনের সাথে সামঞ্জস্যপূর্ণ (নিড-বেজড)।'
    : 'মেধা ও কার্যক্রমভিত্তিক বৃত্তি (আর্থিক অসচ্ছলতার প্রমাণ বাধ্যতামূলক নয়)।';

  const genderClauseEn =
    record.gender === 'Female' ? ' Specifically reserves funding for female scholars.' : '';
  const genderClauseBn =
    record.gender === 'Female' ? ' বিশেষভাবে নারী শিক্ষার্থীদের জন্য সংরক্ষিত।' : '';

  const matchReasonEn = `${cgpaClauseEn} ${deptClauseEn} ${needClauseEn}${genderClauseEn} Official scope: "${record.description}"`;
  const matchReasonBn = `${cgpaClauseBn} ${deptClauseBn} ${needClauseBn}${genderClauseBn} অফিসিয়াল বিবরণ: "${record.description}"`;

  const missingSummaryEn = gaps.map((g) => g.labelEn).join(' · ');
  const missingSummaryBn = gaps.map((g) => g.labelBn).join(' · ');

  const extra = detectAdditionalCondition(record.description);

  return {
    record,
    status,
    cgpaMargin: Number(cgpaDiff.toFixed(2)),
    cgpaGap: Number(cgpaGap.toFixed(2)),
    gaps,
    matchReasonEn,
    matchReasonBn,
    missingSummaryEn,
    missingSummaryBn,
    verificationNoteEn: extra.conditionEn,
    verificationNoteBn: extra.conditionBn,
    checklist: buildChecklist(record),
  };
}

export function evaluateStudentProfile(
  records: ScholarshipRecord[],
  profile: StudentProfile
): ProfileEvaluationSummary {
  const cgpaCheck = parseValidCgpa(profile.cgpaInput);
  if (!cgpaCheck.valid || cgpaCheck.value === null) {
    return {
      isValidProfile: false,
      cgpaValue: null,
      validationErrorEn: cgpaCheck.errorEn,
      validationErrorBn: cgpaCheck.errorBn,
      eligible: [],
      nearMiss: [],
      allEvaluated: [],
      totalPotentialBdt: 0,
      maxSingleAwardBdt: 0,
    };
  }

  const studentCgpa = cgpaCheck.value;
  const allEvaluated = records.map((record) =>
    evaluateScholarshipForStudent(
      record,
      studentCgpa,
      profile.department,
      profile.financialSupportNeeded,
      profile.gender
    )
  );

  const eligible = allEvaluated.filter((item) => item.status === 'eligible');
  const nearMiss = allEvaluated.filter((item) => item.status === 'near_miss');
  const totalPotentialBdt = eligible.reduce((sum, item) => sum + item.record.amountBdt, 0);
  const maxSingleAwardBdt = eligible.reduce(
    (max, item) => Math.max(max, item.record.amountBdt),
    0
  );

  return {
    isValidProfile: true,
    cgpaValue: studentCgpa,
    validationErrorEn: null,
    validationErrorBn: null,
    eligible,
    nearMiss,
    allEvaluated,
    totalPotentialBdt,
    maxSingleAwardBdt,
  };
}

export function filterAndSortScholarships(
  items: EvaluatedScholarship[],
  options: {
    searchQuery: string;
    needFilter: NeedFilter;
    sortBy: SortOption;
    isNearMissTab?: boolean;
  }
): EvaluatedScholarship[] {
  const q = options.searchQuery.trim().toLowerCase();

  const filtered = items.filter(({ record }) => {
    if (options.needFilter === 'need_based' && !record.needBased) return false;
    if (options.needFilter === 'merit_open' && record.needBased) return false;

    if (!q) return true;
    return (
      record.name.toLowerCase().includes(q) ||
      record.provider.toLowerCase().includes(q) ||
      record.description.toLowerCase().includes(q) ||
      record.departmentRaw.toLowerCase().includes(q) ||
      String(record.id) === q
    );
  });

  return [...filtered].sort((a, b) => {
    if (options.isNearMissTab && options.sortBy === 'amount_desc') {
      const priorityScore = (item: EvaluatedScholarship): number => {
        if (item.gaps.length === 1 && item.gaps[0].type === 'cgpa') return 0;
        if (item.gaps.length === 1 && item.gaps[0].type === 'need_based') return 1;
        if (item.gaps.length === 1 && item.gaps[0].type === 'gender') return 2;
        return 3;
      };
      const pa = priorityScore(a);
      const pb = priorityScore(b);
      if (pa !== pb) return pa - pb;
      if (a.cgpaGap !== b.cgpaGap) return a.cgpaGap - b.cgpaGap;
    }

    switch (options.sortBy) {
      case 'deadline_asc': {
        const cmp = a.record.deadline.localeCompare(b.record.deadline);
        if (cmp !== 0) return cmp;
        return b.record.amountBdt - a.record.amountBdt;
      }
      case 'min_cgpa_desc': {
        if (b.record.minCgpa !== a.record.minCgpa) {
          return b.record.minCgpa - a.record.minCgpa;
        }
        return b.record.amountBdt - a.record.amountBdt;
      }
      case 'id_asc':
        return a.record.id - b.record.id;
      case 'amount_desc':
      default: {
        if (b.record.amountBdt !== a.record.amountBdt) {
          return b.record.amountBdt - a.record.amountBdt;
        }
        return a.record.deadline.localeCompare(b.record.deadline);
      }
    }
  });
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

export function buildExportCsvReport(
  items: EvaluatedScholarship[],
  profile: StudentProfile,
  lang: 'en' | 'bn'
): string {
  const headers = [
    'ID',
    'Scholarship Name',
    'Provider',
    'Status',
    'Amount (BDT)',
    'Min CGPA',
    'Department',
    'Need-Based',
    'Gender',
    'Deadline',
    'Official Description',
    'Verified Reason / Gap',
    'How to Apply Checklist',
  ];

  const rows = items.map((item) => {
    const { record } = item;
    const reasonOrGap =
      item.status === 'eligible'
        ? lang === 'bn'
          ? item.matchReasonBn
          : item.matchReasonEn
        : lang === 'bn'
        ? item.missingSummaryBn
        : item.missingSummaryEn;

    const checklistStr = item.checklist
      .map((step, i) => `${i + 1}. ${lang === 'bn' ? step.titleBn : step.titleEn}`)
      .join(' | ');

    return [
      String(record.id),
      record.name,
      record.provider,
      item.status.toUpperCase(),
      String(record.amountBdt),
      record.minCgpa.toFixed(2),
      record.departmentRaw,
      record.needBased ? 'yes' : 'no',
      record.gender,
      record.deadline,
      record.description,
      reasonOrGap,
      checklistStr,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const metaComment = `# Bayview Scholarship Atlas Report | Profile: CGPA=${profile.cgpaInput}, Dept=${profile.department}, FinancialNeed=${profile.financialSupportNeeded ? 'Yes' : 'No'}, Gender=${profile.gender}`;
  return [metaComment, headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}
