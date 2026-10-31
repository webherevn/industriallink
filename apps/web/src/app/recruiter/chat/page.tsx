'use client';

import { AppShell } from '@/components/app-shell';
import { ConnectionChat } from '@/components/connection-chat';

export default function RecruiterChatPage() {
  return (
    <AppShell>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-brand-700">Chat</h1>
        <p className="mt-1 text-sm text-slate-500">
          Trao đổi với ứng viên đã chấp nhận kết nối.
        </p>
        <div className="mt-4">
          <ConnectionChat embedded />
        </div>
      </div>
    </AppShell>
  );
}
