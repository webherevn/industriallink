import type { HomepageSolutionIcon, HomepageSolutionsContent } from '@industriallink/contracts';
import Link from 'next/link';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

function accentTitle(title: string, accent: string) {
  const needle = accent.trim();
  const at = needle ? title.indexOf(needle) : -1;
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="relative inline-block">
        {needle}
        <span className="absolute left-0 right-0 top-full mt-1.5 flex justify-center">
          <span className="home-reasons-mark block h-[3px] w-10 origin-center rounded-full bg-[#F08A24]" aria-hidden />
        </span>
      </span>
      {title.slice(at + needle.length)}
    </>
  );
}

function SolutionGlyph({ icon }: { icon: HomepageSolutionIcon }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (icon === 'target') {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
        <circle {...stroke} cx="24" cy="24" r="12" />
        <circle {...stroke} cx="24" cy="24" r="6.5" />
        <circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (icon === 'building') {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
        <path {...stroke} d="M14 36V17h13v19" />
        <path {...stroke} d="M27 36V22h8v14M12 36h25" />
        <path {...stroke} d="M18 21.5h3M23 21.5h3M18 26.5h3M23 26.5h3M30 26.5h3M30 31h3M19.5 36v-4h4v4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
      <path {...stroke} d="M16 12h11.5L34 18.5V34a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" />
      <path {...stroke} d="M27 12v7h7M19 24h8M19 29h6" />
    </svg>
  );
}

function ArrowButton({ href, label }: { href: string; label: string }) {
  const className =
    'absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-[#F08A24] text-white shadow-[0_8px_16px_-10px_rgba(240,138,36,0.9)] transition hover:bg-[#e07b16]';
  const icon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5 12h12M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={className} aria-label={label} target="_blank" rel="noreferrer">
        {icon}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {icon}
    </Link>
  );
}

export function HomeSolutions({ solutions }: { solutions: HomepageSolutionsContent }) {
  const items = solutions.items.filter((item) => item.title.trim());
  if (items.length === 0) return null;
  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-16 lg:py-20" aria-labelledby="home-solutions-title">
      <div className="mx-auto max-w-[1080px]">
        <div className="home-reasons-head text-center">
          <h2
            id="home-solutions-title"
            className="pb-3 text-[1.75rem] font-extrabold tracking-tight text-[#0c2f57] sm:text-[2.15rem]"
          >
            {accentTitle(solutions.title, solutions.titleAccent)}
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-[15px] leading-relaxed text-[#5c6b7d] sm:text-base">{solutions.subtitle}</p>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-3 lg:gap-6">
          {items.map((item, index) => {
            const image = resolveCmsAssetUrl(item.imageUrl);
            return (
              <li
                key={`${item.icon}-${index}`}
                className="home-reasons-item h-full"
                style={{ animationDelay: `${120 + index * 100}ms` }}
              >
                <article className="relative flex h-full flex-col rounded-[22px] border border-[#e6eef6] bg-white px-6 pb-16 pt-6 shadow-[0_16px_36px_-26px_rgba(18,49,92,0.55)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#F08A24]">
                      {image ? <img src={image} alt="" className="h-8 w-8 object-contain" /> : <SolutionGlyph icon={item.icon} />}
                    </span>
                    <h3 className="text-[1.15rem] font-extrabold tracking-tight text-[#12315c]">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-[#7d8b9a]">{item.description}</p>
                  <ul className="mt-5 space-y-2.5">
                    {item.points.filter((point) => point.trim()).map((point, pointIndex) => (
                      <li key={`${index}-${pointIndex}`} className="flex items-start gap-2.5 text-[14px] leading-snug text-[#3d4d60]">
                        <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#22a35a]" aria-hidden>
                          <path d="M4 10.2 8 14.2 16 6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <ArrowButton href={item.href} label={`Xem ${item.title}`} />
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
