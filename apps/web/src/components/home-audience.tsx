import type { HomepageAudienceContent } from '@industriallink/contracts';
import Link from 'next/link';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(-2).map((part) => part[0] ?? '').join('');
  return letters.toUpperCase() || 'IL';
}

function ScoreRing({ score }: { score: string }) {
  const value = Number(score.replace('%', '').replace(',', '.'));
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const radius = 16;
  const length = 2 * Math.PI * radius;
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#e7f6ec" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#3dcb6c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - percent / 100)}
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold text-[#2faf5a]">{score}</span>
    </span>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  const className =
    'inline-flex items-center gap-2 rounded-full bg-[#F08A24] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(240,138,36,0.95)] transition hover:bg-[#e07b16]';
  const icon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5 12h12M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {label}
        {icon}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
      {icon}
    </Link>
  );
}

function PortraitFallback() {
  return (
    <svg viewBox="0 0 640 720" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="home-audience-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d5e6f6" />
          <stop offset="100%" stopColor="#eef5fb" />
        </linearGradient>
      </defs>
      <rect width="640" height="720" fill="url(#home-audience-sky)" />
      <g opacity="0.35" stroke="#9bb6d4" fill="none">
        <path d="M40 80h80v120H40zM140 80h80v120h-80zM240 80h80v120h-80zM340 80h80v120h-80z" />
        <path d="M40 220h80v120H40zM140 220h80v120h-80zM240 220h80v120h-80z" />
      </g>
      <ellipse cx="250" cy="640" rx="150" ry="28" fill="#c5d7ea" />
      <path d="M168 390c8-78 48-118 92-118s84 40 92 118v150H168V390Z" fill="#1e4e8c" />
      <path d="M196 430h28v18h-28zM250 430h28v18h-28z" fill="#d7e6f5" />
      <circle cx="260" cy="250" r="62" fill="#f3c7a8" />
      <path d="M210 240c8-48 34-74 62-74 30 0 54 24 60 70-16 10-34 16-60 16s-48-6-62-12Z" fill="#1a1a1a" />
      <path d="M232 258c8 6 16 8 26 8M292 258c-8 6-16 8-26 8" stroke="#c48b6a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M240 286c8 10 20 14 32 10" stroke="#c48b6a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="300" y="470" width="54" height="92" rx="8" fill="#12315c" transform="rotate(18 327 516)" />
      <rect x="308" y="482" width="38" height="62" rx="4" fill="#dbe8f6" transform="rotate(18 327 513)" />
    </svg>
  );
}

export function HomeAudience({ audience }: { audience: HomepageAudienceContent }) {
  const photo = resolveCmsAssetUrl(audience.imageUrl);
  return (
    <section className="bg-[#f4f8fc] px-4 py-14 sm:px-6 sm:py-16 lg:py-20" aria-labelledby="home-audience-title">
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
        <div className="home-reasons-head">
          <h2 id="home-audience-title" className="text-[1.85rem] font-extrabold leading-tight tracking-tight text-[#0c2f57] sm:text-[2.2rem]">
            <span className="block">{audience.kicker}</span>
            <span className="mt-1 block">{audience.title}</span>
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#5c6b7d]">{audience.subtitle}</p>
          <div className="mt-6">
            <ActionLink href={audience.ctaHref} label={audience.ctaLabel} />
          </div>
          <ul className="mt-6 space-y-2.5">
            {audience.points.filter((point) => point.trim()).map((point, index) => (
              <li key={`${index}-${point}`} className="flex items-start gap-2.5 text-[14px] leading-snug text-[#3d4d60]">
                <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#22a35a]" aria-hidden>
                  <path d="M4 10.2 8 14.2 16 6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
          <div className="overflow-hidden rounded-[28px] bg-[#e7f1fa] lg:ml-10 lg:h-[500px]">
            {photo ? (
              <img src={photo} alt="" className="h-72 w-full object-cover object-[center_18%] sm:h-96 lg:h-full" />
            ) : (
              <div className="h-72 sm:h-96 lg:h-full">
                <PortraitFallback />
              </div>
            )}
          </div>
          <aside className="relative z-10 -mt-16 ml-auto mr-3 w-[min(100%-1.5rem,320px)] rounded-[22px] bg-white p-4 shadow-[0_18px_40px_-24px_rgba(18,49,92,0.55)] sm:mr-0 sm:p-5 lg:absolute lg:right-0 lg:top-8 lg:mt-0 lg:w-[300px]">
            <p className="text-[13px] font-semibold text-[#7d8b9a]">{audience.cardTitle}</p>
            <ul className="mt-3 divide-y divide-[#eef2f6]">
              {audience.jobs.map((job, index) => {
                const avatar = resolveCmsAssetUrl(job.avatarUrl);
                return (
                  <li key={`${job.title}-${index}`} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                    {avatar ? (
                      <img src={avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eef6] text-[11px] font-bold text-[#072348]">
                        {initials(job.title)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold leading-snug text-[#12315c]">{job.title}</span>
                      <span className="block truncate text-[12px] text-[#8b97a6]">{job.company}</span>
                      <span className="block truncate text-[12px] text-[#8b97a6]">{job.location}</span>
                    </span>
                    <ScoreRing score={job.score} />
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
