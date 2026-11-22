'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Save,
  Shield,
  Webhook,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AdminBillingOrderView,
  BillingPaymentSettingView,
  PaymentMode,
  UpdatePaymentSettingsRequest,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError, getApiBase } from '@/lib/api';
import {
  cancelAdminBillingOrder,
  confirmAdminBankOrder,
  fetchAdminBillingOrders,
  fetchAdminPaymentSettings,
  updateAdminPaymentSettings,
} from '@/lib/admin-billing';

const VN_BANKS: Array<{ bin: string; name: string }> = [
  { bin: '970422', name: 'MB Bank (Ngân hàng Quân đội)' },
  { bin: '970436', name: 'Vietcombank (VCB)' },
  { bin: '970416', name: 'ACB (Ngân hàng Á Châu)' },
  { bin: '970407', name: 'Techcombank (TCB)' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970443', name: 'SHB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970426', name: 'MSB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970405', name: 'Agribank' },
];

export function AdminBillingPayment() {
  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
            Pricing · Thanh toán
          </p>
          <h1 className="cms-page-title mt-1.5">Cấu hình thanh toán &amp; Đối soát</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Thiết lập tài khoản ngân hàng công ty (VietQR / NAPAS 247 + SePay/Casso tự động), Stripe quốc tế hoặc Mock test.
          </p>
        </div>

        <PaymentForm />
        <AdminBankOrdersSection />
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
  const [mode, setMode] = useState<PaymentMode>(data.mode);
  const [successUrl, setSuccessUrl] = useState(data.successUrl);
  const [cancelUrl, setCancelUrl] = useState(data.cancelUrl);
  const [pk, setPk] = useState('');
  const [sk, setSk] = useState('');
  const [wh, setWh] = useState('');
  const [showSk, setShowSk] = useState(false);
  const [showWh, setShowWh] = useState(false);
  const [bankBin, setBankBin] = useState(data.bankBin ?? '970422');
  const [bankName, setBankName] = useState(data.bankName ?? 'MB Bank (Ngân hàng Quân đội)');
  const [bankAccountNumber, setBankAccountNumber] = useState(data.bankAccountNumber ?? '');
  const [bankAccountName, setBankAccountName] = useState(data.bankAccountName ?? '');
  const [bankBranch, setBankBranch] = useState(data.bankBranch ?? '');
  const [transferPrefix, setTransferPrefix] = useState(data.transferPrefix ?? 'INLINK');
  const [bankTransferNote, setBankTransferNote] = useState(data.bankTransferNote ?? '');
  const [bankWh, setBankWh] = useState('');
  const [showBankWh, setShowBankWh] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
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
      setBankWh('');
      if (v.bankBin) setBankBin(v.bankBin);
      if (v.bankName) setBankName(v.bankName);
      setBankAccountNumber(v.bankAccountNumber ?? '');
      setBankAccountName(v.bankAccountName ?? '');
      setBankBranch(v.bankBranch ?? '');
      setTransferPrefix(v.transferPrefix ?? 'INLINK');
      setBankTransferNote(v.bankTransferNote ?? '');
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
      bankBin: bankBin.trim() || null,
      bankName: bankName.trim() || null,
      bankAccountNumber: bankAccountNumber.trim() || null,
      bankAccountName: bankAccountName.trim() || null,
      bankBranch: bankBranch.trim() || null,
      transferPrefix: transferPrefix.trim() || 'INLINK',
      bankTransferNote: bankTransferNote.trim() || null,
    };
    if (pk.trim()) body.stripePublishableKey = pk.trim();
    if (sk.trim()) body.stripeSecretKey = sk.trim();
    if (wh.trim()) body.stripeWebhookSecret = wh.trim();
    if (bankWh.trim()) body.bankWebhookSecret = bankWh.trim();
    save.mutate(body);
  };

  const clearKey = (which: 'pk' | 'sk' | 'wh' | 'bankWh') => {
    const body: UpdatePaymentSettingsRequest = {};
    if (which === 'pk') body.stripePublishableKey = null;
    if (which === 'sk') body.stripeSecretKey = null;
    if (which === 'wh') body.stripeWebhookSecret = null;
    if (which === 'bankWh') body.bankWebhookSecret = null;
    save.mutate(body);
  };

  const bankWebhookUrl = `${getApiBase()}/billing/webhooks/bank`;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Card chính */}
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-accent-600" />
          <h2 className="text-sm font-bold text-slate-900">Cấu hình phương thức thanh toán</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Secret key được mã hoá AES-256-GCM trước khi lưu DB. Để trống nếu muốn giữ key cũ.
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

        <div className="mt-4 space-y-4">
          <Field
            label="Chế độ thanh toán"
            description="Khuyến nghị dùng Chuyển khoản ngân hàng / VietQR (LIVE) cho doanh nghiệp Việt Nam."
          >
            <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              <option value="bank_transfer">Chuyển khoản ngân hàng / VietQR (LIVE — B2B Việt Nam)</option>
              <option value="mock">Mock (giả lập test nội bộ)</option>
              <option value="live">Stripe (thẻ quốc tế)</option>
            </Select>
          </Field>

          {mode === 'bank_transfer' ? (
            <Card className="border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900">
              <strong>Chuyển khoản ngân hàng doanh nghiệp (VietQR LIVE):</strong> NTD quét QR hoặc
              chuyển khoản từ tài khoản công ty. Hệ thống hỗ trợ tự động kích hoạt 24/7 qua Webhook
              SePay/Casso hoặc SuperAdmin xác nhận thủ công ngay bên dưới.
            </Card>
          ) : mode === 'live' ? (
            <Card className="border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-900">
              <strong>Stripe Live mode</strong> sẽ gọi Stripe API thật cho thanh toán thẻ quốc tế.
            </Card>
          ) : (
            <Card className="border-blue-200 bg-blue-50/40 p-3 text-xs text-blue-900">
              <strong>Mock mode</strong> hiển thị trang thanh toán giả lập trong app. Click &quot;Thanh toán thành công&quot; để
              cấp gói/credit ngay — không trừ tiền thật.
            </Card>
          )}

          {/* Tài khoản ngân hàng công ty (VietQR) */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#072348]">
              <Building2 className="h-3.5 w-3.5 text-accent-600" />
              Tài khoản ngân hàng công ty nhận tiền (VietQR)
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ngân hàng (BIN VietQR)">
                <Select
                  value={bankBin}
                  onChange={(e) => {
                    const nextBin = e.target.value;
                    setBankBin(nextBin);
                    const found = VN_BANKS.find((b) => b.bin === nextBin);
                    if (found) setBankName(found.name);
                  }}
                >
                  {VN_BANKS.map((b) => (
                    <option key={b.bin} value={b.bin}>
                      {b.name} ({b.bin})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Số tài khoản công ty *">
                <Input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="VD: 012345678900"
                />
              </Field>
              <Field label="Chủ tài khoản (viết hoa không dấu) *">
                <Input
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="VD: CONG TY CO PHAN INLINK"
                />
              </Field>
              <Field label="Chi nhánh (tuỳ chọn)">
                <Input
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="VD: CN Hà Nội"
                />
              </Field>
              <Field label="Tiền tố nội dung chuyển khoản" description="Mã CK sẽ có dạng INLINK123456">
                <Input
                  value={transferPrefix}
                  onChange={(e) => setTransferPrefix(e.target.value.toUpperCase())}
                  placeholder="INLINK"
                />
              </Field>
              <Field label="Ghi chú kế toán / VAT (tuỳ chọn)">
                <Input
                  value={bankTransferNote}
                  onChange={(e) => setBankTransferNote(e.target.value)}
                  placeholder="VD: Hóa đơn GTGT gửi qua email trong 24h"
                />
              </Field>
            </div>

            <div className="border-t border-slate-200/70 pt-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Webhook className="h-3.5 w-3.5 text-accent-600" />
                  Đối soát tự động SePay / Casso (tuỳ chọn)
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(bankWebhookUrl);
                      setCopiedWebhook(true);
                      window.setTimeout(() => setCopiedWebhook(false), 1800);
                    } catch {
                      // ignore
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {copiedWebhook ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-700">Đã copy Webhook URL</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Webhook URL</span>
                    </>
                  )}
                </button>
              </div>
              <p className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200/70 break-all">
                POST {bankWebhookUrl}
              </p>
              <KeyField
                label="Bank Webhook API Key (SePay Apikey / Casso Secure-Token)"
                placeholder="Dán API Key bảo mật từ SePay hoặc Casso…"
                value={bankWh}
                onChange={setBankWh}
                current={data.bankWebhookSecretPreview ?? null}
                onClear={() => clearKey('bankWh')}
                showValue={showBankWh}
                onToggleShow={() => setShowBankWh(!showBankWh)}
                isSecret
              />
            </div>
          </div>

          {/* Keys Stripe (giữ nguyên cho thanh toán thẻ quốc tế) */}
          <div className="rounded-xl bg-slate-50 p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Key className="h-3.5 w-3.5" /> Stripe Keys (tuỳ chọn — khi bật chế độ Stripe)
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-1">
              <KeyField
                label="Publishable Key (pk_*)"
                placeholder="pk_test_… hoặc pk_live_…"
                value={pk}
                onChange={setPk}
                current={data.publishableKeyPreview}
                onClear={() => clearKey('pk')}
                disabled={mode !== 'live'}
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
                disabled={mode !== 'live'}
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
                disabled={mode !== 'live'}
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
            <li>
              • Mode:{' '}
              <strong>
                {data.mode === 'bank_transfer'
                  ? 'Chuyển khoản / VietQR (LIVE)'
                  : data.mode === 'live'
                    ? 'Stripe (Live)'
                    : 'Mock (Test nội bộ)'}
              </strong>
            </li>
            <li>
              • TK Ngân hàng:{' '}
              {data.bankAccountNumber ? `${data.bankName || data.bankBin} · ${data.bankAccountNumber}` : 'Chưa cấu hình'}
            </li>
            <li>• Bank Webhook Key: {data.hasBankWebhookSecret ? 'Đã cấu hình (tự động)' : 'Chưa có (duyệt thủ công)'}</li>
            <li>• Stripe Secret Key: {data.hasSecretKey ? 'Đã cấu hình' : 'Chưa có'}</li>
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

function AdminBankOrdersSection() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<'pending' | 'paid' | 'failed' | 'all'>('pending');
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-billing-orders', statusTab],
    queryFn: () => fetchAdminBillingOrders(statusTab),
  });

  const confirm = useMutation({
    mutationFn: (vars: { id: string; bankReference?: string }) =>
      confirmAdminBankOrder(vars.id, { bankReference: vars.bankReference }),
    onSuccess: async () => {
      setBanner({
        tone: 'ok',
        text: 'Đã xác nhận thanh toán, kích hoạt gói/Credit và ghi nhận hoá đơn CRM.',
      });
      await qc.invalidateQueries({ queryKey: ['admin-billing-orders'] });
    },
    onError: (err) =>
      setBanner({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Xác nhận đơn thất bại.',
      }),
  });

  const cancel = useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      cancelAdminBillingOrder(vars.id, vars.reason),
    onSuccess: async () => {
      setBanner({ tone: 'ok', text: 'Đã huỷ đơn chờ thanh toán.' });
      await qc.invalidateQueries({ queryKey: ['admin-billing-orders'] });
    },
    onError: (err) =>
      setBanner({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Huỷ đơn thất bại.',
      }),
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#072348]">
            Đơn hàng &amp; Đối soát chuyển khoản doanh nghiệp
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Xác nhận thủ công các đơn kế toán chuyển khoản sai mã hoặc theo Ủy nhiệm chi. Dùng chung
            luồng kích hoạt tự động, chống cấp trùng.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'pending', label: 'Chờ thanh toán' },
              { id: 'paid', label: 'Đã thanh toán' },
              { id: 'failed', label: 'Đã huỷ / Lỗi' },
              { id: 'all', label: 'Tất cả' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusTab(t.id)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold transition',
                statusTab === t.id
                  ? 'bg-[#072348] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {banner ? (
        <div
          className={clsx(
            'mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          )}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        {isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ) : orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500">
            Không có đơn hàng nào ở trạng thái này.
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Mã CK / Thời gian</th>
                <th className="py-2 pr-3">Doanh nghiệp &amp; MST</th>
                <th className="py-2 pr-3">Gói dịch vụ</th>
                <th className="py-2 pr-3 text-right">Cần thu (gồm VAT)</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((ord: AdminBillingOrderView) => {
                const payableNum = Number(ord.payableVnd);
                return (
                  <tr key={ord.id} className="align-middle">
                    <td className="py-2.5 pr-3">
                      <p className="font-mono font-bold text-[#072348]">
                        {ord.transferCode || ord.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(ord.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-800">{ord.companyName}</p>
                      <p className="text-[11px] text-slate-500">
                        MST: {ord.companyTaxCode || 'Chưa có'}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-800">
                        {ord.planName ||
                          (ord.kind === 'topup'
                            ? `Top-up ${ord.creditCountSnapshot} Credit`
                            : ord.planCode || 'Gói dịch vụ')}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {ord.provider === 'bank_transfer' ? 'VietQR / CK' : ord.provider}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold text-[#072348]">
                      {Number.isFinite(payableNum)
                        ? `${payableNum.toLocaleString('vi-VN')}đ`
                        : `${ord.payableVnd}đ`}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          ord.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : ord.status === 'pending'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-rose-50 text-rose-700',
                        )}
                      >
                        {ord.status === 'paid'
                          ? 'Đã thanh toán'
                          : ord.status === 'pending'
                            ? 'Chờ thanh toán'
                            : ord.status === 'failed'
                              ? 'Đã huỷ / Lỗi'
                              : 'Đã hoàn'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {ord.status === 'pending' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={confirm.isPending || cancel.isPending}
                            onClick={() => {
                              const ref = window.prompt(
                                `Xác nhận đã nhận ${Number.isFinite(payableNum) ? `${payableNum.toLocaleString('vi-VN')}đ` : ord.payableVnd} từ ${ord.companyName}?\nNhập mã giao dịch ngân hàng / UNC (tuỳ chọn):`,
                                '',
                              );
                              if (ref === null) return;
                              setBanner(null);
                              confirm.mutate({ id: ord.id, bankReference: ref || undefined });
                            }}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Xác nhận đã nhận tiền
                          </button>
                          <button
                            type="button"
                            disabled={confirm.isPending || cancel.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Huỷ đơn chờ thanh toán của ${ord.companyName}?`,
                                )
                              ) {
                                return;
                              }
                              setBanner(null);
                              cancel.mutate({ id: ord.id });
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          >
                            Huỷ
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {ord.paidAt ? new Date(ord.paidAt).toLocaleDateString('vi-VN') : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
