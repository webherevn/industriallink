import type { CvSectionKey } from '@/components/cv-form-accordion';

/** Ô địa chỉ dùng chung cho tỉnh và xã/phường. */
const ANCHOR_ALIAS: Record<string, string> = {
  ward: 'location',
};

export function criteriaAnchorId(key: string) {
  return `criteria-${ANCHOR_ALIAS[key] ?? key}`;
}

type SectionSpec = CvSectionKey | { sales: CvSectionKey; technical: CvSectionKey };

type Spec = {
  profileStep: number;
  section: SectionSpec;
  /** true = khối chuyên sâu đang đóng. 'sales' = chỉ Kinh doanh nằm trong khối đó. */
  deep?: boolean | 'sales';
};

const PLACES: Record<string, Spec> = {
  fullName: { profileStep: 1, section: 'A' },
  birthYear: { profileStep: 1, section: 'A' },
  phone: { profileStep: 1, section: 'A' },
  email: { profileStep: 1, section: 'A' },
  location: { profileStep: 1, section: 'A' },
  ward: { profileStep: 1, section: 'A' },
  educationLevel: { profileStep: 1, section: 'A' },
  education: { profileStep: 1, section: 'A' },
  educationMajor: { profileStep: 1, section: 'A' },
  certificates: { profileStep: 1, section: 'A' },
  languages: { profileStep: 1, section: 'A' },
  driversLicense: { profileStep: 1, section: 'A' },
  travel: { profileStep: 1, section: 'A' },
  desiredPositions: { profileStep: 3, section: 'B' },
  desiredLocations: { profileStep: 3, section: 'B' },
  expectedSalary: { profileStep: 3, section: 'B' },
  availability: { profileStep: 3, section: 'B' },
  careerOrientations: { profileStep: 3, section: 'B' },
  shiftFlexibility: { profileStep: 4, section: 'C' },
  technicalTools: { profileStep: 4, section: 'C' },
  documentLiteracy: { profileStep: 4, section: 'C' },
  experience: { profileStep: 5, section: { sales: 'C', technical: 'D' } },
  experienceRole: { profileStep: 5, section: { sales: 'C', technical: 'D' } },
  experiencePeriod: { profileStep: 5, section: { sales: 'C', technical: 'D' } },
  industries: { profileStep: 5, section: { sales: 'C', technical: 'D' } },
  products: { profileStep: 5, section: { sales: 'C', technical: 'D' } },
  segments: { profileStep: 5, section: { sales: 'C', technical: 'D' } },
  dealType: { profileStep: 5, section: 'C' },
  sellingStages: { profileStep: 5, section: 'C' },
  brands: { profileStep: 5, section: 'C', deep: true },
  markets: { profileStep: 5, section: 'C', deep: true },
  revenue: { profileStep: 5, section: 'C', deep: true },
  kpi: { profileStep: 5, section: 'C', deep: true },
  newCustomerRatio: { profileStep: 5, section: 'C', deep: true },
  dealValue: { profileStep: 5, section: 'C', deep: true },
  salesHighlights: { profileStep: 5, section: { sales: 'C', technical: 'D' }, deep: 'sales' },
  technicalWorkTypes: { profileStep: 5, section: 'D' },
  technicalAutonomyLevel: { profileStep: 5, section: 'D' },
};

export function criteriaPlace(key: string, track?: string | null) {
  const spec = PLACES[key] ?? { profileStep: 1, section: 'A' as const };
  const technical = track === 'technical';
  const cvSection =
    typeof spec.section === 'string'
      ? spec.section
      : technical
        ? spec.section.technical
        : spec.section.sales;
  const deep = spec.deep === 'sales' ? !technical : Boolean(spec.deep);
  return { profileStep: spec.profileStep, cvSection, deep };
}

/** Cuộn tới ô tiêu chí sau khi bước / khối đã mở. Thử lại vì ô nằm trong phần đang đóng. */
export function scrollToCriteria(key: string) {
  const id = criteriaAnchorId(key);
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (tries++ < 16) window.setTimeout(tick, 80);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderRadius = '12px';
    el.style.boxShadow = '0 0 0 3px rgba(30, 70, 224, 0.35)';
    window.setTimeout(() => {
      if (el.style.boxShadow.includes('30, 70, 224')) el.style.boxShadow = '';
    }, 1600);
    el.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true });
  };
  window.setTimeout(tick, 40);
}
