'use client';

import clsx from 'clsx';
import { Check, ChevronRight, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Mission = {
  id: string;
  title: string;
  body: string;
  href: string;
};

const MISSIONS: Mission[] = [
  {
    id: 'nav-overview',
    title: 'Bản đồ tổng quan',
    body: 'Đây là màn hình đầu tiên. Bạn thấy tin đang mở, ứng viên mới và việc cần xử lý hôm nay.',
    href: '/recruiter',
  },
  {
    id: 'nav-jd',
    title: 'Tạo tin JD',
    body: 'AI viết JD tách tin Kinh doanh hoặc Kỹ thuật thành tiêu chí, khác cách đăng mô tả thông thường. Trong trang tạo có hướng dẫn từng bước. Tin đã lưu nằm ở mục Tin tuyển dụng.',
    href: '/jobs/new',
  },
  {
    id: 'nav-inbox',
    title: 'Xem ứng viên',
    body: 'Hộp thư gom hồ sơ đã nộp vào tin của bạn. Mở một hồ sơ để xem mức phù hợp.',
    href: '/recruiter/inbox',
  },
  {
    id: 'nav-search',
    title: 'Tìm và kết nối',
    body: 'Tìm ứng viên AI gợi ý người khớp tin. Gửi yêu cầu kết nối. Khi họ chấp nhận, khung chat hiện ở góc dưới phải.',
    href: '/search',
  },
  {
    id: 'pipeline',
    title: 'Sàng lọc hồ sơ',
    body: 'Thanh này là đường đi của hồ sơ: Ứng tuyển, Sàng lọc, Phỏng vấn, Đề nghị, rồi Nhận việc. Bấm một bước để xem ai đang ở đó.',
    href: '/recruiter',
  },
  {
    id: 'nav-offer',
    title: 'Đề nghị làm việc',
    body: 'Khi đã chốt ứng viên, lập đề nghị tại đây. Ứng viên nhận thư và phản hồi trên nền tảng.',
    href: '/recruiter/offers',
  },
  {
    id: 'nav-hire',
    title: 'Nhận việc',
    body: 'Sau khi đề nghị được chấp nhận, theo dõi giấy tờ và ngày vào làm tại Nhận việc.',
    href: '/recruiter/onboarding',
  },
];

const STORAGE = 'inlink-ntd-guide';

type Save = { playing: boolean; step: number };

function readSave(): Save | null {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Save;
    if (!parsed || typeof parsed.step !== 'number') return null;
    return { playing: Boolean(parsed.playing), step: parsed.step };
  } catch {
    return null;
  }
}

function writeSave(save: Save | null) {
  try {
    if (!save) sessionStorage.removeItem(STORAGE);
    else sessionStorage.setItem(STORAGE, JSON.stringify(save));
  } catch {
    /* bỏ qua khi trình duyệt chặn storage */
  }
}

function placeCard(hole: Hole) {
  const cardW = 352;
  const gap = 16;
  const right = hole.left + hole.width + gap;
  if (right + cardW < window.innerWidth - 8) {
    return {
      top: Math.min(Math.max(16, hole.top), window.innerHeight - 280),
      left: right,
    };
  }
  const below = hole.top + hole.height + gap;
  if (below + 240 < window.innerHeight) {
    return {
      top: below,
      left: Math.max(16, Math.min(hole.left, window.innerWidth - cardW - 16)),
    };
  }
  return {
    top: Math.max(16, hole.top - 260),
    left: Math.max(16, window.innerWidth - cardW - 16),
  };
}

function samePlace(pathname: string, href: string) {
  if (href === '/recruiter') return pathname === '/recruiter';
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Hole = { top: number; left: number; width: number; height: number };

function findTarget(id: string) {
  const nodes = [...document.querySelectorAll<HTMLElement>(`[data-guide="${id}"]`)];
  return nodes.find((node) => node.getBoundingClientRect().width > 0) ?? null;
}

export function RecruiterGuide() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);

  const mission = MISSIONS[Math.min(step, MISSIONS.length - 1)];
  const last = step >= MISSIONS.length - 1;

  const close = useCallback(() => {
    setOpen(false);
    setPlaying(false);
    setHole(null);
    writeSave(null);
  }, []);

  const begin = useCallback((index = 0) => {
    setStep(index);
    setPlaying(true);
    setOpen(true);
    writeSave({ playing: true, step: index });
  }, []);

  useEffect(() => {
    const saved = readSave();
    if (saved?.playing) {
      setStep(Math.max(0, Math.min(saved.step, MISSIONS.length - 1)));
      setPlaying(true);
      setOpen(true);
    }
    const openBoard = () => {
      setPlaying(false);
      setHole(null);
      setOpen(true);
      writeSave(null);
    };
    window.addEventListener('inlink-open-guide', openBoard);
    return () => window.removeEventListener('inlink-open-guide', openBoard);
  }, []);

  useEffect(() => {
    if (!playing) return;
    writeSave({ playing: true, step });
    if (!samePlace(pathname, mission.href)) router.push(mission.href);
  }, [playing, step, pathname, mission.href, router]);

  useEffect(() => {
    if (!playing) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      if (window.innerWidth < 1024 && mission.id.startsWith('nav-')) {
        window.dispatchEvent(new Event('inlink-guide-open-nav'));
      }
      const node = findTarget(mission.id);
      if (!node) {
        setHole(null);
        return;
      }
      node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rect = node.getBoundingClientRect();
      if (rect.width < 8) {
        setHole(null);
        return;
      }
      setHole({
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      });
    };
    tick();
    const timer = window.setInterval(tick, 250);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [playing, mission.id, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const cardStyle = hole ? placeCard(hole) : undefined;

  return (
    <div className="fixed inset-0 z-[70]">
      {playing && hole ? (
        <svg className="pointer-events-auto absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <mask id="inlink-guide-hole">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(7,35,72,0.58)" mask="url(#inlink-guide-hole)" />
        </svg>
      ) : (
        <button
          type="button"
          className="absolute inset-0 bg-[#072348]/55"
          aria-label="Đóng hướng dẫn"
          onClick={close}
        />
      )}

      {playing ? (
        <div
          className="guide-pop absolute z-10 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-white p-4 shadow-[0_22px_50px_-20px_rgba(7,35,72,0.55)]"
          style={
            cardStyle
              ? { top: cardStyle.top, left: Math.min(cardStyle.left, window.innerWidth - 368) }
              : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E8872A]">
                Nhiệm vụ {step + 1}/{MISSIONS.length}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#072348]">{mission.title}</h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng hướng dẫn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#E8872A] transition-all"
              style={{ width: `${((step + 1) / MISSIONS.length) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{mission.body}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (step === 0 ? close() : setStep((n) => n - 1))}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              {step === 0 ? 'Thoát' : 'Quay lại'}
            </button>
            <button
              type="button"
              onClick={() => (last ? close() : setStep((n) => n + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-[#072348] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d3b80]"
            >
              {last ? 'Hoàn thành' : 'Tiếp theo'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="guide-pop absolute left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-24px_rgba(7,35,72,0.55)]">
          <div className="bg-[#072348] px-5 py-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Nhiệm vụ</p>
            <h2 className="mt-1 text-xl font-bold">Hướng dẫn tuyển dụng</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              Bảy bước, làm lần lượt. Inlink chỉ đúng chỗ để bạn tạo JD, xem ứng viên, kết nối, sàng lọc rồi nhận việc.
            </p>
          </div>
          <ol className="max-h-[46vh] space-y-1.5 overflow-y-auto px-4 py-4">
            {MISSIONS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => begin(index)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#072348] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{item.body}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              Để sau
            </button>
            <button
              type="button"
              onClick={() => begin(0)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8872A] px-4 py-2 text-sm font-bold text-white hover:bg-[#d9781f]"
            >
              <Check className="h-4 w-4" />
              Bắt đầu nhiệm vụ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
