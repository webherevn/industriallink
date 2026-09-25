import {
  EmploymentType,
  ExperienceBand,
  JD_SALES_FIELDS,
  JD_SALES_TOTAL_FIELDS,
  JobTrack,
  defaultDepartmentForTrack,
  emptyJobSalesCriteria,
  hasJobFitCriteria,
  normalizeJobSalesCriteria,
  type CreateJobRequest,
  type JdSalesFieldKey,
  type JobSalesCriteria,
  type JobView,
  type ParsedSalesJobDraft,
} from '@industriallink/contracts';

export type JdSalesFormState = {
  title: string;
  industries: string[];
  employmentType: EmploymentType | '';
  location: string;
  experienceBand: ExperienceBand | '';
  salaryMin: string;
  salaryMax: string;
  headcount: string;
  deadline: string;
  productsSold: string[];
  customerSegments: string[];
  dealTypes: string[];
  sellingStages: string[];
  marketsCovered: string[];
  educationLevel: string;
  educationMajor: string;
  languages: string[];
  driverLicenses: string[];
  travelAbility: string;
  description: string;
  requirements: string;
  skills: string;
  benefits: string;
  /** off = không lọc cứng ngành; near = S≥85; exact = S=100 */
  industryHardMode: 'off' | 'near' | 'exact';
};

export function emptyJdSalesForm(): JdSalesFormState {
  return {
    title: '',
    industries: [],
    employmentType: EmploymentType.FullTime,
    location: '',
    experienceBand: '',
    salaryMin: '',
    salaryMax: '',
    headcount: '',
    deadline: '',
    productsSold: [],
    customerSegments: [],
    dealTypes: [],
    sellingStages: [],
    marketsCovered: [],
    educationLevel: '',
    educationMajor: '',
    languages: [],
    driverLicenses: [],
    travelAbility: '',
    description: '',
    requirements: '',
    skills: '',
    benefits: '',
    industryHardMode: 'off',
  };
}

function money(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : '';
}

export function parsedJobToForm(parsed: ParsedSalesJobDraft): JdSalesFormState {
  return {
    title: parsed.title ?? '',
    industries: parsed.industries ?? [],
    employmentType: parsed.employmentType ?? EmploymentType.FullTime,
    location: parsed.location ?? '',
    experienceBand: parsed.experienceBand ?? '',
    salaryMin: money(parsed.salaryMin),
    salaryMax: money(parsed.salaryMax),
    headcount: parsed.headcount != null ? String(parsed.headcount) : '',
    deadline: parsed.deadline ?? '',
    productsSold: parsed.productsSold ?? [],
    customerSegments: parsed.customerSegments ?? [],
    dealTypes: parsed.dealTypes ?? [],
    sellingStages: parsed.sellingStages ?? [],
    marketsCovered: parsed.marketsCovered ?? [],
    educationLevel: parsed.educationLevel ?? '',
    educationMajor: parsed.educationMajor ?? '',
    languages: parsed.languages ?? [],
    driverLicenses: parsed.driverLicenses ?? [],
    travelAbility: parsed.travelAbility ?? '',
    description: parsed.description ?? '',
    requirements: parsed.requirements ?? '',
    skills: (parsed.skills ?? []).join(', '),
    benefits: parsed.benefits ?? '',
    industryHardMode: 'off',
  };
}

export function formToSalesCriteria(form: JdSalesFormState): JobSalesCriteria {
  return normalizeJobSalesCriteria({
    industries: form.industries,
    productsSold: form.productsSold,
    customerSegments: form.customerSegments,
    dealTypes: form.dealTypes,
    sellingStages: form.sellingStages,
    marketsCovered: form.marketsCovered,
    educationLevel: form.educationLevel || null,
    educationMajor: form.educationMajor || null,
    languages: form.languages,
    driverLicenses: form.driverLicenses,
    travelAbility: form.travelAbility || null,
    hardFilters: form.industryHardMode === 'off' ? [] : ['industries'],
    industryHardMinS: form.industryHardMode === 'exact' ? 100 : form.industryHardMode === 'near' ? 85 : undefined,
  });
}

export function jobViewToForm(job: JobView): JdSalesFormState {
  const c = job.salesCriteria ?? emptyJobSalesCriteria();
  const industries =
    c.industries.length > 0
      ? c.industries
      : job.industry
        ? [job.industry]
        : [];
  return {
    title: job.title,
    industries,
    employmentType: job.employmentType ?? EmploymentType.FullTime,
    location: job.location ?? '',
    experienceBand: (job.experienceBand as ExperienceBand) || '',
    salaryMin: money(job.salaryMin),
    salaryMax: money(job.salaryMax),
    headcount: job.headcount != null ? String(job.headcount) : '',
    deadline: job.deadline ?? '',
    productsSold: c.productsSold,
    customerSegments: c.customerSegments,
    dealTypes: c.dealTypes,
    sellingStages: c.sellingStages,
    marketsCovered: c.marketsCovered,
    educationLevel: c.educationLevel ?? '',
    educationMajor: c.educationMajor ?? '',
    languages: c.languages,
    driverLicenses: c.driverLicenses,
    travelAbility: c.travelAbility ?? '',
    description: job.description ?? '',
    requirements: job.requirements ?? '',
    skills: job.skills.map((s) => s.name).join(', '),
    benefits: job.benefits ?? '',
    industryHardMode: !c.hardFilters?.includes('industries')
      ? 'off'
      : c.industryHardMinS === 100
        ? 'exact'
        : 'near',
  };
}

export function formToCreateJobRequest(
  form: JdSalesFormState,
  publish: boolean,
): CreateJobRequest {
  const skills = form.skills
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, required: true }));

  return {
    title: form.title.trim(),
    description: form.description.trim() || '(Đang soạn mô tả)',
    requirements: form.requirements.trim() || undefined,
    benefits: form.benefits.trim() || undefined,
    industry: form.industries[0] || undefined,
    jobTrack: JobTrack.Sales,
    department: defaultDepartmentForTrack(JobTrack.Sales),
    employmentType: form.employmentType || undefined,
    location: form.location || undefined,
    headcount: form.headcount ? Number(form.headcount) : 1,
    deadline: form.deadline || undefined,
    experienceBand: form.experienceBand || undefined,
    salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
    salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
    skills,
    salesCriteria: formToSalesCriteria(form),
    publish,
  };
}

function isFilled(form: JdSalesFormState, key: JdSalesFieldKey): boolean {
  switch (key) {
    case 'title':
      return form.title.trim().length >= 3;
    case 'industries':
      return form.industries.length > 0;
    case 'employmentType':
      return Boolean(form.employmentType);
    case 'location':
      return form.location.trim().length > 0;
    case 'experienceBand':
      return Boolean(form.experienceBand);
    case 'salary':
      return Boolean(form.salaryMin || form.salaryMax);
    case 'headcount':
      return Boolean(form.headcount);
    case 'deadline':
      return Boolean(form.deadline);
    case 'productsSold':
      return form.productsSold.length > 0;
    case 'customerSegments':
      return form.customerSegments.length > 0;
    case 'dealTypes':
      return form.dealTypes.length > 0;
    case 'sellingStages':
      return form.sellingStages.length > 0;
    case 'marketsCovered':
      return form.marketsCovered.length > 0;
    case 'educationLevel':
      return Boolean(form.educationLevel);
    case 'educationMajor':
      return form.educationMajor.trim().length > 0;
    case 'languages':
      return form.languages.length > 0;
    case 'driverLicenses':
      return form.driverLicenses.length > 0;
    case 'travelAbility':
      return Boolean(form.travelAbility);
    case 'description':
      return form.description.trim().length >= 10;
    case 'requirements':
      return form.requirements.trim().length > 0;
    case 'skills':
      return form.skills.trim().length > 0;
    case 'benefits':
      return form.benefits.trim().length > 0;
    default:
      return false;
  }
}

export function countFilledJdFields(form: JdSalesFormState): {
  filled: number;
  total: number;
  percent: number;
  missing: { key: JdSalesFieldKey; label: string }[];
} {
  const missing: { key: JdSalesFieldKey; label: string }[] = [];
  let filled = 0;
  for (const field of JD_SALES_FIELDS) {
    if (isFilled(form, field.key)) filled += 1;
    else missing.push({ key: field.key, label: `${field.stt}. ${field.label}` });
  }
  return {
    filled,
    total: JD_SALES_TOTAL_FIELDS,
    percent: Math.round((filled / JD_SALES_TOTAL_FIELDS) * 100),
    missing,
  };
}

export function formHasJobFit(form: JdSalesFormState): boolean {
  return hasJobFitCriteria(formToSalesCriteria(form));
}
