'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fetchRecruiterEntitlements } from '@/lib/recruiter-billing';

export const STARTER_PROFILE_LOCK_MESSAGE =
  'Hãy nâng cấp gói để xem ngay hồ sơ ứng viên tiềm năng phù hợp nhất công ty bạn';

export function useIsStarterPlan(): boolean {
  const { data } = useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
    staleTime: 60_000,
    retry: false,
  });
  const code = data?.planCode ?? data?.plan?.planCode ?? null;
  return code === 'KHAM_PHA';
}

export function StarterProfileLockDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#072348]/45 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="starter-profile-lock-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[#E8872A]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p id="starter-profile-lock-title" className="text-base font-semibold leading-snug text-[#072348]">
              {STARTER_PROFILE_LOCK_MESSAGE}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Đóng
          </button>
          <Link
            href="/recruiter/pricing"
            className="rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b3268]"
          >
            Xem bảng giá
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Hồ sơ đã ứng tuyển mở bình thường. Hồ sơ tiềm năng trên gói Khám phá hiện popup nâng cấp. */
export function ProfileOpenLink({
  href,
  potential,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  potential?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}) {
  const starter = useIsStarterPlan();
  const [open, setOpen] = useState(false);
  if (potential && starter) {
    return (
      <>
        <button
          type="button"
          className={`cursor-pointer text-left font-[inherit] ${className ?? ''}`}
          aria-label={ariaLabel}
          onClick={() => setOpen(true)}
        >
          {children}
        </button>
        <StarterProfileLockDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
