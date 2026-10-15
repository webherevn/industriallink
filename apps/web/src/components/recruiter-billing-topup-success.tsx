'use client';

import { CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';

export function RecruiterTopupSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') ?? '';
  const orderId = searchParams.get('order') ?? '';

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-md space-y-4 py-8">
        <Card className="overflow-hidden p-0 text-center">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 text-white">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Thanh toán thành công!</h1>
            <p className="mt-1 text-sm text-emerald-50">
              <Sparkles className="inline h-3.5 w-3.5" /> Credit đã được cộng vào tài khoản của bạn.
            </p>
          </div>
          <div className="space-y-2 p-5 text-left text-xs text-slate-600">
            {orderId ? (
              <p>
                Mã đơn: <code className="rounded bg-slate-100 px-1.5 py-0.5">{orderId.slice(0, 16)}…</code>
              </p>
            ) : null}
            {sessionId ? (
              <p>
                Session: <code className="rounded bg-slate-100 px-1.5 py-0.5">{sessionId.slice(0, 24)}…</code>
              </p>
            ) : null}
            <p className="text-[11px] text-slate-400">
              Bạn có thể bắt đầu mở hồ sơ ứng viên tiềm năng ngay bây giờ.
            </p>
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <Link href="/recruiter/billing/credits" className="flex-1">
              <Button variant="outline" className="w-full">
                Xem số dư
              </Button>
            </Link>
            <Link href="/recruiter/billing/orders" className="flex-1">
              <Button className="w-full">
                Lịch sử đơn <ExternalLink className="h-3 w-3 opacity-60" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </RecruiterShell>
  );
}
