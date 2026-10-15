'use client';

import { XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';

export function RecruiterTopupCancel() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order') ?? '';

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-md space-y-4 py-8">
        <Card className="overflow-hidden p-0 text-center">
          <div className="bg-gradient-to-br from-slate-500 to-slate-700 p-8 text-white">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <XCircle className="h-10 w-10" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Đã huỷ thanh toán</h1>
            <p className="mt-1 text-sm text-slate-200">
              Đơn chưa được xử lý. Bạn có thể thử lại hoặc chọn gói khác.
            </p>
          </div>
          {orderId ? (
            <div className="border-b border-slate-100 p-3 text-left text-xs text-slate-500">
              Mã đơn: <code className="rounded bg-slate-100 px-1.5 py-0.5">{orderId.slice(0, 16)}…</code>
              <p className="mt-1 text-[10px]">Đơn sẽ được đánh dấu &quot;failed&quot; trong lịch sử.</p>
            </div>
          ) : null}
          <div className="flex gap-2 p-4">
            <Link href="/recruiter/billing/orders" className="flex-1">
              <Button variant="outline" className="w-full">
                Xem lịch sử
              </Button>
            </Link>
            <Link href="/recruiter/billing/topup" className="flex-1">
              <Button className="w-full">
                Thử lại
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </RecruiterShell>
  );
}
