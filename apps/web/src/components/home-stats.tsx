import type { HomepageStatIcon, HomepageStatsContent } from '@industriallink/contracts';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

function StatGlyph({ icon }: { icon: HomepageStatIcon }) {
  if (icon === 'building') {
    return (
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M11 16.5A2.5 2.5 0 0 1 13.5 14h13A2.5 2.5 0 0 1 29 16.5V36H11V16.5Zm4 2.5h3.2v3.2H15V19Zm6.2 0H24v3.2h-2.8V19ZM15 25.2h3.2V28H15v-2.8Zm6.2 0H24V28h-2.8v-2.8ZM15 31h3.2v3.2H15V31Zm6.2 0H24v3.2h-2.8V31ZM29 22.5h8.2A1.8 1.8 0 0 1 39 24.3V36H29V22.5Zm2.4 2.6h2.2V27h-2.2v-1.9Zm4 0H37.6V27h-2.2v-1.9Zm-4 3.6h2.2v2.2h-2.2v-2.2Zm4 0H37.6v2.2h-2.2v-2.2Z"
        />
      </svg>
    );
  }
  if (icon === 'badge') {
    return (
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
        <circle cx="18" cy="15" r="5.4" fill="currentColor" />
        <path fill="currentColor" d="M7.5 35.5c1.2-6.6 5-9.8 11-9.8s9.8 3.2 11 9.8H7.5Z" />
        <circle cx="34" cy="30.5" r="8" fill="#fff" />
        <circle cx="34" cy="30.5" r="6.2" fill="currentColor" />
        <path
          d="M31.1 30.6 33.2 32.7 37.1 28.8"
          fill="none"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (icon === 'check') {
    return (
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
        <circle cx="24" cy="24" r="13" fill="currentColor" />
        <path
          d="M17.2 24.4 21.5 28.7 31 19.2"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
      <circle cx="18" cy="16" r="5.2" fill="currentColor" />
      <circle cx="31" cy="17.5" r="4.2" fill="currentColor" opacity="0.85" />
      <path fill="currentColor" d="M7.5 35.5c1.2-6.4 5.2-9.6 10.6-9.6 5.5 0 9.4 3.2 10.6 9.6H7.5Z" />
      <path fill="currentColor" opacity="0.85" d="M26 35.2c.7-4.2 3.2-6.6 6.4-6.6 3.3 0 5.6 2.3 6.4 6.6H26Z" />
    </svg>
  );
}

export function HomeStats({ stats }: { stats: HomepageStatsContent }) {
  const items = stats.items.filter((item) => item.value.trim() || item.label.trim());
  if (items.length === 0) return null;
  return (
    <section className="bg-[#f7fbfe] px-4 pb-14 pt-2 sm:px-6 sm:pb-16" aria-label="Số liệu inlink">
      <div className="home-reasons-head mx-auto max-w-[1120px] rounded-[28px] bg-white px-5 py-6 shadow-[0_16px_40px_-24px_rgba(18,49,92,0.45)] sm:rounded-full sm:px-8 sm:py-5 lg:px-10">
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {items.map((item, index) => {
            const image = resolveCmsAssetUrl(item.imageUrl);
            return (
              <li key={`${item.icon}-${index}`} className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-[#F08A24]">
                  {image ? (
                    <img src={image} alt="" className="h-9 w-9 object-contain" />
                  ) : (
                    <StatGlyph icon={item.icon} />
                  )}
                </span>
                <span className="min-w-0">
                  <strong
                    className={`block font-extrabold leading-tight tracking-tight text-[#12315c] ${
                      item.value.trim().length > 12 ? 'text-[1.05rem] sm:text-lg' : 'text-[1.35rem] sm:text-[1.55rem]'
                    }`}
                  >
                    {item.value}
                  </strong>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[#8b97a6]">{item.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
