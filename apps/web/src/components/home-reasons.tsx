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
        <span
          className="home-reasons-mark absolute left-1/2 top-[calc(100%+2px)] h-[3px] w-9 origin-center rounded-full bg-[#F08A24]"
          aria-hidden
        />
      </span>
      {title.slice(at + needle.length)}
    </>
  );
}

function ReasonGlyph({ icon }: { icon: HomepageReasonIcon }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (icon === 'chart') {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
        <path {...stroke} d="M8 36h28" />
        <path {...stroke} d="M12 36V25" />
        <path {...stroke} d="M20 36V18" />
        <path {...stroke} d="M28 36V12" />
        <path {...stroke} d="M12 24.5 20 17.5 28 11" />
      </svg>
    );
  }
  if (icon === 'blocked') {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
        <circle {...stroke} cx="24" cy="24" r="11" />
        <path {...stroke} d="M16.2 31.8 31.8 16.2" />
      </svg>
    );
  }
  if (icon === 'chat') {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
        <path {...stroke} d="M11 16.5a5 5 0 0 1 5-5h9a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-5l-4.5 3.5V27.5h-.5a5 5 0 0 1-4-4.8v-6.2Z" />
        <path {...stroke} d="M22 22.5h10.5a4.5 4.5 0 0 1 4.5 4.5v5a4.5 4.5 0 0 1-4.5 4.5H30l-3.5 3v-3h-1.2" />
      </svg>
    );
  }
  if (icon === 'factory') {
    return (
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
        <path {...stroke} d="M7 36V19l7 4v-4l7 4V16h12v20" />
        <path {...stroke} d="M26 16V11h4" />
        <path {...stroke} d="M31 12c1.2-1.6 2.2-2.2 3.4-2.2" />
        <path {...stroke} d="M34.2 8.2c.7-.8 1.5-1.1 2.4-1" />
        <path {...stroke} d="M13 36v-5M18 36v-5M31 36v-5M35 36v-5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
      <circle {...stroke} cx="18" cy="16" r="5" />
      <path {...stroke} d="M8.5 33.5c.9-5.2 4-8 9.5-8s8.6 2.8 9.5 8" />
      <circle {...stroke} cx="31" cy="17.5" r="3.6" />
      <path {...stroke} d="M27.5 33.5c.5-3.4 2.2-5.4 5-5.4 2.6 0 4.2 1.6 4.8 4.6" />
    </svg>
  );
}

export function HomeReasons({ reasons }: { reasons: HomepageReasonsContent }) {
  const items = reasons.items.filter((item) => item.title.trim());
  return (
    <section
      className="bg-[radial-gradient(ellipse_90%_80%_at_50%_0%,#ffffff_0%,rgba(255,255,255,0)_58%),linear-gradient(180deg,#f8fbfe_0%,#eef4fa_100%)] py-14 sm:py-16 lg:py-20"
      aria-labelledby="home-reasons-title"
    >
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <div className="home-reasons-head text-center">
          <h2
            id="home-reasons-title"
            className="text-[1.85rem] font-extrabold tracking-tight text-[#0c2f57] sm:text-[2.35rem]"
          >
            {accentTitle(reasons.title, reasons.titleAccent)}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[#5c6b7d] sm:text-base">
            {reasons.subtitle}
          </p>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:mt-14 lg:grid-cols-5 lg:gap-6">
          {items.map((item, index) => {
            const image = resolveCmsAssetUrl(item.imageUrl);
            return (
              <li
                key={`${item.icon}-${index}`}
                className="home-reasons-item mx-auto w-full max-w-[240px] text-center sm:max-w-none"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span className="home-reasons-bubble mx-auto flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-[#1e4e8c] text-white shadow-[0_10px_18px_-14px_rgba(18,49,92,0.9)]">
                  {image ? (
                    <img src={image} alt="" className="home-reasons-glyph h-full w-full object-cover" />
                  ) : (
                    <span className="home-reasons-glyph inline-flex" style={{ animationDelay: `${index * 0.35}s` }}>
                      <ReasonGlyph icon={item.icon} />
                    </span>
                  )}
                </span>
                <h3 className="mx-auto mt-5 max-w-[11.5rem] text-balance text-[15px] font-bold leading-snug text-[#12315c]">
                  {item.title}
                </h3>
                <p className="mx-auto mt-2 max-w-[13.5rem] text-balance text-[13px] leading-relaxed text-[#7d8b9a]">
                  {item.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
