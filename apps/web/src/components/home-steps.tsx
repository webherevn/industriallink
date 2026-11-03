import type { HomepageStepIcon, HomepageStepsContent } from '@industriallink/contracts';
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

function StepGlyph({ icon }: { icon: HomepageStepIcon }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (icon === 'list') {
    return (
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
        <circle cx="15" cy="16" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="15" cy="24" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="15" cy="32" r="1.7" fill="currentColor" stroke="none" />
        <path {...stroke} d="M20 16h13M20 24h13M20 32h13" />
      </svg>
    );
  }
  if (icon === 'link') {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
        <path {...stroke} d="M10 13a5 5 0 0 0 7.54.54l1.9-1.9a5 5 0 0 0-7.07-7.07l-1.1 1.1" />
        <path {...stroke} d="M14 11a5 5 0 0 0-7.54-.54l-1.9 1.9a5 5 0 0 0 7.07 7.07l1.1-1.1" />
      </svg>
    );
  }
  if (icon === 'chat') {
    return (
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
        <path {...stroke} d="M13 18a5 5 0 0 1 5-5h11a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-6l-5 3.5V30h-5a5 5 0 0 1-5-5v-7Z" />
        <path {...stroke} d="M19 21.5h8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
      <path {...stroke} d="M16 12h11.2L34 18.8V34a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" />
      <path {...stroke} d="M27 12v7h7M19 24h8M19 29h5" />
    </svg>
  );
}

function StepArrow() {
  return (
    <svg viewBox="0 0 36 16" className="h-4 w-9 text-[#F08A24]" aria-hidden>
      <path d="M0 8h28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 3.5 31 8l-7 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeSteps({ steps }: { steps: HomepageStepsContent }) {
  const items = steps.items.filter((item) => item.title.trim());
  return (
    <section
      className="bg-[linear-gradient(180deg,#f7fbfe_0%,#ffffff_40%,#f4f8fc_100%)] py-14 sm:py-16 lg:py-20"
      aria-labelledby="home-steps-title"
    >
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6">
        <div className="home-reasons-head text-center">
          <h2
            id="home-steps-title"
            className="pb-3 text-[1.75rem] font-extrabold tracking-tight text-[#0c2f57] sm:text-[2.15rem]"
          >
            {accentTitle(steps.title, steps.titleAccent)}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] text-[#5c6b7d] sm:text-base">{steps.subtitle}</p>
        </div>
        <ol className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:mt-14 lg:grid-cols-4 lg:gap-6">
          {items.map((item, index) => {
            const image = resolveCmsAssetUrl(item.imageUrl);
            return (
              <li
                key={`${item.icon}-${index}`}
                className="home-reasons-item relative mx-auto w-full max-w-[240px] text-center sm:max-w-none"
                style={{ animationDelay: `${140 + index * 110}ms` }}
              >
                {index < items.length - 1 ? (
                  <span className="pointer-events-none absolute left-[calc(100%+2px)] top-11 hidden -translate-y-1/2 lg:block" aria-hidden>
                    <StepArrow />
                  </span>
                ) : null}
                <span className="relative mx-auto inline-flex">
                  <span className="home-steps-bubble flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full bg-[#eef3f8] text-[#1e4e8c] shadow-[0_10px_22px_-16px_rgba(18,49,92,0.65)]">
                    {image ? (
                      <img src={image} alt="" className="home-reasons-glyph h-full w-full object-cover" />
                    ) : (
                      <span className="home-reasons-glyph inline-flex" style={{ animationDelay: `${index * 0.4}s` }}>
                        <StepGlyph icon={item.icon} />
                      </span>
                    )}
                  </span>
                  <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#F08A24] text-[13px] font-bold text-white shadow-sm">
                    {index + 1}
                  </span>
                </span>
                <h3 className="mx-auto mt-5 max-w-[12rem] text-balance text-[15px] font-bold leading-snug text-[#12315c]">
                  {item.title}
                </h3>
                <p className="mx-auto mt-2 max-w-[15rem] text-balance text-[13px] leading-relaxed text-[#7d8b9a]">
                  {item.description}
                </p>
                {index < items.length - 1 ? (
                  <span className="mt-8 flex justify-center sm:hidden" aria-hidden>
                    <span className="rotate-90">
                      <StepArrow />
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
