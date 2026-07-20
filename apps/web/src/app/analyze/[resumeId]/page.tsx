'use client';

import { ResumeParseStatus } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { getResumeStatus } from '@/lib/candidate';

export default function AnalyzePage() {
  const router = useRouter();
  const params = useParams<{ resumeId: string }>();
  const resumeId = params.resumeId;

  const { data } = useQuery({
    queryKey: ['resume-status', resumeId],
    queryFn: () => getResumeStatus(resumeId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === ResumeParseStatus.Completed || status === ResumeParseStatus.Failed
        ? false
        : 1200;
    },
  });

  const done = data?.status === ResumeParseStatus.Completed;
  const failed = data?.status === ResumeParseStatus.Failed;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-slate-900">AI đang phân tích CV</h1>
        <p className="mt-1 text-slate-500">
          Trợ lý AI đang đọc và hiểu hồ sơ của bạn. Quá trình này diễn ra tự động.
        </p>

        <Card className="mt-6">
          <ul className="space-y-3">
            {(data?.steps ?? defaultSteps()).map((step) => (
              <li key={step.key} className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                )}
                <span className={step.done ? 'text-slate-900' : 'text-slate-400'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          {failed && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="h-4 w-4" /> Phân tích thất bại: {data?.error ?? 'lỗi không xác định'}
            </div>
          )}

          {done && (
            <Button className="mt-6 w-full" onClick={() => router.push('/dashboard')}>
              Xem hồ sơ của tôi
            </Button>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function defaultSteps() {
  return [
    { key: 'read_cv', label: 'Đọc CV', done: false },
    { key: 'analyze_skill', label: 'Phân tích kỹ năng', done: false },
    { key: 'identify_industry', label: 'Xác định ngành', done: false },
    { key: 'career', label: 'Định hướng nghề nghiệp', done: false },
    { key: 'summary', label: 'Tạo tóm tắt AI', done: false },
    { key: 'matching', label: 'Sẵn sàng gợi ý', done: false },
  ];
}
