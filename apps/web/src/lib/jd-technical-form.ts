import {
  ExperienceBand,
  JD_TECHNICAL_FIELDS,
  JD_TECHNICAL_TOTAL_FIELDS,
  JobTrack,
  defaultDepartmentForTrack,
  emptyJobTechnicalCriteria,
  hasTechnicalJobFitCriteria,
  normalizeJobTechnicalCriteria,
  type CreateJobRequest,
  type JdTechnicalFieldKey,
  type JobTechnicalCriteria,
  type JobView,
  type ParsedTechnicalJobDraft,
} from '@industriallink/contracts';

export type JdTechnicalFormState = {
  title: string;
  industries: string[];
  location: string;
  experienceBand: ExperienceBand | '';
  salaryMin: string;
  salaryMax: string;
  headcount: string;
  deadline: string;
  equipmentSystems: string[];
  workEnvironments: string[];
  technicalWorkTypes: string[];
  autonomyLevel: number | null;
  educationLevel: string;
  educationMajor: string;
  languages: string[];
  certificates: string[];
  driverLicenses: string[];
  travelAbility: string;
  shiftFlexibility: string;
  technicalTools: string[];
  documentLiteracy: string[];
  description: string;
  requirements: string;
  benefits: string;
};

export function emptyJdTechnicalForm(): JdTechnicalFormState {
  return {
    title: '',
    industries: [],
    location: '',
    experienceBand: '',
    salaryMin: '',
    salaryMax: '',
    headcount: '',
    deadline: '',
    equipmentSystems: [],
    workEnvironments: [],
    technicalWorkTypes: [],
    autonomyLevel: null,
    educationLevel: '',
    educationMajor: '',
    languages: [],
    certificates: [],
    driverLicenses: [],
    travelAbility: '',
    shiftFlexibility: '',
    technicalTools: [],
    documentLiteracy: [],
    description: '',
    requirements: '',
    benefits: '',
  };
}

function money(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : '';
}

export function parsedJobToTechnicalForm(parsed: ParsedTechnicalJobDraft): JdTechnicalFormState {
  return {
    title: parsed.title ?? '',
    industries: parsed.industries ?? [],
    location: parsed.location ?? '',
    experienceBand: parsed.experienceBand ?? '',
    salaryMin: money(parsed.salaryMin),
    salaryMax: money(parsed.salaryMax),
    headcount: parsed.headcount != null ? String(parsed.headcount) : '',
    deadline: parsed.deadline ?? '',
    equipmentSystems: parsed.equipmentSystems ?? [],
    workEnvironments: parsed.workEnvironments ?? [],
    technicalWorkTypes: parsed.technicalWorkTypes ?? [],
    autonomyLevel: parsed.autonomyLevel ?? null,
    educationLevel: parsed.educationLevel ?? '',
    educationMajor: parsed.educationMajor ?? '',
    languages: parsed.languages ?? [],
    certificates: parsed.certificates ?? [],
    driverLicenses: parsed.driverLicenses ?? [],
    travelAbility: parsed.travelAbility ?? '',
    shiftFlexibility: parsed.shiftFlexibility ?? '',
    technicalTools: parsed.technicalTools ?? [],
    documentLiteracy: parsed.documentLiteracy ?? [],
    description: parsed.description ?? '',
    requirements: parsed.requirements ?? '',
    benefits: parsed.benefits ?? '',
  };
}

export function formToTechnicalCriteria(form: JdTechnicalFormState): JobTechnicalCriteria {
  return normalizeJobTechnicalCriteria({
    industries: form.industries,
    equipmentSystems: form.equipmentSystems,
    workEnvironments: form.workEnvironments,
    technicalWorkTypes: form.technicalWorkTypes,
    autonomyLevel: form.autonomyLevel,
    educationLevel: form.educationLevel || null,
    educationMajor: form.educationMajor || null,
    languages: form.languages,
    certificates: form.certificates,
    driverLicenses: form.driverLicenses,
    travelAbility: form.travelAbility || null,
    shiftFlexibility: form.shiftFlexibility || null,
    technicalTools: form.technicalTools,
    documentLiteracy: form.documentLiteracy,
  });
}

export function jobViewToTechnicalForm(job: JobView): JdTechnicalFormState {
  const c = job.technicalCriteria ?? emptyJobTechnicalCriteria();
  const industries =
    c.industries.length > 0 ? c.industries : job.industry ? [job.industry] : [];
  return {
    title: job.title,
    industries,
    location: job.location ?? '',
    experienceBand: (job.experienceBand as ExperienceBand) || '',
    salaryMin: money(job.salaryMin),
    salaryMax: money(job.salaryMax),
    headcount: job.headcount != null ? String(job.headcount) : '',
    deadline: job.deadline ?? '',
    equipmentSystems: c.equipmentSystems,
    workEnvironments: c.workEnvironments,
    technicalWorkTypes: c.technicalWorkTypes,
    autonomyLevel: c.autonomyLevel,
    educationLevel: c.educationLevel ?? '',
    educationMajor: c.educationMajor ?? '',
    languages: c.languages,
    certificates: c.certificates,
    driverLicenses: c.driverLicenses,
    travelAbility: c.travelAbility ?? '',
    shiftFlexibility: c.shiftFlexibility ?? '',
    technicalTools: c.technicalTools,
    documentLiteracy: c.documentLiteracy,
    description: job.description ?? '',
    requirements: job.requirements ?? '',
    benefits: job.benefits ?? '',
  };
}

export function formToCreateTechnicalJobRequest(
  form: JdTechnicalFormState,
  publish: boolean,
): CreateJobRequest {
  return {
    title: form.title.trim(),
    description: form.description.trim() || '(Đang soạn mô tả)',
    requirements: form.requirements.trim() || undefined,
    benefits: form.benefits.trim() || undefined,
    industry: form.industries[0] || undefined,
    jobTrack: JobTrack.Technical,
    department: defaultDepartmentForTrack(JobTrack.Technical),
    location: form.location || undefined,
    headcount: form.headcount ? Number(form.headcount) : 1,
    deadline: form.deadline || undefined,
    experienceBand: form.experienceBand || undefined,
    salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
    salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
    technicalCriteria: formToTechnicalCriteria(form),
    publish,
  };
}

function isFilled(form: JdTechnicalFormState, key: JdTechnicalFieldKey): boolean {
  switch (key) {
    case 'title':
      return form.title.trim().length >= 3;
    case 'industries':
      return form.industries.length > 0;
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
    case 'equipmentSystems':
      return form.equipmentSystems.length > 0;
    case 'workEnvironments':
      return form.workEnvironments.length > 0;
    case 'technicalWorkTypes':
      return form.technicalWorkTypes.length > 0;
    case 'autonomyLevel':
      return form.autonomyLevel != null && form.autonomyLevel >= 1;
    case 'educationLevel':
      return Boolean(form.educationLevel);
    case 'educationMajor':
      return form.educationMajor.trim().length > 0;
    case 'languages':
      return form.languages.length > 0;
    case 'certificates':
      return form.certificates.length > 0;
    case 'driverLicenses':
      return form.driverLicenses.length > 0;
    case 'travelAbility':
      return Boolean(form.travelAbility);
    case 'shiftFlexibility':
      return Boolean(form.shiftFlexibility);
    case 'technicalTools':
      return form.technicalTools.length > 0;
    case 'documentLiteracy':
      return form.documentLiteracy.length > 0;
    case 'description':
      return form.description.trim().length >= 10;
    case 'requirements':
      return form.requirements.trim().length > 0;
    case 'benefits':
      return form.benefits.trim().length > 0;
    default:
      return false;
  }
}

export function countFilledJdTechnicalFields(form: JdTechnicalFormState): {
  filled: number;
  total: number;
  percent: number;
  missing: { key: JdTechnicalFieldKey; label: string }[];
} {
  const missing: { key: JdTechnicalFieldKey; label: string }[] = [];
  let filled = 0;
  for (const field of JD_TECHNICAL_FIELDS) {
    if (isFilled(form, field.key)) filled += 1;
    else missing.push({ key: field.key, label: `${field.stt}. ${field.label}` });
  }
  return {
    filled,
    total: JD_TECHNICAL_TOTAL_FIELDS,
    percent: Math.round((filled / JD_TECHNICAL_TOTAL_FIELDS) * 100),
    missing,
  };
}

export function formHasTechnicalJobFit(form: JdTechnicalFormState): boolean {
  return hasTechnicalJobFitCriteria(formToTechnicalCriteria(form));
}
