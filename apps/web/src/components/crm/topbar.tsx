'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarClock, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { NotificationBell } from '@/components/notification-bell';
import { matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { fetchCrmCustomers, fetchCrmFollowUps } from '@/lib/crm';

export function CrmTopbar({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const needle = query.trim();
  const board = useCrmBoard();
  const followUps = useQuery({ queryKey: ['crm-follow-ups'], queryFn: fetchCrmFollowUps });
  const customers = useQuery({
    queryKey: ['crm-header-customers', needle],
    queryFn: () => fetchCrmCustomers(needle),
    enabled: needle.length >= 2,
  });
  const leads = (board.data?.leads ?? [])
    .filter((lead) => matchesQuery(needle, [lead.companyName, lead.contactName, lead.contactPhone, lead.taxCode, lead.leadCode]))
    .slice(0, 5);
  const companies = (customers.data ?? []).slice(0, 5);
  const due = followUps.data?.length ?? 0;

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      const box = document.getElementById('crm-top-search');
      const target = event.target as Node | null;
      if (box && target && !box.contains(target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setOpen(false);
    router.push(needle ? `/crm?q=${encodeURIComponent(needle)}` : '/crm');
  }

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      <form id="crm-top-search" onSubmit={submit} className="relative min-w-0 flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm tiềm năng, liên hệ, khách hàng"
          aria-label="Tìm tiềm năng, liên hệ, khách hàng"
          className="h-10 w-full rounded-full border border-white bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#cfc6f5]"
        />
        {open && needle.length >= 2 ? (
          <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-2xl border border-[#e4e0f7] bg-white py-2 shadow-[0_16px_40px_rgba(76,62,201,0.14)]">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tiềm năng</p>
            {board.isLoading ? <p className="px-3 py-1.5 text-sm text-slate-400">Đang tìm…</p> : null}
            {!board.isLoading && leads.length === 0 ? <p className="px-3 py-1.5 text-sm text-slate-400">Không thấy tiềm năng.</p> : null}
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={lead.companyId ? `/crm/companies/${lead.companyId}` : '/crm/leads'}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 hover:bg-[#f6f4ff]"
              >
                <span className="block text-sm font-medium text-slate-800">{lead.companyName}</span>
                <span className="block text-xs text-slate-400">{lead.contactName}{lead.taxCode ? ` · MST ${lead.taxCode}` : ''}</span>
              </Link>
            ))}
            <p className="mt-1 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Khách hàng</p>
            {customers.isFetching ? <p className="px-3 py-1.5 text-sm text-slate-400">Đang tìm…</p> : null}
            {!customers.isFetching && companies.length === 0 ? <p className="px-3 py-1.5 text-sm text-slate-400">Không thấy khách hàng.</p> : null}
            {companies.map((company) => (
              <Link
                key={company.companyId}
                href={`/crm/companies/${company.companyId}`}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 hover:bg-[#f6f4ff]"
              >
                <span className="block text-sm font-medium text-slate-800">{company.companyName}</span>
                <span className="block text-xs text-slate-400">{company.contactName || 'Chưa có liên hệ'}{company.taxCode ? ` · MST ${company.taxCode}` : ''}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </form>
      <div className="flex shrink-0 items-center gap-0.5">
        <TopLink href="/crm/activities" label="Việc hẹn" count={due}>
          <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
        </TopLink>
        <TopLink href="/crm/leads" label="Tạo tiềm năng">
          <UserPlus className="h-5 w-5" strokeWidth={1.75} />
        </TopLink>
        <TopLink href="/crm/docs" label="Tài liệu">
          <BookOpen className="h-5 w-5" strokeWidth={1.75} />
        </TopLink>
        <NotificationBell allHref="/crm/notifications" />
        <span
          title={displayName}
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#072348] text-[11px] font-bold text-white"
        >
          {initials(displayName)}
        </span>
      </div>
    </div>
  );
}

function TopLink({ href, label, count = 0, children }: { href: string; label: string; count?: number; children: ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className="relative rounded-full p-2.5 text-slate-500 transition hover:bg-white hover:text-slate-800">
      {children}
      {count > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
