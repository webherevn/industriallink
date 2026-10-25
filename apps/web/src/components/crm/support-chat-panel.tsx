'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { fetchSupportThreadMessages, fetchSupportThreads, replySupportThread } from '@/lib/support-chat';

function when(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export function SupportChatPanel() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const threads = useQuery({
    queryKey: ['crm-support-threads'],
    queryFn: fetchSupportThreads,
    refetchInterval: 12_000,
  });

  const list = (threads.data ?? []).filter((thread) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [thread.name, thread.email, thread.roleLabel, thread.lastBody ?? ''].join(' ').toLowerCase().includes(q);
  });
  const active = list.find((thread) => thread.id === activeId) ?? list[0] ?? null;

  useEffect(() => {
    if (!activeId && active) setActiveId(active.id);
  }, [active, activeId]);

  const messages = useQuery({
    queryKey: ['crm-support-messages', active?.id],
    queryFn: () => fetchSupportThreadMessages(active!.id),
    enabled: Boolean(active?.id),
    refetchInterval: 5_000,
  });

  const reply = useMutation({
    mutationFn: (body: string) => replySupportThread(active!.id, body),
    onSuccess: async () => {
      setDraft('');
      await qc.invalidateQueries({ queryKey: ['crm-support-messages', active?.id] });
      await qc.invalidateQueries({ queryKey: ['crm-support-threads'] });
    },
  });

  return (
    <CrmFrame
      kicker="Hỏi đáp từ web"
      title="Chat góp ý"
      description="Câu hỏi và góp ý của nhà tuyển dụng, ứng viên. Sale và SuperAdmin trả lời tại đây. Không tạo đơn và không bật gói."
      placeholder="Tìm theo tên, email hoặc nội dung"
      search={{ value: query, onChange: setQuery }}
      footnote="Tin gửi từ robot góc phải trên web. Trả lời hiện lại ở khung chat của người gửi."
    >
      {threads.isLoading ? (
        <p className="text-center text-sm text-slate-400">Đang tải hội thoại…</p>
      ) : list.length === 0 ? (
        <CrmEmpty>Chưa có góp ý nào.</CrmEmpty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ul className="crm-surface max-h-[560px] overflow-y-auto rounded-[22px] bg-white">
            {list.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(thread.id);
                    setDraft('');
                  }}
                  className={clsx(
                    'flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-left',
                    active?.id === thread.id ? 'bg-[#efeaff]' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{thread.name}</span>
                    {thread.unread > 0 && (
                      <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {thread.unread}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-[#4c3ec9]">{thread.roleLabel}</span>
                  <span className="truncate text-xs text-slate-500">{thread.lastBody ?? 'Chưa có tin'}</span>
                </button>
              </li>
            ))}
          </ul>

          {active && (
            <section className="crm-surface flex min-h-[420px] flex-col rounded-[22px] bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-[#4c3ec9]" />
                  {active.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {active.roleLabel} · {active.email}
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#f7f5ff] px-4 py-3">
                {(messages.data ?? []).map((message) => (
                  <div key={message.id} className={clsx('flex', message.fromStaff ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug',
                        message.fromStaff ? 'bg-[#072348] text-white' : 'bg-white text-slate-800 ring-1 ring-slate-100',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={clsx('mt-1 text-[10px]', message.fromStaff ? 'text-white/60' : 'text-slate-400')}>
                        {message.fromStaff ? message.senderName : active.name} · {when(message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="flex items-end gap-2 border-t border-slate-100 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = draft.trim();
                  if (!text || reply.isPending) return;
                  reply.mutate(text);
                }}
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Trả lời người dùng…"
                  className={clsx(crmFieldClass, 'min-h-[44px] flex-1 resize-none')}
                />
                <button type="submit" disabled={reply.isPending || draft.trim().length === 0} className={clsx(crmButtonClass, 'inline-flex items-center')}>
                  {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              {reply.isError && <p className="px-3 pb-3 text-xs text-rose-600">Chưa gửi được câu trả lời.</p>}
            </section>
          )}
        </div>
      )}
    </CrmFrame>
  );
}
