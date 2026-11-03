'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';

const HELLO_FRAMES = ['/robot-il-hello-0.png', '/robot-il-hello-1.png', '/robot-il-hello-2.png'] as const;
const RUN_FRAMES = ['/robot-il-run-0.png', '/robot-il-run-1.png', '/robot-il-run-2.png'] as const;
/** Đúng nhịp delay trong file GIF gốc (đơn vị gốc là 1/100 giây). */
const HELLO_MS = 700;
const RUN_MS = 600;

export function CopilotRobot({ className, running = false }: { className?: string; running?: boolean }) {
  const frames = running ? RUN_FRAMES : HELLO_FRAMES;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    RUN_FRAMES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [running]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setFrame((current) => (current + 1) % frames.length);
    }, running ? RUN_MS : HELLO_MS);
    return () => window.clearInterval(id);
  }, [frames.length, running]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={frames[frame] ?? frames[0]}
      alt="Trợ lý AI"
      className={clsx('h-auto w-full select-none object-contain', className)}
      draggable={false}
    />
  );
}
