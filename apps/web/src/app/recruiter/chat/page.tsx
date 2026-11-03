'use client';

import { AppShell } from '@/components/app-shell';
import { ConnectionChat } from '@/components/connection-chat';
import { MessageCircle } from 'lucide-react';

export default function RecruiterChatPage() {
  return (
    <AppShell>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-800">Chat</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Trao đổi với ứng viên đã chấp nhận kết nối.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <ConnectionChat embedded />
        </div>
      </div>
    </AppShell>
  );
}
