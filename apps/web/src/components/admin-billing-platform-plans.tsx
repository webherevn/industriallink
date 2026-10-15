'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Package,
  Plus,
  Power,
  RefreshCw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AdminCreatePlatformPlanRequest,
  AdminPlanActionCostItem,
  AdminUpdatePlatformPlanRequest,
  BillingCreditPolicyView,
  BillingPlatformPlanView,
} from '@industriallink/contracts';
import {
  BILLING_PLAN_ACTION_LABELS,
  BILLING_PLAN_BILLABLE_ACTIONS,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createAdminPlatformPlan,
  deleteAdminPlatformPlan,
  fetchAdminPlatformPlans,
  fetchPublicBillingConfig,
  updateAdminPlatformPlan,
} from '@/lib/admin-billing';
import { formatPriceVnd, formatReferenceUsd } from '@/lib/format-billing';

type FormState = AdminCreatePlatformPlanRequest & { id?: string };

function costsFromPolicy(policy?: BillingCreditPolicyView | null): AdminPlanActionCostItem[] {
  return BILLING_PLAN_BILLABLE_ACTIONS.map((action) => ({
    action,
    cost:
      action === 'view_profile'
        ? (policy?.costPerProfile ?? 0)
        : action === 'reopen_profile'
          ? (policy?.costPerReopen ?? 0)
          : action === 'view_applicant'
            ? (policy?.costPerApplicant ?? 0)
            : action === 'contact_potential'
              ? (policy?.costPerContactPotential ?? 0)
              : action === 'contact_applicant'
                ? (policy?.costPerContactApplicant ?? 0)
                : (policy?.costPerMatchSummary ?? 0),
    isActive: true,
  }));
}

function emptyForm(policy?: BillingCreditPolicyView | null): FormState {
  return {
    code: '',
    name: '',
    description: '',
    priceVnd: '0',
    billingUnit: 'per_jd',
    durationDays: 30,
    jobPostQuota: null,
    creditQuota: null,
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
    features: [],
    actionCosts: costsFromPolicy(policy),
  };
}

function costOf(plan: BillingPlatformPlanView, action: AdminPlanActionCostItem['action']): number {
  return plan.actionCosts.find((c) => c.action === action && c.isActive)?.cost ?? 0;
}

const UNIT_LABEL: Record<'per_jd' | 'per_month', string> = {
  per_jd: '/ JD',
  per_month: '/ tháng',
};

export function AdminBillingPlatformPlans() {
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-billing-platform-plans'],
    queryFn: () => fetchAdminPlatformPlans(true),
  });
  const { data: pub } = useQuery({
    queryKey: ['billing-public-config'],
    queryFn: fetchPublicBillingConfig,
  });

  const [editing, setEditing] = useState<FormState | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const createM = useMutation({
    mutationFn: (body: AdminCreatePlatformPlanRequest) => createAdminPlatformPlan(body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã tạo gói mới.' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-billing-platform-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminUpdatePlatformPlanRequest }) =>
      updateAdminPlatformPlan(id, body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã cập nhật gói.' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-billing-platform-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAdminPlatformPlan(id),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã tắt gói.' });
      qc.invalidateQueries({ queryKey: ['admin-billing-platform-plans'] });
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Tắt thất bại' }),
  });

  const handleSubmit = () => {
    if (!editing) return;
    if (editing.id) {
      const body: AdminUpdatePlatformPlanRequest = {
        name: editing.name,
        description: editing.description,
        priceVnd: editing.priceVnd,
        billingUnit: editing.billingUnit,
        durationDays: editing.durationDays,
        jobPostQuota: editing.jobPostQuota,
        creditQuota: editing.creditQuota,
        sortOrder: editing.sortOrder,
        isActive: editing.isActive,
        isFeatured: editing.isFeatured,
        features: editing.features,
        actionCosts: editing.actionCosts,
      };
      updateM.mutate({ id: editing.id, body });
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
              Pricing · Tầng 1
            </p>
            <h1 className="cms-page-title mt-1.5">Gói nền tảng</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              5 gói tuyển dụng: Khám phá, Tin đăng, Tin đăng Plus, Doanh nghiệp, Enterprise.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5"
              onClick={() => qc.invalidateQueries({ queryKey: ['admin-billing-platform-plans'] })}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => setEditing(emptyForm(pub?.creditPolicy))}
            >
              <Plus className="h-3.5 w-3.5" /> Tạo gói
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
            {banner.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {banner.text}
            <button type="button" className="ml-auto" onClick={() => setBanner(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="admin-dash-skel h-20" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(plans ?? []).map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                currency={pub?.currency}
                onEdit={() => {
                  setEditing({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    description: p.description ?? '',
                    priceVnd: p.priceVnd,
                    billingUnit: p.billingUnit,
                    durationDays: p.durationDays ?? undefined,
                    jobPostQuota: p.jobPostQuota ?? undefined,
                    creditQuota: p.creditQuota ?? undefined,
                    sortOrder: p.sortOrder,
                    isActive: p.isActive,
                    isFeatured: p.isFeatured,
                    features: p.features,
                    actionCosts: BILLING_PLAN_BILLABLE_ACTIONS.map((action) => ({
                      action,
                      cost: costOf(p, action),
                      isActive: true,
                    })),
                  });
                }}
                onDelete={() => {
                  if (confirm(`Tắt gói "${p.name}"?`)) deleteM.mutate(p.id);
                }}
              />
            ))}
            {plans?.length === 0 ? (
              <Card className="p-10 text-center text-sm text-slate-500">Chưa có gói nào.</Card>
            ) : null}
          </div>
        )}

        {/* Edit modal */}
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

function PlanRow({
  plan,
  currency,
  onEdit,
  onDelete,
}: {
  plan: BillingPlatformPlanView;
  currency?: import('@industriallink/contracts').BillingCurrencyDisplay;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={clsx(
        'admin-dash-card flex flex-wrap items-center gap-3 p-4',
        !plan.isActive && 'opacity-50'
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#072348] text-white">
        <Package className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-900">{plan.name}</h3>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
            {plan.code}
          </code>
          {plan.isFeatured ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
          {!plan.isActive ? (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              TẮT
            </span>
          ) : null}
        </div>
        {plan.description ? <p className="mt-0.5 text-xs text-slate-500">{plan.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span>
            Thời hạn: <strong>{plan.durationDays ?? '∞'}</strong> ngày
          </span>
          <span>
            JD: <strong>{plan.jobPostQuota ?? '∞'}</strong>
          </span>
          <span>
            Credit: <strong>{plan.creditQuota ?? '—'}</strong>
          </span>
          <span>
            Mở hồ sơ: <strong>{costOf(plan, 'view_profile')}</strong> cr
          </span>
          <span>
            Sort: <strong>{plan.sortOrder}</strong>
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold tabular-nums text-[#072348]">
          {currency ? formatPriceVnd(plan.priceVnd, currency) : `${plan.priceVnd}₫`}
          <span className="ml-1 text-[11px] font-medium text-slate-400">
            {UNIT_LABEL[plan.billingUnit]}
          </span>
        </p>
        {currency ? (
          <p className="text-[10px] text-slate-400">{formatReferenceUsd(plan.priceVnd, currency)}</p>
        ) : null}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
          title="Sửa"
        >
          <Edit3 className="h-4 w-4" />
        </button>
        {plan.isActive ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            title="Tắt"
          >
            <Power className="h-4 w-4" />
          </button>
        ) : null}
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
}: {
  form: FormState;
  setForm: (f: FormState | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const [featuresText, setFeaturesText] = useState((form.features ?? []).join('\n'));
  useEffect(() => {
    setFeaturesText((form.features ?? []).join('\n'));
  }, [form.id]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {form.id ? 'Sửa gói' : 'Tạo gói mới'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã (code)" description="IN HOA, snake_case">
            <Input
              value={form.code}
              onChange={(e) => update('code', e.target.value.toUpperCase())}
              disabled={!!form.id}
              placeholder="VD: TIN_DANG"
            />
          </Field>
          <Field label="Tên hiển thị">
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Tin đăng" />
          </Field>
          <Field label="Giá (VND)" description="Integer; 0 = miễn phí/báo giá">
            <Input
              value={form.priceVnd.toString()}
              onChange={(e) => update('priceVnd', e.target.value)}
              placeholder="1225000"
            />
          </Field>
          <Field label="Đơn vị giá">
            <Select
              value={form.billingUnit}
              onChange={(e) => update('billingUnit', e.target.value as 'per_jd' | 'per_month')}
            >
              <option value="per_jd">Theo JD</option>
              <option value="per_month">Theo tháng</option>
            </Select>
          </Field>
          <Field label="Thời hạn (ngày)" description="Để trống = không giới hạn">
            <Input
              type="number"
              value={form.durationDays ?? ''}
              onChange={(e) =>
                update('durationDays', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Quota JD" description="Để trống = unlimited">
            <Input
              type="number"
              value={form.jobPostQuota ?? ''}
              onChange={(e) =>
                update('jobPostQuota', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Credit quota" description="Số lượt mở hồ sơ tặng kèm; trống = theo HĐ">
            <Input
              type="number"
              value={form.creditQuota ?? ''}
              onChange={(e) =>
                update('creditQuota', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Thứ tự hiển thị">
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

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">Credit / lượt thao tác</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Áp dụng khi công ty được gán gói này. Để 0 = miễn phí. Thiếu dòng thì fallback policy
            global.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {BILLING_PLAN_BILLABLE_ACTIONS.map((action) => {
              const current = (form.actionCosts ?? []).find((c) => c.action === action);
              const value = current?.cost ?? 0;
              return (
                <Field key={action} label={BILLING_PLAN_ACTION_LABELS[action]}>
                  <Input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => {
                      const cost = Math.max(0, Number(e.target.value) || 0);
                      const next = BILLING_PLAN_BILLABLE_ACTIONS.map((a) => {
                        const existing = (form.actionCosts ?? []).find((c) => c.action === a);
                        return {
                          action: a,
                          cost: a === action ? cost : (existing?.cost ?? 0),
                          isActive: true,
                        };
                      });
                      update('actionCosts', next);
                    }}
                  />
                </Field>
              );
            })}
          </div>
        </div>

        <Field
          label="Quyền / tính năng"
          description="Mỗi dòng 1 mục. Hiển thị trên trang bảng giá."
          className="mt-3"
        >
          <Textarea
            rows={4}
            value={featuresText}
            onChange={(e) => {
              setFeaturesText(e.target.value);
              update(
                'features',
                e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
              );
            }}
            placeholder={'10 lượt mở hồ sơ tiềm năng\nQuản lý ứng viên'}
          />
        </Field>

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
            Nổi bật (highlight trên UI)
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
