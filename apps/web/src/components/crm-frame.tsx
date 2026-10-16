import type { ReactNode } from 'react';

export function CrmFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="cms-page-title">{title}</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Khung giao diện — số liệu trên màn là mẫu, chưa ghi vào hệ thống
        </p>
      </div>
      {children}
    </div>
  );
}

export function CrmStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#072348]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
