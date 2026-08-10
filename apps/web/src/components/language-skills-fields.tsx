'use client';

import clsx from 'clsx';
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_SKILL_DIMENSIONS,
  LANGUAGE_SKILL_LEVELS,
  emptyLanguageSkill,
  languageNamesFromSkills,
  mergeLanguageSkills,
  type LanguageSkill,
  type LanguageSkillLevel,
} from '@industriallink/contracts';

export function LanguageSkillsFields({
  languages,
  languageSkills,
  onChange,
  emphasizeTechnicalManual = true,
}: {
  languages: string[];
  languageSkills: LanguageSkill[];
  onChange: (next: { languages: string[]; languageSkills: LanguageSkill[] }) => void;
  /** Làm nổi bật cột đọc manual kỹ thuật. */
  emphasizeTechnicalManual?: boolean;
}) {
  const skills = mergeLanguageSkills(languages, languageSkills);

  function commit(nextSkills: LanguageSkill[]) {
    onChange({
      languageSkills: nextSkills,
      languages: languageNamesFromSkills(nextSkills),
    });
  }

  function toggleLanguage(name: string, checked: boolean) {
    if (checked) {
      if (skills.some((s) => s.language === name)) return;
      commit([...skills, emptyLanguageSkill(name)]);
      return;
    }
    commit(skills.filter((s) => s.language !== name));
  }

  function patchSkill(
    language: string,
    key: keyof Omit<LanguageSkill, 'language'>,
    value: LanguageSkillLevel | null,
  ) {
    commit(
      skills.map((s) => (s.language === language ? { ...s, [key]: value } : s)),
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {LANGUAGE_OPTIONS.map((opt) => {
          const checked = skills.some((s) => s.language === opt);
          return (
            <label
              key={opt}
              className={clsx(
                'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                checked
                  ? 'border-brand-300 bg-brand-50 text-brand-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                onChange={(e) => toggleLanguage(opt, e.target.checked)}
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>

      {skills.length > 0 && (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.language}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <p className="text-xs font-semibold text-slate-800">{skill.language}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LANGUAGE_SKILL_DIMENSIONS.map((dim) => {
                  const isManual = dim.key === 'technicalManualReading';
                  return (
                    <label
                      key={dim.key}
                      className={clsx(
                        'block rounded-lg border px-2.5 py-2',
                        isManual && emphasizeTechnicalManual
                          ? 'border-amber-200 bg-amber-50/60'
                          : 'border-transparent bg-white/80',
                      )}
                    >
                      <span
                        className={clsx(
                          'text-[11px] font-semibold',
                          isManual && emphasizeTechnicalManual
                            ? 'text-amber-800'
                            : 'text-slate-600',
                        )}
                      >
                        {dim.label}
                      </span>
                      <select
                        value={skill[dim.key] ?? ''}
                        onChange={(e) =>
                          patchSkill(
                            skill.language,
                            dim.key,
                            (e.target.value || null) as LanguageSkillLevel | null,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                      >
                        <option value="">— Chọn mức —</option>
                        {LANGUAGE_SKILL_LEVELS.map((lv) => (
                          <option key={lv.value} value={lv.value}>
                            {lv.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
