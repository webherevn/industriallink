'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CheckCircle2,
  Coins,
  Edit3,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AdminCreateCreditTopupRequest,
  AdminUpdateCreditTopupRequest,
  BillingCreditTopupView,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createAdminCreditTopup,
  deleteAdminCreditTopup,
  fetchAdminCreditTopups,
  fetchPublicBillingConfig,
  updateAdminCreditTopup,
} from '@/lib/admin-billing';
import { formatPriceVnd, formatReferenceUsd } from '@/lib/format-billing';

type FormState = AdminCreateCreditTopupRequest & { id?: string };

const EMPTY: FormState = {
  name: '',
  creditCount: 20,
  priceVnd: '0',
  badge: '',
  sortOrder: 0,
  isActive: true,
  isFeatured: false,
};

export function AdminBillingCreditTopups() {
  const qc = useQueryClient();
  const { data: topups, isLoading } = useQuery({
    queryKey: ['admin-billing-credit-topups'],
    queryFn: () => fetchAdminCreditTopups(true),
  });
  const { data: pub } = useQuery({
    queryKey: ['billing-public-config'],
    queryFn: fetchPublicBillingConfig,
  });

  const [editing, setEditing] = useState<FormState | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const createM = useMutation({
    mutationFn: (body: AdminCreateCreditTopupRequest) => createAdminCreditTopup(body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã tạo gói top-up.' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-billing-credit-topups'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminUpdateCreditTopupRequest }) =>
      updateAdminCreditTopup(id, body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã cập nhật top-up.' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-billing-credit-topups'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAdminCreditTopup(id),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã tắt top-up.' });
      qc.invalidateQueries({ queryKey: ['admin-billing-credit-topups'] });
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

  const unitPriceVndPreview = (() => {
    if (!editing) return 0n;
    const c = Number(editing.creditCount);
    if (c < 1) return 0n;
    try {
      return BigInt(editing.priceVnd) / BigInt(c);
    } catch {
      return 0n;
    }
  })();

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Pricing · Credit
            </p>
            <h1 className="cms-page-title mt-1.5">Top-up Credit</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              Đơn giá / lượt tự tính = priceVnd ÷ creditCount. Khuyến khích mua nhiều để giảm giá.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5"
              onClick={() => qc.invalidateQueries({ queryKey: ['admin-billing-credit-topups'] })}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </Button>
            <Button type="button" className="gap-1.5" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="h-3.5 w-3.5" /> Tạo gói top-up
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="admin-dash-skel h-40" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(topups ?? []).map((t) => (
              <TopupCard
                key={t.id}
                topup={t}
                currency={pub?.currency}
                onEdit={() =>
                  setEditing({
                    id: t.id,
                    name: t.name,
                    creditCount: t.creditCount,
                    priceVnd: t.priceVnd,
                    badge: t.badge ?? '',
                    sortOrder: t.sortOrder,
                    isActive: t.isActive,
                    isFeatured: t.isFeatured,
                  })
                }
                onDelete={() => {
                  if (confirm(`Tắt gói "${t.name}"?`)) deleteM.mutate(t.id);
                }}
              />
            ))}
            {topups?.length === 0 ? (
              <Card className="col-span-full p-10 text-center text-sm text-slate-500">
                Chưa có gói top-up.
              </Card>
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
            unitPriceVndPreview={unitPriceVndPreview}
            currency={pub?.currency}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

function TopupCard({
  topup,
  currency,
  onEdit,
  onDelete,
}: {
  topup: BillingCreditTopupView;
  currency?: import('@industriallink/contracts').BillingCurrencyDisplay;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={clsx('admin-dash-card p-4', !topup.isActive && 'opacity-50')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">{topup.name}</h3>
            {topup.isFeatured ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
          </div>
          {topup.badge ? (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {topup.badge}
            </span>
          ) : null}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          {topup.isActive ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            >
              <Power className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-2xl font-bold tabular-nums text-[#072348]">
          {currency ? formatPriceVnd(topup.priceVnd, currency) : `${topup.priceVnd}₫`}
        </p>
        {currency ? (
          <p className="text-[10px] text-slate-400">{formatReferenceUsd(topup.priceVnd, currency)}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-500">
          {topup.creditCount} lượt ×{' '}
          <strong>
            {currency
              ? formatPriceVnd(topup.unitPriceVnd, { ...currency, decimalDigits: 0 })
              : `${topup.unitPriceVnd}₫`}
          </strong>{' '}
          / lượt
        </p>
      </div>
    </div>
  );
}

function EditModal({
  form,
  setForm,
  onClose,
  onSubmit,
  saving,
  unitPriceVndPreview,
  currency,
}: {
  form: FormState;
  setForm: (f: FormState | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  unitPriceVndPreview: bigint;
  currency?: import('@industriallink/contracts').BillingCurrencyDisplay;
}) {
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {form.id ? 'Sửa top-up' : 'Tạo top-up'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên gói">
            <Input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="50 lượt"
            />
          </Field>
          <Field label="Số lượt">
            <Input
              type="number"
              min={1}
              value={form.creditCount}
              onChange={(e) => update('creditCount', Number(e.target.value))}
            />
          </Field>
          <Field label="Giá (VND)">
            <Input
              value={form.priceVnd.toString()}
              onChange={(e) => update('priceVnd', e.target.value)}
              placeholder="2750000"
            />
          </Field>
          <Field label="Badge (tuỳ chọn)">
            <Input
              value={form.badge ?? ''}
              onChange={(e) => update('badge', e.target.value)}
              placeholder="Tiết kiệm 12%"
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

        {currency && unitPriceVndPreview > 0n ? (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Đơn giá / lượt tự tính:{' '}
            <strong>{formatPriceVnd(unitPriceVndPreview.toString(), currency)}</strong>
          </div>
        ) : null}

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
            {form.id ? 'Lưu thay đổi' : 'Tạo top-up'}
          </Button>
        </div>
      </div>
    </div>
  );
}
