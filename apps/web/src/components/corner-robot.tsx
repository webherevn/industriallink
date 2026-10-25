'use client';

import { useEffect, useState } from 'react';
import { CopilotRobot } from '@/components/copilot-robot';

const ROTATE_MS = 3500;

function shortName(displayName?: string | null): string {
  const token = displayName?.trim().split(/\s+/).filter(Boolean).slice(-1)[0];
  return token || 'bạn';
}

/** Robot trợ lý góc dưới phải. Câu chào đổi nhau, không chặn thao tác trên trang. */
export function CornerRobot({ name }: { name?: string | null }) {
  const who = shortName(name);
  const lines = [
    `Hi, ${who}, cần tôi giúp gì cho bạn?`,
    'Bạn đang khó khăn phần nào? Hãy chatbox để Inlink hướng dẫn?',
    'Inlink vẫn đang trong giai đoạn trải nghiệm và thử nghiệm chắc chắn sẽ có một vài lỗi/thiếu sót, mong bạn thông cảm và gửi góp ý cho đội ngũ nhé.',
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [lines.length]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-end justify-end gap-2">
      <p
        key={index}
        className="corner-robot-bubble mb-2 max-w-[240px] rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] leading-snug text-slate-700 shadow-[0_12px_28px_-16px_rgba(7,35,72,0.6)] ring-1 ring-slate-200/80"
      >
        {lines[index]}
      </p>
      <div className="corner-robot-float w-[92px] shrink-0 sm:w-[112px]">
        <CopilotRobot />
      </div>
    </div>
  );
}
