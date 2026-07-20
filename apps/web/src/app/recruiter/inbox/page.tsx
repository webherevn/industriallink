'use client';

import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ApplicationStatus } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Card, Select } from '@/components/ui';
import { APPLICATION_STATUS_LABEL, statusTone } from '@/lib/format';
import { listInbox } from '@/lib/recruiter';

export default function RecruiterInboxPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-inbox'],
    queryFn: () => listInbox(100),
    retry: false,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'all') return data;
    return data.filter((a) => a.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hộp thư ứng viên</h1>
          <p className="mt-1 text-slate-500">
            Toàn bộ hồ sơ ứng tuyển vào các tin của công ty bạn.
          </p>
        </div>
        <Select
          className="w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.values(ApplicationStatus).map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-slate-500">Đang tải...</p>}
        {!isLoading && filtered.length === 0 && (
          <Card className="text-center">
            <Inbox className="mx-auto h-10 w-10 text-brand-500" />
            <p className="mt-3 text-slate-600">Chưa có hồ sơ phù hợp bộ lọc.</p>
          </Card>
        )}
        {filtered.map((a) => (
          <Link key={a.applicationId} href={`/jobs/${a.jobId}/applicants`} className="block">
            <Card className="flex flex-wrap items-center justify-between gap-4 transition hover:border-brand-300">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{a.displayName}</p>
                  <Badge tone={statusTone(a.status)}>{APPLICATION_STATUS_LABEL[a.status]}</Badge>
                  {a.matchScore != null && <Badge tone="brand">Phù hợp {a.matchScore}%</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {a.jobTitle}
                  {a.currentPosition ? ` · ${a.currentPosition}` : ''}
                  {a.industry ? ` · ${a.industry}` : ''}
                </p>
                {a.matchedSkills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.matchedSkills.slice(0, 5).map((s) => (
                      <Badge key={s} tone="green">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {new Date(a.createdAt).toLocaleString('vi-VN')}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
