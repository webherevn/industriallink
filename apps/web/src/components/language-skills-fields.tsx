'use client';

import clsx from 'clsx';
import { useState } from 'react';
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_SKILL_LEVELS,
  LANGUAGE_WORK_USAGE_LABEL,
  emptyLanguageSkill,
  languageNamesFromSkills,
  languageWorkUsage,
  mergeLanguageSkills,
  type LanguageSkill,
  type LanguageSkillLevel,
} from '@industriallink/contracts';

const BASE_OPTIONS = LANGUAGE_OPTIONS.filter((o) => o !== 'Khác');

/**
 * STT 10 — Ngoại ngữ: chọn ngôn ngữ sử dụng trong công việc
 * + 1 mức độ sử dụng (Cơ bản / Khá / Tốt / Thành thạo). Có “Khác: ___”.
 */
export function LanguageSkillsFields({
  languages,
  languageSkills,
  onChange,
}: {
  languages: string[];
  languageSkills: LanguageSkill[];
  onChange: (next: { languages: string[]; languageSkills: LanguageSkill[] }) => void;
}) {
  const skills = mergeLanguageSkills(languages, languageSkills);
  const [otherText, setOtherText] = useState('');

  const customSkills = skills.filter(
    (s) => !(BASE_OPTIONS as readonly string[]).includes(s.language),
  );

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

  function addOther() {
    const name = otherText.trim();
    if (!name || skills.some((s) => s.language.toLowerCase() === name.toLowerCase())) {
      setOtherText('');
      return;
    }
    commit([...skills, emptyLanguageSkill(name)]);
    setOtherText('');
  }

  function patchUsage(language: string, value: LanguageSkillLevel | null) {
    commit(
      skills.map((s) =>
        s.language === language ? { ...s, workUsage: value } : s,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {BASE_OPTIONS.map((opt) => {
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
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-1.5 text-sm">
          <span className="shrink-0 text-slate-600">Khác:</span>
          <input
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOther();
              }
            }}
            placeholder="VD: Tiếng Đức…"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={addOther}
            disabled={!otherText.trim()}
            className="shrink-0 rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            Thêm
          </button>
        </div>
      </div>

      {skills.length > 0 && (
        <div className="space-y-2">
          {skills.map((skill) => {
            const isCustom = customSkills.some((s) => s.language === skill.language);
            return (
              <div
                key={skill.language}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
              >
                <p className="min-w-[7rem] text-sm font-semibold text-slate-800">
                  {skill.language}
                </p>
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                    {LANGUAGE_WORK_USAGE_LABEL}
                  </span>
                  <select
                    value={languageWorkUsage(skill) ?? ''}
                    onChange={(e) =>
                      patchUsage(
                        skill.language,
                        (e.target.value || null) as LanguageSkillLevel | null,
                      )
                    }
                    className="w-full min-w-[8rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                  >
                    <option value="">— Chọn mức —</option>
                    {LANGUAGE_SKILL_LEVELS.map((lv) => (
                      <option key={lv.value} value={lv.value}>
                        {lv.label}
                      </option>
                    ))}
                  </select>
                </label>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => toggleLanguage(skill.language, false)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    Xoá
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
