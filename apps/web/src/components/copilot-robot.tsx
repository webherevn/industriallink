'use client';

import clsx from 'clsx';

export function CopilotRobot({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/copilot-robot.gif"
      alt="Trợ lý AI"
      className={clsx('h-auto w-full select-none object-contain', className)}
      draggable={false}
    />
  );
}
