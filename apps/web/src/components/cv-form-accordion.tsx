'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/** Các khối lớn trên trang tạo CV. Chỉ một khối mở tại một thời điểm. */
export type CvSectionKey = 'A' | 'B' | 'C' | 'D' | 'ref';

const CvAccordionContext = createContext<{
  open: CvSectionKey | null;
  toggle: (key: CvSectionKey) => void;
} | null>(null);

export function CvFormAccordion({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<CvSectionKey | null>('A');
  const toggle = useCallback((key: CvSectionKey) => {
    setOpen((prev) => (prev === key ? null : key));
  }, []);
  return <CvAccordionContext.Provider value={{ open, toggle }}>{children}</CvAccordionContext.Provider>;
}

/** Props cho MatrixSection. Ngoài trang tạo CV thì trả về rỗng, mỗi khối tự mở/đóng. */
export function useCvSectionProps(key: CvSectionKey) {
  const ctx = useContext(CvAccordionContext);
  if (!ctx) return {};
  return {
    accordionGroup: 'cv-create',
    controlledOpen: ctx.open === key,
    onToggle: () => ctx.toggle(key),
  };
}
