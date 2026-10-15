'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, Loader2, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AdminUpdateCreditPolicyRequest,
  AdminUpdateCurrencyConfigRequest,
  BillingCreditPolicyView,
  BillingCurrencyDisplay,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  fetchAdminCreditPolicy,
  fetchAdminCurrency,
  updateAdminCreditPolicy,
  updateAdminCurrency,
} from '@/lib/admin-billing';

export function AdminBillingSettings() {
  const qc = useQueryClient();
  const { data: policy, isLoading: polLoading } = useQuery({
    queryKey: ['admin-billing-credit-policy'],
    queryFn: fetchAdminCreditPolicy,
  });
  const { data: currency, isLoading: curLoading } = useQuery({
    queryKey: ['admin-billing-currency'],
    queryFn: fetchAdminCurrency,
  });

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Pricing · Cấu hình
          </p>
          <h1 className="cms-page-title mt-1.5">Policy &amp; tiền tệ</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Quy tắc trừ Credit mặc định (fallback khi công ty chưa gán gói, hoặc gói chưa set cost).
            Cost / quota / thời hạn từng gói chỉnh ở Gói nền tảng — bảng giá đọc trực tiếp từ đó.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {polLoading || !policy ? (
            <div className="admin-dash-skel h-96" />
          ) : (
            <PolicyForm policy={policy} onSaved={() => qc.invalidateQueries({ queryKey: ['admin-billing-credit-policy'] })} />
          )}
          {curLoading || !currency ? (
            <div className="admin-dash-skel h-96" />
          ) : (
            <CurrencyForm currency={currency} onSaved={() => qc.invalidateQueries({ queryKey: ['admin-billing-currency'] })} />
          )}
        </div>

        <Card className="border-rose-200 bg-rose-50/40 p-5">
          <h3 className="text-sm font-bold text-rose-900">10 nguyên tắc V1 — không được phá</h3>
          <ol className="mt-2 grid gap-1 text-[12px] text-rose-900/80 sm:grid-cols-2">
            <li>1. Không biến iLink thành job board đại trà.</li>
            <li>2. Không trở thành headhunter thủ công quá sớm.</li>
            <li>3. Không cho truy cập miễn phí toàn bộ CV ứng viên tiềm năng.</li>
            <li>4. Không thu tiền chỉ để xem tổng số Matching.</li>
            <li>5. Không định giá ứng viên theo % Matching.</li>
            <li>6. Không tiêu Credit với ứng viên đã ứng tuyển.</li>
            <li>7. Một hồ sơ mở một lần = một Credit; mở lại không tính thêm.</li>
            <li>8. Không tự động mua Credit / trừ tiền.</li>
            <li>9. Không trộn phí Săn với Credit.</li>
            <li>10. Giá và quota V1 luôn là giả thuyết cần kiểm chứng.</li>
          </ol>
        </Card>
      </div>
    </AdminShell>
  );
}

function PolicyForm({
  policy,
  onSaved,
}: {
  policy: BillingCreditPolicyView;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AdminUpdateCreditPolicyRequest>({});
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setForm({});
  }, [policy.id]);

  const save = useMutation({
    mutationFn: (body: AdminUpdateCreditPolicyRequest) => updateAdminCreditPolicy(body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã lưu policy.' });
      setForm({});
      onSaved();
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  // V1 defaults from data; only show fields where user changed
  const Field1 = ({
    label,
    k,
    description,
    min = 0,
    max = 10,
  }: {
    label: string;
    k: keyof AdminUpdateCreditPolicyRequest;
    description?: string;
    min?: number;
    max?: number;
  }) => {
    const v = form[k as keyof typeof form] ?? (policy[k as keyof typeof policy] as number);
    return (
      <Field label={label} description={description}>
        <Input
          type="number"
          min={min}
          max={max}
          value={String(v ?? 0)}
          onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
        />
      </Field>
    );
  };

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-slate-900">Quy tắc trừ Credit</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Áp dụng cho mọi tài khoản. Mặc định V1: mở hồ sơ tiềm năng = 1; còn lại = 0.
      </p>

      {banner ? (
        <div
          className={clsx(
            'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {banner.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {banner.text}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field1 label="Mở hồ sơ tiềm năng" k="costPerProfile" description="V1 = 1" min={0} max={10} />
        <Field1 label="Mở lại hồ sơ đã mở" k="costPerReopen" description="V1 = 0" min={0} max={10} />
        <Field1 label="Xem ứng viên đã ứng tuyển" k="costPerApplicant" description="V1 = 0" min={0} max={10} />
        <Field1 label="Liên hệ UV tiềm năng" k="costPerContactPotential" description="V1 = 0" min={0} max={10} />
        <Field1 label="Liên hệ UV chủ động" k="costPerContactApplicant" description="V1 = 0" min={0} max={10} />
        <Field1 label="Xem tổng Matching" k="costPerMatchSummary" description="V1 = 0" min={0} max={10} />
        <Field label="Cảnh báo dưới %" description="Cảnh báo quota khi còn dưới ngưỡng">
          <Input
            type="number"
            min={1}
            max={100}
            value={String(form.warnWhenBelowPercent ?? policy.warnWhenBelowPercent)}
            onChange={(e) => setForm({ ...form, warnWhenBelowPercent: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Switch
          label="Cho phép tự động mua Credit (auto-charge)"
          description="V1 = TẮT (nguyên tắc #8)"
          checked={form.allowAutoPurchase ?? policy.allowAutoPurchase}
          onChange={(v) => setForm({ ...form, allowAutoPurchase: v })}
        />
        <Switch
          label="Cho phép vượt ngân sách"
          description="V1 = TẮT"
          checked={form.allowBudgetOverspend ?? policy.allowBudgetOverspend}
          onChange={(v) => setForm({ ...form, allowBudgetOverspend: v })}
        />
        <Switch
          label="Credit hết hạn khi TK không hoạt động"
          description="V1 = TẮT (đề xuất pháp lý)"
          checked={form.expireWhenInactive ?? policy.expireWhenInactive}
          onChange={(v) => setForm({ ...form, expireWhenInactive: v })}
        />
        <Switch
          label="Cho phép hoàn Credit"
          description="V1 = TẮT (chỉ khi lỗi hệ thống)"
          checked={form.allowRefund ?? policy.allowRefund}
          onChange={(v) => setForm({ ...form, allowRefund: v })}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <Button
          type="button"
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lưu policy
        </Button>
      </div>
    </Card>
  );
}

function CurrencyForm({
  currency,
  onSaved,
}: {
  currency: BillingCurrencyDisplay;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AdminUpdateCurrencyConfigRequest>({});
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setForm({});
  }, [currency.id]);

  const save = useMutation({
    mutationFn: (body: AdminUpdateCurrencyConfigRequest) => updateAdminCurrency(body),
    onSuccess: () => {
      setBanner({ tone: 'ok', text: 'Đã lưu cấu hình tiền tệ.' });
      setForm({});
      onSaved();
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const v = <K extends keyof AdminUpdateCurrencyConfigRequest>(k: K, def: unknown) =>
    (form[k] as unknown) ?? def;

  // Tính USD preview
  const usdPreview = (() => {
    const rateStr = v('usdToVndRateHundredths', currency.usdToVndRateHundredths);
    if (!rateStr) return null;
    try {
      const rate = BigInt(rateStr as string);
      if (rate === 0n) return null;
      // preview: 25,000,000 VND (× 100) / rate = USD×100
      const sample = 25_000_000n;
      const usdHundredths = (sample * 100n) / rate;
      return (Number(usdHundredths) / 100).toFixed(2);
    } catch {
      return null;
    }
  })();

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-slate-900">Hiển thị tiền tệ</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Tất cả giá lưu DB dạng VND integer. Ký hiệu + vị trí + tỉ giá tham chiếu USD chỉ phục vụ hiển thị.
      </p>

      {banner ? (
        <div
          className={clsx(
            'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {banner.tone === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {banner.text}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Mã tiền tệ" description="VND theo yêu cầu thị trường VN">
          <Input
            value={String(v('currencyCode', currency.currencyCode))}
            onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })}
            maxLength={8}
          />
        </Field>
        <Field label="Ký hiệu hiển thị" description='Mặc định "VNĐ"; có thể đổi "đ", "₫", "$"'>
          <Input
            value={String(v('displaySymbol', currency.displaySymbol))}
            onChange={(e) => setForm({ ...form, displaySymbol: e.target.value })}
            maxLength={8}
          />
        </Field>
        <Field label="Vị trí ký hiệu">
          <Select
            value={String(v('symbolBefore', currency.symbolBefore))}
            onChange={(e) => setForm({ ...form, symbolBefore: e.target.value === 'true' })}
          >
            <option value="true">Trước số — $1,225,000</option>
            <option value="false">Sau số — 1,225,000VNĐ</option>
          </Select>
        </Field>
        <Field label="Số chữ số thập phân" description="VND = 0">
          <Input
            type="number"
            min={0}
            max={4}
            value={String(v('decimalDigits', currency.decimalDigits))}
            onChange={(e) => setForm({ ...form, decimalDigits: Number(e.target.value) })}
          />
        </Field>
        <Field label="Phân cách hàng nghìn">
          <Input
            value={String(v('thousandsSeparator', currency.thousandsSeparator))}
            onChange={(e) => setForm({ ...form, thousandsSeparator: e.target.value })}
            maxLength={2}
          />
        </Field>
        <Field label="Dùng phân cách hàng nghìn">
          <Select
            value={String(v('useThousandsSeparator', currency.useThousandsSeparator))}
            onChange={(e) =>
              setForm({ ...form, useThousandsSeparator: e.target.value === 'true' })
            }
          >
            <option value="true">Bật — 1,200,000</option>
            <option value="false">Tắt — 1200000</option>
          </Select>
        </Field>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700">Tham chiếu USD (chỉ hiển thị)</h3>
          <Switch
            label=""
            checked={Boolean(v('showReferenceUsd', currency.showReferenceUsd))}
            onChange={(b) => setForm({ ...form, showReferenceUsd: b })}
          />
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field
            label="Tỉ giá USD↔VND (×100)"
            description="VD: 25,000 VND = 2,500,000"
          >
            <Input
              value={String(v('usdToVndRateHundredths', currency.usdToVndRateHundredths ?? '0'))}
              onChange={(e) => setForm({ ...form, usdToVndRateHundredths: e.target.value })}
            />
          </Field>
          {usdPreview ? (
            <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
              Preview: 25,000,000₫ ≈ <strong>${usdPreview}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lưu cấu hình
        </Button>
      </div>
    </Card>
  );
}

function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-emerald-500' : 'bg-slate-300'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-4' : 'left-0.5'
          )}
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-800">{label}</p>
        {description ? <p className="mt-0.5 text-[10px] text-slate-500">{description}</p> : null}
      </div>
    </label>
  );
}
