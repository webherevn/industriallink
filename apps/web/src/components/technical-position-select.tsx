'use client';

import { useState } from 'react';
import { TECHNICAL_DESIRED_POSITIONS, matchTechnicalPosition } from '@industriallink/contracts';
import { Input, Select } from '@/components/ui';

const OTHER = '__other__';

/** Ô chọn 1 trong 13 vị trí Kỹ thuật, hoặc «Khác» để tự nhập. */
export function TechnicalPositionSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder = '— Chọn vị trí —',
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const catalogHit = matchTechnicalPosition(value);
  const [otherPicked, setOtherMode] = useState(false);
  const otherMode = otherPicked || (Boolean(value.trim()) && !catalogHit);
  const selectValue = otherMode ? OTHER : (catalogHit ?? '');

  return (
    <div className={className}>
      <Select
        value={selectValue}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setOtherMode(true);
            onChange(catalogHit ? '' : value);
            return;
          }
          setOtherMode(false);
          onChange(v);
        }}
      >
        <option value="">{placeholder}</option>
        {TECHNICAL_DESIRED_POSITIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value={OTHER}>Khác — tự nhập</option>
      </Select>
      {otherMode ? (
        <Input
          className="mt-2"
          value={value}
          disabled={disabled}
          maxLength={120}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập tên vị trí"
        />
      ) : null}
    </div>
  );
}
