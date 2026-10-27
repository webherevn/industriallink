'use client';

import clsx from 'clsx';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type TrackKind = 'sales' | 'technical';

type Beat = {
  id: string;
  step: 1 | 2 | 3;
  title: string;
  body: string;
};

const SEEN_KEY = 'inlink-jd-guide-seen';
const PLAY_KEY = 'inlink-jd-guide';

function beatsFor(track: TrackKind): Beat[] {
  const count = track === 'sales' ? 22 : 23;
  const name = track === 'sales' ? 'Kinh doanh' : 'Kỹ thuật';
  const groupB =
    track === 'sales'
      ? 'Nhóm B là sản phẩm, khách hàng, loại hình và thị trường — phần dùng để chấm mức phù hợp. Nhóm C chỉ điền khi JD yêu cầu học vấn, ngoại ngữ, bằng lái hoặc đi công tác.'
      : 'Nhóm B là thiết bị, môi trường làm việc, loại việc kỹ thuật và mức tự chủ — phần dùng để chấm mức phù hợp. Nhóm C chỉ điền khi JD yêu cầu học vấn, chứng chỉ, bằng lái, công tác hoặc tài liệu kỹ thuật.';
  return [
    {
      id: 'jd-track',
      step: 1,
      title: 'Chọn đúng lĩnh vực',
      body: `inlink không đăng một bài mô tả chung như trang tuyển dụng khác. Tin ${name} dùng ma trận ${count} tiêu chí để so với hồ sơ. Đổi lĩnh vực nếu vị trí không thuộc nhóm này.`,
    },
    {
      id: 'jd-steps',
      step: 1,
      title: 'Ba bước, không viết tin từ đầu',
      body: 'Nguồn JD, rồi xác nhận từng tiêu chí, rồi xem trước và đăng. AI điền giúp. Bạn kiểm tra lại. Có thể bấm về từng bước.',
    },
    {
      id: 'jd-source',
      step: 1,
      title: 'Đưa JD bạn đang có',
      body: 'Kéo file PDF hoặc Word, hoặc dán nội dung tin cũ. AI chỉ lấy điều JD đã viết, không tự thêm sản phẩm, khách hàng hay thị trường. Chưa có nội dung thì dùng mẫu, hoặc bỏ qua để điền tay.',
    },
    {
      id: 'jd-ai',
      step: 1,
      title: `AI điền ${count} trường`,
      body: `Bấm nút này khi đã có nội dung. AI tách vị trí, địa điểm, kinh nghiệm và các tiêu chí ${name}, rồi chuyển sang bước xác nhận. Chỗ chưa chắc sẽ gắn nhãn Cần xác nhận.`,
    },
    {
      id: 'jd-form',
      step: 2,
      title: 'Xác nhận ma trận',
      body: `Nhóm A là thông tin tin. ${groupB} Nhóm D giữ mô tả, yêu cầu và quyền lợi. Cấp bậc chỉ để lọc, không tính điểm matching.`,
    },
    {
      id: 'jd-progress',
      step: 2,
      title: 'Tiến độ tiêu chí',
      body: 'Thẻ này đếm tiêu chí đã đủ. Dòng đỏ là chỗ còn trống — mở đúng nhóm và điền. Càng đủ, gợi ý ứng viên sau này càng sát.',
    },
    {
      id: 'jd-preview',
      step: 3,
      title: 'Xem trước rồi đăng',
      body: 'Đây là tin ứng viên sẽ đọc. Kiểm tra vị trí, lương và tiêu chí. Đăng tin khi đã chọn cấp bậc ở bước 2. Lưu nháp nếu chưa muốn hiện.',
    },
  ];
}

type Hole = { top: number; left: number; width: number; height: number };

function readPlay(): { playing: boolean; index: number } | null {
  try {
    const raw = sessionStorage.getItem(PLAY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { playing?: boolean; index?: number };
    if (!data.playing) return null;
    return { playing: true, index: data.index ?? 0 };
  } catch {
    return null;
  }
}

function writePlay(playing: boolean, index: number) {
  sessionStorage.setItem(PLAY_KEY, JSON.stringify({ playing, index }));
}

function platformTourPlaying() {
  try {
    const raw = sessionStorage.getItem('inlink-ntd-guide');
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as { playing?: boolean }).playing);
  } catch {
    return false;
  }
}

function placeCard(hole: Hole) {
  const margin = 16;
  const width = Math.min(340, window.innerWidth - margin * 2);
  const height = 240;
  const right = hole.left + hole.width + margin;
  const leftOf = hole.left - width - margin;
  let left = right;
  let top = hole.top;
  if (right + width > window.innerWidth - margin && leftOf >= margin) {
    left = leftOf;
  } else if (right + width > window.innerWidth - margin) {
    left = hole.left;
    top = hole.top + hole.height + margin;
  }
  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, hole.top - height - margin);
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  return { top, left, width };
}

export function JdCreateGuide({
  track,
  step,
  onStep,
}: {
  track: TrackKind;
  step: number;
  onStep: (step: number) => void;
}) {
  const beats = useMemo(() => beatsFor(track), [track]);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);

  function close() {
    setOpen(false);
    setPlaying(false);
    setHole(null);
    sessionStorage.removeItem(PLAY_KEY);
    localStorage.setItem(SEEN_KEY, '1');
  }

  function begin(at: number) {
    setIndex(at);
    setPlaying(true);
    setOpen(true);
    writePlay(true, at);
    localStorage.setItem(SEEN_KEY, '1');
  }

  useEffect(() => {
    const saved = readPlay();
    if (saved) {
      setIndex(Math.min(saved.index, beats.length - 1));
      setPlaying(true);
      setOpen(true);
      return;
    }
    if (localStorage.getItem(SEEN_KEY) === '1') return;
    if (platformTourPlaying()) return;
    setOpen(true);
  }, [beats.length]);

  useEffect(() => {
    if (!playing) return;
    const beat = beats[index];
    if (beat && beat.step !== step) onStep(beat.step);
  }, [playing, index, step, beats, onStep]);

  useEffect(() => {
    if (!playing) {
      setHole(null);
      return;
    }
    const beat = beats[index];
    if (!beat) return;
    const measure = () => {
      const nodes = document.querySelectorAll<HTMLElement>(`[data-guide="${beat.id}"]`);
      const el = Array.from(nodes).find((node) => node.getBoundingClientRect().width > 0);
      if (!el) {
        setHole(null);
        return;
      }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      const pad = 6;
      setHole({
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };
    measure();
    const timer = window.setInterval(measure, 250);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [playing, index, beats, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const beat = beats[index];
  const card = hole ? placeCard(hole) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          setHole(null);
          sessionStorage.removeItem(PLAY_KEY);
          setOpen(true);
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Hướng dẫn tạo JD
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          {playing && hole ? (
            <svg className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <mask id="inlink-jd-guide-hole">
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
              <rect
                width="100%"
                height="100%"
                fill="rgba(7,35,72,0.58)"
                mask="url(#inlink-jd-guide-hole)"
              />
            </svg>
          ) : (
            <button
              type="button"
              aria-label="Đóng hướng dẫn"
              className="absolute inset-0 bg-[#072348]/55"
              onClick={close}
            />
          )}

          {!playing && (
            <div className="guide-pop absolute left-1/2 top-1/2 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="bg-[#072348] px-5 py-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Hướng dẫn tạo JD
                </p>
                <h2 className="mt-1 text-lg font-bold">Vì sao tin inlink khác trang khác</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/80">
                  Bạn không viết một bài mô tả rồi đăng. AI tách JD thành tiêu chí, bạn xác nhận, rồi hệ thống dùng ma trận đó để tìm ứng viên.
                </p>
              </div>
              <ol className="max-h-[46vh] space-y-1 overflow-y-auto px-3 py-3">
                {beats.map((item, i) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => begin(i)}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <span>
                        <span className="block text-[13px] font-semibold text-slate-900">{item.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.body}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
                <button type="button" onClick={close} className="text-[13px] font-semibold text-slate-500">
                  Để sau
                </button>
                <button
                  type="button"
                  onClick={() => begin(0)}
                  className="rounded-lg bg-amber-500 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-amber-600"
                >
                  Bắt đầu
                </button>
              </div>
            </div>
          )}

          {playing && beat && (
            <div
              className={clsx(
                'guide-pop absolute rounded-2xl bg-white p-4 shadow-2xl',
                !card && 'left-1/2 top-1/2 w-[min(340px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
              )}
              style={card ? { top: card.top, left: card.left, width: card.width } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Bước {index + 1}/{beats.length}
                </p>
                <button type="button" aria-label="Đóng" onClick={close} className="text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${((index + 1) / beats.length) * 100}%` }}
                />
              </div>
              <h3 className="mt-3 text-[15px] font-bold text-slate-900">{beat.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{beat.body}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (index === 0) {
                      setPlaying(false);
                      setHole(null);
                      sessionStorage.removeItem(PLAY_KEY);
                      return;
                    }
                    const next = index - 1;
                    setIndex(next);
                    writePlay(true, next);
                  }}
                  className="text-[13px] font-semibold text-slate-500"
                >
                  {index === 0 ? 'Mục lục' : 'Quay lại'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (index >= beats.length - 1) {
                      close();
                      return;
                    }
                    const next = index + 1;
                    setIndex(next);
                    writePlay(true, next);
                  }}
                  className="rounded-lg bg-[#072348] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
                >
                  {index >= beats.length - 1 ? 'Đã hiểu' : 'Tiếp theo'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
