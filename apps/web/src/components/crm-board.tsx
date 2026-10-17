'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isCmsAdminRole } from '@industriallink/contracts';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import { restoreSession, tokenStore } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { fetchMe, logout } from '@/lib/auth';
import { createCrmDeal, createCrmLead, fetchCrmBoard, fetchCrmMarketing, moveCrmDeal } from '@/lib/crm';
import { bounceIfWrongHost, goToPublicApp } from '@/lib/hosts';

export function CrmBoardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void restoreSession().finally(() => setReady(true));
  }, []);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: ready && Boolean(tokenStore.get()),
  });

  useEffect(() => {
    if (!ready) return;
    if (!tokenStore.get()) router.replace('/login');
  }, [ready, router]);

  useEffect(() => {
    if (!me.data) return;
    if (!isCmsAdminRole(me.data.role)) {
      goToPublicApp('/');
      return;
    }
    bounceIfWrongHost(me.data.role, '/crm');
  }, [me.data]);

  const board = useQuery({
    queryKey: ['crm-board'],
    queryFn: fetchCrmBoard,
    enabled: me.data ? isCmsAdminRole(me.data.role) : false,
  });

  const channels = useQuery({
    queryKey: ['crm-marketing'],
    queryFn: fetchCrmMarketing,
    enabled: me.data ? isCmsAdminRole(me.data.role) : false,
  });
  const activeSources = (channels.data?.channels ?? []).filter((row) => row.isActive);

  const addLead = useMutation({
    mutationFn: () => {
      if (!activeSources.some((row) => row.code === source)) {
        return Promise.reject(new Error('Chọn nguồn khách đang bật'));
      }
      return createCrmLead({
        companyName,
        contactName,
        contactPhone,
        taxCode: taxCode || null,
        source,
      });
    },
    onSuccess: () => {
      setCompanyName('');
      setContactName('');
      setContactPhone('');
      setTaxCode('');
      setSource('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không tạo được lead'),
  });

  const addDeal = useMutation({
    mutationFn: (leadId: string) => {
      const lead = board.data?.leads.find((item) => item.id === leadId);
      return createCrmDeal({
        leadId,
        title: lead ? `Bán gói — ${lead.companyName}` : 'Bán gói',
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['crm-board'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không tạo được deal'),
  });

  const move = useMutation({
    mutationFn: (input: { id: string; stageCode: string }) =>
      moveCrmDeal(input.id, { stageCode: input.stageCode }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['crm-board'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không chuyển được bước'),
  });

  function onCreateLead(event: FormEvent) {
    event.preventDefault();
    addLead.mutate();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">CRM inlink</p>
          <p className="text-xs text-slate-500">Phễu bán gói. Chốt deal không tự gán gói.</p>
        </div>
        <Button variant="outline" onClick={() => void logout().then(() => goToPublicApp('/login'))}>
          Đăng xuất
        </Button>
      </header>

      <main className="space-y-5 p-5">
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <Card className="p-4">
          <form className="grid gap-3 md:grid-cols-6" onSubmit={onCreateLead}>
            <input
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Tên công ty"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
            />
            <input
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Người liên hệ"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
            />
            <input
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Số điện thoại"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              required
            />
            <input
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Mã số thuế"
              value={taxCode}
              onChange={(event) => setTaxCode(event.target.value)}
            />
            <select
              className="rounded border border-slate-200 px-3 py-2 text-sm"
              value={source}
              required
              onChange={(event) => setSource(event.target.value as typeof source)}
            >
              <option value="">Nguồn khách</option>
              {activeSources.map((row) => (
                <option key={row.code} value={row.code}>{row.name}</option>
              ))}
            </select>
            <Button type="submit" disabled={addLead.isPending || !source}>
              Thêm lead
            </Button>
          </form>
        </Card>

        {board.isLoading ? <p className="text-sm text-slate-500">Đang tải phễu…</p> : null}

        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {board.data?.stages.map((stage) => (
            <section key={stage.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.name}</h2>
              <div className="mt-3 space-y-2">
                {board.data?.deals
                  .filter((deal) => deal.stageId === stage.id)
                  .map((deal) => (
                    <article key={deal.id} className="rounded border border-slate-100 p-2">
                      <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                      <p className="text-xs text-slate-500">{deal.companyName}</p>
                      <p className="mt-1 text-[11px] text-slate-400">Chưa gán gói</p>
                      <select
                        className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        value={deal.stageCode}
                        onChange={(event) => move.mutate({ id: deal.id, stageCode: event.target.value })}
                      >
                        {board.data?.stages.map((option) => (
                          <option key={option.id} value={option.code}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900">Lead</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {board.data?.leads.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{lead.companyName}</span>
                  <span className="ml-2 text-slate-500">{lead.contactPhone}</span>
                </span>
                <Button
                  variant="outline"
                  disabled={addDeal.isPending || lead.status === 'unqualified'}
                  onClick={() => addDeal.mutate(lead.id)}
                >
                  Tạo deal
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
