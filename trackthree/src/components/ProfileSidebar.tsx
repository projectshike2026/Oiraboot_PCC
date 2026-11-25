import { Languages, Moon, RotateCcw, Sun, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import type {
  DepartmentCode,
  GenderOption,
  Language,
  StudentProfile,
  ThemeMode,
} from '../types/scholarship';
import { DEPARTMENTS, PROFILE_PRESETS, UI_COPY } from '../data/scholarshipsData';

interface ProfileSidebarProps {
  profile: StudentProfile;
  onChangeProfile: (next: StudentProfile) => void;
  validationError: string | null;
  cgpaValue: number | null;
  totalCatalogCount: number;
  lang: Language;
  theme: ThemeMode;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
}

export function ProfileSidebar({
  profile,
  onChangeProfile,
  validationError,
  cgpaValue,
  totalCatalogCount,
  lang,
  theme,
  onToggleLanguage,
  onToggleTheme,
}: ProfileSidebarProps) {
  const copy = UI_COPY[lang];

  const updateField = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => {
    onChangeProfile({ ...profile, [key]: value });
  };

  const sliderNumeric = cgpaValue !== null ? cgpaValue : 0;

  return (
    <aside
      aria-label="Student Eligibility Form and Controls"
      className="surface-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4 lg:h-full lg:overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <p className="text-[11px] font-semibold text-[var(--crimson)] leading-normal tracking-wide">
            {copy.profileEyebrow}
          </p>
          <h2 className="font-athens text-xl font-bold text-[var(--text-main)] leading-snug mt-0.5">
            {copy.profileHeading}
          </h2>
        </div>
        <span className="font-mono-tabular text-xs font-semibold text-[var(--text-muted)] shrink-0">
          {totalCatalogCount} CSV
        </span>
      </div>

      {/* CGPA Input + Precision Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="student-cgpa-input"
            className="text-xs font-semibold text-[var(--text-main)]"
          >
            {copy.cgpaLabel}
          </label>
          <span className="font-mono-tabular text-xs font-bold text-[var(--crimson)]">
            {cgpaValue !== null ? cgpaValue.toFixed(2) : '—'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            id="student-cgpa-input"
            type="number"
            inputMode="decimal"
            min="0"
            max="4"
            step="0.01"
            value={profile.cgpaInput}
            onChange={(e) => updateField('cgpaInput', e.target.value)}
            placeholder="e.g. 3.50"
            aria-invalid={Boolean(validationError)}
            className="field-input w-24 px-3 py-2 rounded-xl font-mono-tabular text-sm font-semibold shrink-0"
          />
          <input
            aria-label={copy.cgpaLabel}
            type="range"
            min="0"
            max="4"
            step="0.05"
            value={sliderNumeric}
            onChange={(e) => updateField('cgpaInput', Number(e.target.value).toFixed(2))}
            className="crimson-slider flex-1 min-w-0"
          />
        </div>

        {validationError && (
          <p
            role="alert"
            className="text-xs font-medium text-[var(--crimson)] leading-snug"
          >
            {validationError}
          </p>
        )}
      </div>

      {/* Department Selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[var(--text-main)]">
          {copy.departmentLabel}
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-1.5">
          {DEPARTMENTS.map((dept) => {
            const active = profile.department === dept.code;
            return (
              <button
                key={dept.code}
                type="button"
                aria-pressed={active}
                onClick={() => updateField('department', dept.code as DepartmentCode)}
                className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--crimson)] ${
                  active
                    ? 'bg-[var(--crimson)] text-white border-[var(--crimson)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-main)] border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                }`}
              >
                {lang === 'bn' ? dept.labelBn : dept.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Financial Support Toggle */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[var(--text-main)]">
          {copy.needLabel}
        </span>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { value: true, label: copy.needYes },
            { value: false, label: copy.needNo },
          ].map((opt) => {
            const active = profile.financialSupportNeeded === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                aria-pressed={active}
                onClick={() => updateField('financialSupportNeeded', opt.value)}
                className={`px-3 py-2 rounded-xl text-xs font-medium text-left border transition-colors whitespace-nowrap truncate focus-visible:outline-2 focus-visible:outline-[var(--crimson)] ${
                  active
                    ? 'bg-[var(--crimson-soft)] text-[var(--crimson)] border-[var(--crimson-border)] font-semibold'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:text-[var(--text-main)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gender Filter */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[var(--text-main)]">
          {copy.genderLabel}
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { value: 'Female', label: copy.genderFemale },
              { value: 'Male', label: copy.genderMale },
              { value: 'Any', label: copy.genderAny },
            ] as Array<{ value: GenderOption; label: string }>
          ).map((opt) => {
            const active = profile.gender === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => updateField('gender', opt.value)}
                className={`px-2 py-2 rounded-xl text-[11px] font-semibold border transition-colors whitespace-nowrap truncate focus-visible:outline-2 focus-visible:outline-[var(--crimson)] ${
                  active
                    ? 'bg-[var(--bg-inverse)] text-[var(--text-inverse)] border-[var(--bg-inverse)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-hairline)] hover:text-[var(--text-main)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[var(--crimson)]" />
            <span>{copy.presetsHeading}</span>
          </p>
          <button
            type="button"
            onClick={() => onChangeProfile(PROFILE_PRESETS[0].profile)}
            aria-label="Reset profile"
            className="text-[11px] text-[var(--text-faint)] hover:text-[var(--crimson)] flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {PROFILE_PRESETS.map((preset) => (
            <motion.button
              key={preset.id}
              type="button"
              whileTap={{ scale: 0.99 }}
              onClick={() => onChangeProfile(preset.profile)}
              className="w-full text-left px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--crimson)] text-xs font-medium text-[var(--text-main)] transition-colors truncate"
            >
              {lang === 'bn' ? preset.labelBn : preset.labelEn}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Footer Controls: Language & Theme */}
      <div className="mt-auto pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleLanguage}
          aria-label={lang === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}
          className="px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] text-xs font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Languages className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
          <span>{copy.langButton}</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="px-3 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] text-xs font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
        >
          {theme === 'light' ? (
            <Moon className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[var(--crimson)] shrink-0" />
          )}
          <span>{theme === 'light' ? copy.themeDark : copy.themeLight}</span>
        </button>
      </div>
    </aside>
  );
}
