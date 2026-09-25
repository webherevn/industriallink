import { EmploymentType, JobStatus } from './enums';
import { jobListingPath, jobPublicPath } from './public-job-path';

export interface JobPostingSource {
  id: string;
  slug: string;
  code: string;
  title: string;
  description: string;
  requirements?: string | null;
  benefits?: string | null;
  industry?: string | null;
  location?: string | null;
  employmentType?: EmploymentType | string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  deadline?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  status: JobStatus | string;
  companyName: string;
  companyWebsite?: string | null;
  companyAddress?: string | null;
  companyHasLogo?: boolean;
  companyId?: string;
  companySlug?: string | null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isHtml(input: string): boolean {
  return /<\/?(p|ul|ol|li|h3|strong|em|br)\b/i.test(input);
}

function linesToListOrParagraphs(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  if (lines.length > 1) {
    return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
  }
  return `<p>${escapeHtml(lines[0])}</p>`;
}

function sanitizeJobHtml(input: string): string {
  return input
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(div|span|section|article|header|footer)[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '');
}

/** Mô tả JobPosting: HTML hợp lệ p/ul/li/strong — không plain text. */
export function toJobPostingDescriptionHtml(job: {
  title: string;
  description: string;
  requirements?: string | null;
  benefits?: string | null;
}): string {
  const desc = job.description?.trim()
    ? isHtml(job.description)
      ? sanitizeJobHtml(job.description)
      : linesToListOrParagraphs(job.description)
    : `<p>Tuyển dụng vị trí <strong>${escapeHtml(job.title)}</strong>.</p>`;
  const req = job.requirements?.trim()
    ? `<h3>Yêu cầu:</h3>${
        isHtml(job.requirements) ? sanitizeJobHtml(job.requirements) : linesToListOrParagraphs(job.requirements)
      }`
    : '';
  const benefits = job.benefits?.trim()
    ? `<h3>Quyền lợi:</h3>${
        isHtml(job.benefits) ? sanitizeJobHtml(job.benefits) : linesToListOrParagraphs(job.benefits)
      }`
    : '';
  return `${desc}${req}${benefits}`;
}

export function jobValidThroughIso(job: {
  deadline?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}): string {
  if (job.deadline) {
    const d = job.deadline.includes('T') ? new Date(job.deadline) : new Date(`${job.deadline}T23:59:59.000Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const posted = new Date(job.publishedAt || job.createdAt);
  const end = Number.isNaN(posted.getTime()) ? new Date() : new Date(posted);
  end.setUTCDate(end.getUTCDate() + 30);
  end.setUTCHours(23, 59, 59, 0);
  return end.toISOString();
}

export function isJobExpiredForSeo(job: { status: string; deadline?: string | null }): boolean {
  if (job.status !== JobStatus.Published) return true;
  if (!job.deadline) return false;
  const end = job.deadline.includes('T') ? new Date(job.deadline) : new Date(`${job.deadline}T23:59:59.000Z`);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

function schemaEmploymentType(type?: string | null): string {
  switch (type) {
    case EmploymentType.PartTime:
      return 'PART_TIME';
    case EmploymentType.Contract:
      return 'CONTRACTOR';
    case EmploymentType.Internship:
      return 'INTERN';
    case EmploymentType.Seasonal:
      return 'TEMPORARY';
    default:
      return 'FULL_TIME';
  }
}

function absoluteHttpUrl(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw.trim();
  return `https://${raw.trim()}`;
}

function isRemoteLocation(location?: string | null): boolean {
  return /remote|từ xa|tu xa|work from home|wfh/i.test(location ?? '');
}

export function buildJobPostingJsonLd(
  job: JobPostingSource,
  opts: { siteUrl: string; logoUrl?: string | null },
): Record<string, unknown> {
  const site = opts.siteUrl.replace(/\/$/, '');
  const datePosted = (job.publishedAt || job.createdAt).slice(0, 10);
  const remote = isRemoteLocation(job.location);
  const locality = job.location?.trim() || 'Việt Nam';

  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: toJobPostingDescriptionHtml(job),
    identifier: {
      '@type': 'PropertyValue',
      name: job.companyName,
      value: job.code,
    },
    datePosted,
    validThrough: jobValidThroughIso(job),
    employmentType: schemaEmploymentType(job.employmentType),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
      ...(absoluteHttpUrl(job.companyWebsite)
        ? { sameAs: absoluteHttpUrl(job.companyWebsite) }
        : {}),
      ...(opts.logoUrl ? { logo: opts.logoUrl } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.companyAddress ? { streetAddress: job.companyAddress } : {}),
        addressLocality: locality,
        addressRegion: locality,
        addressCountry: 'VN',
      },
    },
    directApply: true,
    url: `${site}${jobPublicPath(job)}`,
  };

  if (remote) {
    payload.jobLocationType = 'TELECOMMUTE';
    payload.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'Vietnam',
    };
  }

  if (job.salaryMin != null || job.salaryMax != null) {
    const value: Record<string, unknown> = {
      '@type': 'QuantitativeValue',
      unitText: 'MONTH',
    };
    if (job.salaryMin != null && job.salaryMax != null && job.salaryMin !== job.salaryMax) {
      value.minValue = job.salaryMin;
      value.maxValue = job.salaryMax;
    } else {
      value.value = job.salaryMax ?? job.salaryMin;
    }
    payload.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'VND',
      value,
    };
  }

  return payload;
}

export function buildJobBreadcrumbJsonLd(
  job: { title: string; slug: string; industry?: string | null },
  siteUrl: string,
): Record<string, unknown> {
  const site = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: `${site}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Việc làm',
        item: `${site}${jobListingPath()}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: job.title,
        item: `${site}${jobPublicPath(job)}`,
      },
    ],
  };
}

export function buildJobListJsonLd(
  jobs: Array<{ title: string; slug: string; industry?: string | null }>,
  siteUrl: string,
): Record<string, unknown> {
  const site = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.slice(0, 20).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${site}${jobPublicPath(job)}`,
      name: job.title,
    })),
  };
}
