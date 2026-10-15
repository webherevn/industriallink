'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, CreditCard, Eye, EyeOff, Key, Loader2, Save, Shield, Webhook, X } from 'lucide-react';
import { useState } from 'react';
import type { BillingPaymentSettingView, UpdatePaymentSettingsRequest } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchAdminPaymentSettings, updateAdminPaymentSettings } from '@/lib/admin-billing';

export function AdminBillingPayment() {
  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Pricing · Thanh toán
          </p>
          <h1 className="cms-page-title mt-1.5">Cổng thanh toán Stripe</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Cấu hình Stripe để Recruiter mua Top-up Credit. Mặc định ở <strong>Mock mode</strong> để test không cần key thật.
          </p>
        </div>

        <PaymentForm />
      </div>
    </AdminShell>
  );
}

function PaymentForm() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-billing-payment-settings'],
    queryFn: fetchAdminPaymentSettings,
  });
  if (isLoading || !data) {
    return <div className="admin-dash-skel h-96" />;
  }
  return <Inner data={data} onSaved={() => qc.invalidateQueries({ queryKey: ['admin-billing-payment-settings'] })} />;
}

function Inner({
  data,
  onSaved,
}: {
  data: BillingPaymentSettingView;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'mock' | 'live'>(data.mode);
  const [successUrl, setSuccessUrl] = useState(data.successUrl);
  const [cancelUrl, setCancelUrl] = useState(data.cancelUrl);
  const [pk, setPk] = useState('');
  const [sk, setSk] = useState('');
  const [wh, setWh] = useState('');
  const [showSk, setShowSk] = useState(false);
  const [showWh, setShowWh] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const save = useMutation({
    mutationFn: (body: UpdatePaymentSettingsRequest) => updateAdminPaymentSettings(body),
    onSuccess: (v) => {
      setBanner({ tone: 'ok', text: 'Đã lưu cấu hình thanh toán.' });
      setMode(v.mode);
      setSuccessUrl(v.successUrl);
      setCancelUrl(v.cancelUrl);
      setPk('');
      setSk('');
      setWh('');
      onSaved();
    },
    onError: (err) =>
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' }),
  });

  const onSubmit = () => {
    const body: UpdatePaymentSettingsRequest = {
      mode,
      successUrl: successUrl.trim(),
      cancelUrl: cancelUrl.trim(),
    };
    // Plaintext key chỉ gửi khi user nhập giá trị mới; null = xoá
    if (pk.trim()) body.stripePublishableKey = pk.trim();
    if (sk.trim()) body.stripeSecretKey = sk.trim();
    if (wh.trim()) body.stripeWebhookSecret = wh.trim();
    save.mutate(body);
  };

  const clearKey = (which: 'pk' | 'sk' | 'wh') => {
    const body: UpdatePaymentSettingsRequest = {};
    if (which === 'pk') body.stripePublishableKey = null;
    if (which === 'sk') body.stripeSecretKey = null;
    if (which === 'wh') body.stripeWebhookSecret = null;
    save.mutate(body);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Card chính */}
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-accent-600" />
          <h2 className="text-sm font-bold text-slate-900">Cấu hình Stripe</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Key được mã hoá AES-256-GCM trước khi lưu DB (giống AI settings). Để trống nếu muốn giữ key cũ.
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

        <div className="mt-4 space-y-3">
          <Field label="Mode" description="Mock = test trong app (không cần Stripe key). Live = Stripe thật.">
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'mock' | 'live')}>
              <option value="mock">Mock (giả lập)</option>
              <option value="live">Live (Stripe thật)</option>
            </Select>
          </Field>

          {mode === 'live' ? (
            <Card className="border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-900">
              <strong>Live mode</strong> sẽ gọi Stripe API thật. Mọi đơn sẽ trừ tiền thật (hoặc dùng test card nếu bạn dùng
              <code className="rounded bg-white px-1 py-0.5">sk_test_…</code>).
            </Card>
          ) : (
            <Card className="border-blue-200 bg-blue-50/40 p-3 text-xs text-blue-900">
              <strong>Mock mode</strong> hiển thị trang thanh toán giả lập trong app. Click &quot;Thanh toán thành công&quot; để
              cấp credit ngay — không cần Stripe key.
            </Card>
          )}

          {/* Keys */}
          <div className="rounded-xl bg-slate-50 p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Key className="h-3.5 w-3.5" /> Stripe Keys
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-1">
              <KeyField
                label="Publishable Key (pk_*)"
                placeholder="pk_test_… hoặc pk_live_…"
                value={pk}
                onChange={setPk}
                current={data.publishableKeyPreview}
                onClear={() => clearKey('pk')}
                disabled={mode === 'mock'}
              />
              <KeyField
                label="Secret Key (sk_*)"
                placeholder="sk_test_… hoặc sk_live_…"
                value={sk}
                onChange={setSk}
                current={data.secretKeyPreview}
                onClear={() => clearKey('sk')}
                showValue={showSk}
                onToggleShow={() => setShowSk(!showSk)}
                disabled={mode === 'mock'}
                isSecret
              />
              <KeyField
                label="Webhook Signing Secret (whsec_*)"
                placeholder="whsec_…"
                value={wh}
                onChange={setWh}
                current={data.webhookSecretPreview}
                onClear={() => clearKey('wh')}
                showValue={showWh}
                onToggleShow={() => setShowWh(!showWh)}
                disabled={mode === 'mock'}
                isSecret
              />
            </div>
          </div>

          {/* URLs */}
          <div className="rounded-xl bg-slate-50 p-3">
            <h3 className="text-xs font-bold text-slate-700">Return URLs</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              URL trong app user được redirect sau khi thanh toán. <code className="rounded bg-white px-1">{'{CHECKOUT_SESSION_ID}'}</code> sẽ
              tự thay bằng session ID.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-1">
              <Field label="Success URL">
                <Input value={successUrl} onChange={(e) => setSuccessUrl(e.target.value)} />
              </Field>
              <Field label="Cancel URL">
                <Input value={cancelUrl} onChange={(e) => setCancelUrl(e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" onClick={onSubmit} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu cấu hình
          </Button>
        </div>
      </Card>

      {/* Sidebar hướng dẫn */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Shield className="h-3.5 w-3.5 text-emerald-600" /> Bảo mật
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
            <li>• Key được mã hoá AES-256-GCM với <code>SETTINGS_ENCRYPTION_KEY</code> (hoặc JWT secret).</li>
            <li>• API chỉ trả về 4 ký tự cuối (preview), không lộ key.</li>
            <li>• Để xoá key: nhập rỗng + bấm &quot;Xoá key&quot;.</li>
          </ul>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Webhook className="h-3.5 w-3.5 text-accent-600" /> Webhook URL
          </div>
          <p className="mt-2 text-[11px] text-slate-600">
            Cấu hình URL dưới đây trong <a className="text-accent-600 underline" href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer">Stripe Dashboard → Webhooks</a>:
          </p>
          <code className="mt-2 block break-all rounded bg-slate-100 p-2 text-[11px] text-slate-800">
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain'}/api/v1/billing/payment/stripe/webhook
          </code>
          <p className="mt-2 text-[10px] text-slate-500">
            Chọn event: <code>checkout.session.completed</code>, <code>payment_intent.payment_failed</code>,{' '}
            <code>checkout.session.expired</code>
          </p>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 p-4 text-[11px] text-amber-900">
          <strong>Trạng thái hiện tại:</strong>
          <ul className="mt-1.5 space-y-1">
            <li>• Mode: <strong>{data.mode === 'live' ? 'Live (Stripe thật)' : 'Mock'}</strong></li>
            <li>• Secret Key: {data.hasSecretKey ? 'Đã cấu hình' : 'Chưa có'}</li>
            <li>• Webhook Secret: {data.hasWebhookSecret ? 'Đã cấu hình' : 'Chưa có'}</li>
            <li>• Cập nhật: {data.updatedAt ? new Date(data.updatedAt).toLocaleString('vi-VN') : '—'}</li>
            {data.updatedByEmail ? <li>• Bởi: {data.updatedByEmail}</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function KeyField({
  label,
  placeholder,
  value,
  onChange,
  current,
  onClear,
  showValue,
  onToggleShow,
  disabled,
  isSecret,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  current: string | null;
  onClear: () => void;
  showValue?: boolean;
  onToggleShow?: () => void;
  disabled?: boolean;
  isSecret?: boolean;
}) {
  return (
    <Field
      label={label}
      description={
        current
          ? `Hiện tại: ${current}. Để trống = giữ nguyên.`
          : 'Chưa cấu hình. Nhập key mới để lưu.'
      }
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={isSecret && !showValue ? 'password' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="font-mono text-[12px]"
            autoComplete="off"
          />
          {isSecret && onToggleShow ? (
            <button
              type="button"
              onClick={onToggleShow}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>
        {current ? (
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={disabled}
            className="shrink-0"
          >
            Xoá key
          </Button>
        ) : null}
      </div>
    </Field>
  );
}
