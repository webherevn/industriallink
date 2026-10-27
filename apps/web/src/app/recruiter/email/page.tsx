'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatJobTitle } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { BroadcastEmailForm } from '@/components/broadcast-email-modal';
import { Field, Select } from '@/components/ui';
import { listApplicants, listMyJobs } from '@/lib/jobs';

export default function RecruiterBroadcastEmailPage() {
  const [jobId, setJobId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { data: jobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
  });
  const { data: applicants, isLoading: loadingApplicants } = useQuery({
    queryKey: ['applicants', jobId],
    queryFn: () => listApplicants(jobId),
    enabled: Boolean(jobId),
  });

  const selectedJob = jobs?.find((job) => job.id === jobId);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Gửi email hàng loạt</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Chọn tin, tick ứng viên theo trạng thái ứng tuyển, rồi gửi cùng một nội dung.
      </p>

      {notice && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{notice}</p>
      )}

      <div className="mt-5 max-w-xl">
        <Field label="Tin tuyển dụng">
          <Select
            value={jobId}
            disabled={loadingJobs}
            onChange={(e) => {
              setJobId(e.target.value);
              setNotice(null);
            }}
          >
            <option value="">{loadingJobs ? 'Đang tải tin...' : 'Chọn tin'}</option>
            {(jobs ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {formatJobTitle(job.title)} · {job.code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {jobId && loadingApplicants && <p className="mt-6 text-sm text-slate-500">Đang tải ứng viên...</p>}

      {jobId && applicants && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedJob && (
            <p className="mb-4 text-sm font-medium text-slate-700">{formatJobTitle(selectedJob.title)}</p>
          )}
          <BroadcastEmailForm
            key={jobId}
            jobId={jobId}
            applicants={applicants}
            onSent={(result) => {
              setNotice(
                `Đã gửi ${result.sent}/${result.recipients} email` +
                  (result.failed ? ` (${result.failed} lỗi)` : ''),
              );
            }}
          />
        </div>
      )}
    </AppShell>
  );
}
