import type { HomepageReasonIcon, HomepageReasonsContent } from '@industriallink/contracts';
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
        <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-[#E8872A]" aria-hidden />
      </span>
      {title.slice(at + needle.length)}
    </>
  );
}

function ReasonGlyph({ icon }: { icon: HomepageReasonIcon }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-7 w-7',
    'aria-hidden': true,
  };
  if (icon === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19h16" />
        <path d="M7 16v-3" />
        <path d="M12 16V8" />
        <path d="M17 16v-6" />
      </svg>
    );
  }
  if (icon === 'blocked') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M7 17 17 7" />
      </svg>
    );
  }
  if (icon === 'chat') {
    return (
      <svg {...common}>
        <path d="M7 16.5 4.5 19V8.5A2.5 2.5 0 0 1 7 6h6.5A2.5 2.5 0 0 1 16 8.5V12" />
        <path d="M10 18.5h7.2L20 21v-6.2A2.3 2.3 0 0 0 17.7 12H12a2 2 0 0 0-2 2v4.5Z" />
      </svg>
    );
  }
  if (icon === 'factory') {
    return (
      <svg {...common}>
        <path d="M4 20V10l5 3V10l5 3V8h2.5L19 6v2h1v12" />
        <path d="M8 20v-3" />
        <path d="M12 20v-3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.8 18.2c.6-2.3 2.3-3.4 4.2-3.4s3.6 1.1 4.2 3.4" />
      <path d="M13.2 15.2c.8-.5 1.7-.8 2.7-.8 1.5 0 2.8.8 3.3 2.4" />
    </svg>
  );
}

export function HomeReasons({ reasons }: { reasons: HomepageReasonsContent }) {
  const items = reasons.items.filter((item) => item.title.trim());
  return (
    <section className="bg-[#F3F7FB] py-14 sm:py-16" aria-labelledby="home-reasons-title">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <h2 id="home-reasons-title" className="text-center text-[1.85rem] font-extrabold tracking-tight text-[#072348] sm:text-[2.15rem]">
          {accentTitle(reasons.title, reasons.titleAccent)}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-[15px] text-slate-600">{reasons.subtitle}</p>
        <ul className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {items.map((item) => {
            const image = resolveCmsAssetUrl(item.imageUrl);
            return (
              <li key={item.title} className="text-center">
                <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-[#12315c] text-white shadow-[0_10px_24px_-16px_rgba(7,35,72,0.8)]">
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ReasonGlyph icon={item.icon} />
                  )}
                </span>
                <p className="mt-4 text-[15px] font-bold leading-snug text-[#072348]">{item.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{item.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
