export type DepartmentCode = 'CSE' | 'EEE' | 'CE' | 'BBA' | 'English';

export type GenderOption = 'Female' | 'Male' | 'Any';

export type Language = 'en' | 'bn';

export type ThemeMode = 'light' | 'dark';

export type ViewMode = 'eligible' | 'near_miss' | 'shortlist' | 'atlas';

export type DisplayLayout = 'cards' | 'table';

export type NeedFilter = 'all' | 'need_based' | 'merit_open';

export type SortOption = 'amount_desc' | 'deadline_asc' | 'min_cgpa_desc' | 'id_asc';

export interface StudentProfile {
  cgpaInput: string;
  department: DepartmentCode;
  financialSupportNeeded: boolean;
  gender: GenderOption;
}

export interface ScholarshipRecord {
  id: number;
  name: string;
  provider: string;
  minCgpa: number;
  departmentRaw: string;
  departments: Array<DepartmentCode | 'All'>;
  needBased: boolean;
  gender: 'All' | 'Female';
  amountBdt: number;
  deadline: string;
  description: string;
}

export type EligibilityStatus = 'eligible' | 'near_miss' | 'ineligible';

export type GapType = 'cgpa' | 'need_based' | 'gender' | 'department';

export interface EligibilityGap {
  type: GapType;
  labelEn: string;
  labelBn: string;
  cgpaDelta?: number;
}

export interface ChecklistStep {
  id: string;
  titleEn: string;
  titleBn: string;
  detailEn: string;
  detailBn: string;
}

export interface EvaluatedScholarship {
  record: ScholarshipRecord;
  status: EligibilityStatus;
  cgpaMargin: number;
  cgpaGap: number;
  gaps: EligibilityGap[];
  matchReasonEn: string;
  matchReasonBn: string;
  missingSummaryEn: string;
  missingSummaryBn: string;
  verificationNoteEn: string | null;
  verificationNoteBn: string | null;
  checklist: ChecklistStep[];
}

export interface ProfileEvaluationSummary {
  isValidProfile: boolean;
  cgpaValue: number | null;
  validationErrorEn: string | null;
  validationErrorBn: string | null;
  eligible: EvaluatedScholarship[];
  nearMiss: EvaluatedScholarship[];
  allEvaluated: EvaluatedScholarship[];
  totalPotentialBdt: number;
  maxSingleAwardBdt: number;
}
