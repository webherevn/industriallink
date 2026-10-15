'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Shield,
  Star,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AdminCreateSourcingPlanRequest,
  AdminUpdateSourcingPlanRequest,
  BillingSourcingPlanView,
  SourcingServiceScope,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createAdminSourcingPlan,
  deleteAdminSourcingPlan,
  fetchAdminSourcingPlans,
  fetchPublicBillingConfig,
  updateAdminSourcingPlan,
} from '@/lib/admin-billing';
import { formatPriceVnd, formatReferenceUsd } from '@/lib/format-billing';

type FormState = AdminCreateSourcingPlanRequest & { id?: string };

const ALL_SCOPES: { code: SourcingServiceScope; label: string }[] = [
  { code: 'ai_match', label: 'AI tìm / Matching' },
  { code: 'filter_rank', label: 'Lọc & xếp hạng' },
  { code: 'shortlist', label: 'Shortlist' },
  { code: 'strengths_gaps', label: 'Điểm mạnh / Khoảng thiếu' },
  { code: 'priority', label: 'Ứng viên ưu tiên' },
  { code: 'outreach', label: 'Chủ động tiếp cận' },
  { code: 'follow_up', label: 'Theo dõi phản hồi' },
  { code: 'replacement', label: 'Ứng viên thay thế' },
];

const EMPTY: FormState = {
  code: '',
  name: '',
  description: '',
  feeVnd: '0',
  positionQuota: 1,
  searchRoundQuota: 1,
  shortlistQuota: 1,
  revisionQuota: 1,
  serviceScope: ['ai_match', 'filter_rank'],
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
};

export function AdminBillingSourcingPlans() {
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-billing-sourcing-plans'],
    queryFn: () => fetchAdminSourcingPlans(true),
  });
  const { data: pub } = useQuery({
    queryKey: ['billing-public-config'],
    queryFn: fetchPublicBillingConfig,
  });

  const [editing, setEditing] = useState<FormState | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const createM = useMutation({
    mutationFn: (body: AdminCreateSourcingPlanRequest) => createAdminSourcingPlan(body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã tạo gói Săn.' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-billing-sourcing-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminUpdateSourcingPlanRequest }) =>
      updateAdminSourcingPlan(id, body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã cập nhật gói Săn.' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-billing-sourcing-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAdminSourcingPlan(id),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã tắt gói Săn.' });
      qc.invalidateQueries({ queryKey: ['admin-billing-sourcing-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Tắt thất bại' }),
  });

  const handleSubmit = () => {
    if (!editing) return;
    if (editing.id) {
      updateM.mutate({ id: editing.id, body: editing });
    } else {
      createM.mutate(editing);
    }
  };

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Pricing · Tầng 2
            </p>
            <h1 className="cms-page-title mt-1.5">Gói Săn nhân sự</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              3 gói: Cơ bản, Tiêu chuẩn, Chuyên sâu. Phí dịch vụ riêng; Credit mua theo nhu cầu.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5"
              onClick={() => qc.invalidateQueries({ queryKey: ['admin-billing-sourcing-plans'] })}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </Button>
            <Button type="button" className="gap-1.5" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="h-3.5 w-3.5" /> Tạo gói Săn
            </Button>
          </div>
        </div>

        {banner ? (
          <div
            className={clsx(
              'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
              banner.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            )}
          >
            {banner.tone === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {banner.text}
            <button type="button" className="ml-auto" onClick={() => setBanner(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="admin-dash-skel h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(plans ?? []).map((p) => (
              <div
                key={p.id}
                className={clsx('admin-dash-card p-4', !p.isActive && 'opacity-50')}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 text-white">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{p.name}</h3>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                        {p.code}
                      </code>
                      {p.isFeatured ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                      {!p.isActive ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          TẮT
                        </span>
                      ) : null}
                    </div>
                    {p.description ? <p className="mt-0.5 text-xs text-slate-500">{p.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span>
                        Vị trí: <strong>{p.positionQuota ?? '∞'}</strong>
                      </span>
                      <span>
                        Đợt tìm: <strong>{p.searchRoundQuota ?? '∞'}</strong>
                      </span>
                      <span>
                        Shortlist: <strong>{p.shortlistQuota ?? '∞'}</strong>
                      </span>
                      <span>
                        Điều chỉnh: <strong>{p.revisionQuota ?? '∞'}</strong>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.serviceScope.map((s) => {
                        const meta = ALL_SCOPES.find((x) => x.code === s);
                        return (
                          <span
                            key={s}
                            className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100"
                          >
                            {meta?.label ?? s}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-[#072348]">
                      {pub?.currency ? formatPriceVnd(p.feeVnd, pub.currency) : `${p.feeVnd}₫`}
                    </p>
                    {pub?.currency ? (
                      <p className="text-[10px] text-slate-400">{formatReferenceUsd(p.feeVnd, pub.currency)}</p>
                    ) : null}
                    <p className="text-[10px] text-slate-400">+ Credit mua riêng</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: p.id,
                          code: p.code,
                          name: p.name,
                          description: p.description ?? '',
                          feeVnd: p.feeVnd,
                          positionQuota: p.positionQuota ?? undefined,
                          searchRoundQuota: p.searchRoundQuota ?? undefined,
                          shortlistQuota: p.shortlistQuota ?? undefined,
                          revisionQuota: p.revisionQuota ?? undefined,
                          serviceScope: p.serviceScope as SourcingServiceScope[],
                          sortOrder: p.sortOrder,
                          isActive: p.isActive,
                          isFeatured: p.isFeatured,
                        })
                      }
                      className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    {p.isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Tắt gói Săn "${p.name}"?`)) deleteM.mutate(p.id);
                        }}
                        className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {plans?.length === 0 ? (
              <Card className="p-10 text-center text-sm text-slate-500">Chưa có gói Săn nào.</Card>
            ) : null}
          </div>
        )}

        {editing ? (
          <EditModal
            form={editing}
            setForm={setEditing}
            onClose={() => setEditing(null)}
            onSubmit={handleSubmit}
            saving={createM.isPending || updateM.isPending}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

function EditModal({
  form,
  setForm,
  onClose,
  onSubmit,
  saving,
}: {
  form: FormState;
  setForm: (f: FormState | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const toggleScope = (s: SourcingServiceScope) => {
    const cur = form.serviceScope ?? [];
    update(
      'serviceScope',
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {form.id ? 'Sửa gói Săn' : 'Tạo gói Săn mới'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã (code)">
            <Input
              value={form.code}
              onChange={(e) => update('code', e.target.value.toUpperCase())}
              disabled={!!form.id}
              placeholder="SAN_CO_BAN"
            />
          </Field>
          <Field label="Tên">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Săn cơ bản" />
          </Field>
          <Field label="Phí dịch vụ (VND)" description="Chưa bao gồm Credit">
            <Input
              value={form.feeVnd.toString()}
              onChange={(e) => update('feeVnd', e.target.value)}
              placeholder="1225000"
            />
          </Field>
          <Field label="Vị trí / gói">
            <Input
              type="number"
              value={form.positionQuota ?? ''}
              onChange={(e) =>
                update('positionQuota', e.target.value === '' ? undefined : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Đợt tìm">
            <Input
              type="number"
              value={form.searchRoundQuota ?? ''}
              onChange={(e) =>
                update('searchRoundQuota', e.target.value === '' ? undefined : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Shortlist">
            <Input
              type="number"
              value={form.shortlistQuota ?? ''}
              onChange={(e) =>
                update('shortlistQuota', e.target.value === '' ? undefined : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Số lần điều chỉnh">
            <Input
              type="number"
              value={form.revisionQuota ?? ''}
              onChange={(e) =>
                update('revisionQuota', e.target.value === '' ? undefined : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Thứ tự">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => update('sortOrder', Number(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Mô tả" className="mt-3">
          <Textarea
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
          />
        </Field>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-slate-700">Phạm vi dịch vụ (8 mức bảng XI)</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ALL_SCOPES.map((s) => {
              const checked = (form.serviceScope ?? []).includes(s.code);
              return (
                <label
                  key={s.code}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                    checked
                      ? 'border-violet-300 bg-violet-50 text-violet-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleScope(s.code)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  {s.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Đang bán
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => update('isFeatured', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Nổi bật
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="button" onClick={onSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {form.id ? 'Lưu thay đổi' : 'Tạo gói'}
          </Button>
        </div>
      </div>
    </div>
  );
}
