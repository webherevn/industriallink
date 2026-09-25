'use client';

import { BookOpen } from 'lucide-react';
import { AppShell } from '@/components/app-shell';

/** Placeholder blog — nội dung sẽ bổ sung sau. */
export default function CareerGuidePage() {
  return (
    <AppShell allowGuest>
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <BookOpen className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Cẩm nang nghề nghiệp</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Chuyên mục blog dành cho ứng viên công nghiệp B2B: lộ trình nghề, kỹ năng, phỏng vấn và
          thị trường tuyển dụng. Nội dung đang được biên soạn.
        </p>
      </div>
    </AppShell>
  );
}
