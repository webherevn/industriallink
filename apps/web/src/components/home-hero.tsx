import type { HomepageHeroContent, HomepageHeroJob, HomepageHeroPerson } from '@industriallink/contracts';
import { ArrowRight, Building2, MapPin, UserRound } from 'lucide-react';
import Link from 'next/link';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

function accentTitle(title: string, accent: string) {
  return title.split('\n').map((line, index) => {
    const needle = accent.trim();
    const at = needle ? line.indexOf(needle) : -1;
    return (
      <span key={`${index}-${line}`} className="block">
        {at < 0 ? (
          line || '\u00a0'
        ) : (
          <>
            {line.slice(0, at)}
            <span className="text-[#E8872A]">{needle}</span>
            {line.slice(at + needle.length)}
          </>
        )}
      </span>
    );
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(-2).map((part) => part[0] ?? '').join('');
  return letters.toUpperCase() || 'IL';
}

function Portrait({ url, name, className }: { url: string; name: string; className: string }) {
  const src = resolveCmsAssetUrl(url);
  if (src) {
    return <img src={src} alt="" className={`${className} object-cover`} />;
  }
  return (
    <span className={`${className} items-center justify-center bg-[#E8EEF6] text-[10px] font-bold text-[#072348]`}>
      {initials(name)}
    </span>
  );
}

function PersonRow({ person, featured }: { person: HomepageHeroPerson; featured?: boolean }) {
  const lines = person.detail.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <div className={featured ? '' : 'flex items-center gap-2.5'}>
      <div className={featured ? 'flex items-start gap-3' : 'contents'}>
        <Portrait
          url={person.avatarUrl}
          name={person.name}
          className={
            featured
              ? 'flex h-11 w-11 shrink-0 rounded-full'
              : 'flex h-8 w-8 shrink-0 rounded-full'
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={featured ? 'text-sm font-bold text-[#072348]' : 'truncate text-[13px] font-semibold text-[#072348]'}>
              {person.name}
            </p>
            {person.score ? (
              <p className={featured ? 'text-2xl font-bold leading-none text-emerald-500' : 'text-sm font-bold text-emerald-500'}>
                {person.score}
              </p>
            ) : null}
          </div>
          {lines.map((line) => (
            <p key={line} className="text-[12px] leading-4 text-slate-500">
              {line}
            </p>
          ))}
        </div>
      </div>
      {person.tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {person.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function JobRow({ job, featured }: { job: HomepageHeroJob; featured?: boolean }) {
  const src = resolveCmsAssetUrl(job.iconUrl);
  const icon = src ? (
    <img src={src} alt="" className={featured ? 'h-10 w-10 rounded-xl object-cover' : 'h-8 w-8 rounded-lg object-cover'} />
  ) : (
    <span
      className={
        featured
          ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8EEF6] text-[#072348]'
          : 'flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8EEF6] text-[#072348]'
      }
    >
      <Building2 className={featured ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </span>
  );
  return (
    <div>
      <div className="flex items-start gap-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={featured ? 'text-sm font-bold leading-5 text-[#072348]' : 'truncate text-[13px] font-semibold text-[#072348]'}>
              {job.title}
            </p>
            {job.score ? (
              <p className={featured ? 'text-2xl font-bold leading-none text-emerald-500' : 'shrink-0 text-sm font-bold text-emerald-500'}>
                {job.score}
              </p>
            ) : null}
          </div>
          {job.company ? <p className="text-[12px] text-slate-500">{job.company}</p> : null}
          {job.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-500">
              <MapPin className="h-3 w-3 text-[#E8872A]" />
              {job.location}
            </p>
          ) : null}
        </div>
      </div>
      {job.tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-12">
          {job.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomeHero({ hero }: { hero: HomepageHeroContent }) {
  const image = resolveCmsAssetUrl(hero.imageUrl);
  const people = hero.candidates.filter((person) => person.name.trim());
  const jobs = hero.jobs.filter((job) => job.title.trim());
  const [leadPerson, ...morePeople] = people;
  const [leadJob, ...moreJobs] = jobs;

  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-2 lg:py-6">
        <div className="max-w-[540px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#16325c]">
            {hero.eyebrow}
          </p>
          <span className="mt-2 block h-1 w-10 rounded-full bg-[#E8872A]" aria-hidden />
          <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.12] tracking-tight text-[#072348] sm:text-[2.7rem] lg:text-[3.05rem]">
            {accentTitle(hero.title, hero.titleAccent)}
          </h1>
          <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed text-slate-600">{hero.subtitle}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={hero.primaryHref}
              className="inline-flex min-h-[64px] min-w-[210px] flex-col justify-center rounded-2xl bg-[#E8872A] px-5 py-3 text-white shadow-[0_12px_24px_-12px_rgba(232,135,42,0.9)] transition hover:bg-[#d06f18]"
            >
              <span className="flex items-center gap-2 text-[15px] font-bold">
                {hero.primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-medium text-white/85">{hero.primaryHint}</span>
            </Link>
            <Link
              href={hero.secondaryHref}
              className="inline-flex min-h-[64px] min-w-[210px] flex-col justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[#072348] shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="text-[15px] font-bold">{hero.secondaryLabel}</span>
              <span className="text-[12px] font-medium text-slate-500">{hero.secondaryHint}</span>
            </Link>
          </div>
        </div>

        <div className="relative min-h-[280px] lg:min-h-[540px]">
          {image ? (
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#d7e6f6,transparent_55%),linear-gradient(180deg,#eef4fb,#f7fafc)]" />
          )}
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-white to-transparent lg:block" />
          <div className="relative grid gap-3 p-3 sm:grid-cols-2 lg:absolute lg:inset-x-2 lg:bottom-3 lg:p-0">
            {leadPerson ? (
              <article className="rounded-2xl bg-white p-3.5 shadow-[0_16px_40px_-20px_rgba(7,35,72,0.45)] ring-1 ring-slate-100">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#072348]">
                  <UserRound className="h-4 w-4 text-[#3b6ea5]" />
                  {hero.candidatesTitle}
                </p>
                <PersonRow person={leadPerson} featured />
                {morePeople.length > 0 ? (
                  <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                    {morePeople.map((person) => (
                      <PersonRow key={person.name} person={person} />
                    ))}
                  </div>
                ) : null}
              </article>
            ) : null}
            {leadJob ? (
              <article className="rounded-2xl bg-white p-3.5 shadow-[0_16px_40px_-20px_rgba(7,35,72,0.45)] ring-1 ring-slate-100">
                <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#072348]">
                  <Building2 className="h-4 w-4 text-[#3b6ea5]" />
                  {hero.jobsTitle}
                </p>
                <JobRow job={leadJob} featured />
                {moreJobs.length > 0 ? (
                  <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                    {moreJobs.map((job) => (
                      <JobRow key={job.title} job={job} />
                    ))}
                  </div>
                ) : null}
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
