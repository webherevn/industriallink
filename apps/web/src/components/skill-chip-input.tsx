'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

interface SkillChipInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SkillChipInput({
  value,
  onChange,
  placeholder = 'Gõ kỹ năng, nhấn Enter hoặc dấu phẩy để thêm',
  disabled = false,
}: SkillChipInputProps) {
  const skills = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    // Avoid duplicates (case-insensitive)
    if (skills.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...skills, v].join(','));
    setInput('');
  };

  const remove = (idx: number) => {
    const next = skills.filter((_, i) => i !== idx);
    onChange(next.join(','));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && input === '' && skills.length > 0) {
      remove(skills.length - 1);
    }
  };

  return (
    <div
      className={
        'flex min-h-[42px] flex-wrap gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 ' +
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 ' +
        (disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text')
      }
      onClick={() => {
        if (!disabled) document.getElementById('skill-chip-input-field')?.focus();
      }}
    >
      {skills.map((skill, idx) => (
        <span
          key={`${skill}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-800"
        >
          {skill}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(idx);
              }}
              className="ml-0.5 rounded-full p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
              aria-label={`Xoá ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <input
        id="skill-chip-input-field"
        className="min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        value={input}
        onChange={(e) => {
          // If user typed a comma, split and add
          if (e.target.value.endsWith(',')) {
            add(e.target.value.slice(0, -1));
          } else {
            setInput(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) add(input);
        }}
        placeholder={skills.length === 0 ? placeholder : ''}
        disabled={disabled}
      />
    </div>
  );
}
