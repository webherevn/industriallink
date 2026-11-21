'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  History,
  Percent,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type {
  CreateCtvCommissionPolicyRequest,
  CrmCommissionPolicySettingsView,
  CtvCommissionPolicyView,
  CtvCommissionTierCode,
  CtvCommissionTierView,
} from '@industriallink/contracts';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, formatVnd } from '@/components/crm/format';
import {
  createCrmCommissionPolicy,
  fetchCrmCommissionPolicy,
} from '@/lib/crm';

/** Ngày hiệu lực tối thiểu: 30 ngày — không áp dụng hồi tố. */
const MIN_LEAD_DAYS = 30;

const TIER_PRESET: Array<{
  code: CtvCommissionTierCode;
  name: string;
  min: string;
  max: string | null;
  rate: number;
}> = [
  { code: 'BASIC', name: 'Cơ bản', min: '0', max: '10000000', rate: 15 },
  { code: 'SILVER', name: 'Bạc', min: '10000000', max: '30000000', rate: 20 },
  { code: 'GOLD', name: 'Vàng', min: '30000000', max: null, rate: 25 },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Bản nháp',
  SCHEDULED: 'Đã lên lịch',
  ACTIVE: 'Đang áp dụng',
  ARCHIVED: 'Đã thay thế',
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-amber-50 text-amber-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
};

/** Gợi ý ngày hiệu lực: cách hôm nay ít nhất 31 ngày theo giờ địa phương (không bị lệch UTC). */
function defaultEffectiveFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() + 31);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Số ngày từ hôm nay tới ngày hiệu lực. */
function leadDays(effectiveFrom: string): number {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${effectiveFrom}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return -1;
  return Math.round((target - todayUtc) / (24 * 60 * 60 * 1000));
}

/** Định dạng ngày hiệu lực sang dd/MM/yyyy. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function CrmCommissionPanel() {
  const qc = useQueryClient();
  const policy = useQuery({
    queryKey: ['crm-commission-policy'],
    queryFn: fetchCrmCommissionPolicy,
  });
  const [editorOpen, setEditorOpen] = useState(false);

  const active = policy.data?.activePolicy ?? null;
  const canEdit = policy.data?.canEdit === true;

  return (
    <CrmFrame
      kicker="Cài đặt"
      title="Chính sách hoa hồng cộng tác viên"
      description="Ba cấp bậc theo doanh số gói thực thu mỗi tháng. Bậc đạt được áp dụng cho toàn bộ doanh thu hợp lệ trong tháng."
      footnote="Thay đổi chính sách không áp dụng hồi tố cho các giao dịch và kỳ đã phát sinh."
    >
      {policy.isLoading ? <CrmEmpty>Đang tải chính sách hoa hồng…</CrmEmpty> : null}
      {policy.isError ? <CrmEmpty>Không tải được chính sách hoa hồng.</CrmEmpty> : null}

      {policy.data ? (
        <>
          {/* ── Chính sách đang áp dụng ── */}
          <section className="mx-auto w-full max-w-4xl rounded-[22px] bg-white p-6 crm-surface">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Chính sách đang áp dụng
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {active ? active.name : 'Chưa có chính sách'}
                  {active ? (
                    <span className="ml-2 align-middle text-sm font-semibold text-slate-400">
                      Phiên bản {active.version}
                    </span>
                  ) : null}
                </h2>
                {active ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <CalendarClock className="h-4 w-4" />
                    Hiệu lực từ {formatDate(active.effectiveFrom)}
                  </p>
                ) : null}
              </div>
              {active ? (
                <span
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-bold',
                    STATUS_TONE[active.status] ?? 'bg-slate-100 text-slate-600',
                  )}
                >
                  {STATUS_LABEL[active.status] ?? active.status}
                </span>
              ) : null}
            </div>

            {active ? (
              <>
                {/* Bảng 3 cấp bậc */}
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Cấp bậc</th>
                        <th className="px-4 py-3 font-semibold">Doanh số / tháng</th>
                        <th className="px-4 py-3 text-right font-semibold">Tỷ lệ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {active.tiers.map((tier) => (
                        <tr key={tier.code} className="bg-white">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900">{tier.name}</span>
                            <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                              {tier.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{tierRange(tier)}</td>
                          <td className="px-4 py-3 text-right text-base font-bold text-[#4c3ec9]">
                            {tier.ratePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Phạm vi doanh thu áp dụng */}
                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Phạm vi doanh thu áp dụng
                  </p>
                  <ul className="mt-3 space-y-2">
                    <ScopeRow ok={active.includeJobPosting}>
                      Gói Tin đăng <span className="text-slate-500">(mua mới, mua lại, nâng cấp)</span>
                    </ScopeRow>
                    <ScopeRow ok={active.includeHuntPackage}>
                      Gói Tin săn <span className="text-slate-500">(mua mới, mua lại, nâng cấp)</span>
                    </ScopeRow>
                    <ScopeRow ok={active.includeCreditTopup}>
                      Nạp thêm Credit
                      {!active.includeCreditTopup ? (
                        <span className="text-slate-500">
                          {' '}
                          — Không tính hoa hồng &amp; không cộng doanh số xét hạng
                        </span>
                      ) : null}
                    </ScopeRow>
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-slate-200 pt-3 text-xs text-slate-500">
                    <span>
                      Cơ sở tính:{' '}
                      <strong className="font-semibold text-slate-700">
                        {active.excludeVat
                          ? 'Thực thu chưa VAT, sau chiết khấu'
                          : 'Tổng tiền khách chuyển'}
                      </strong>
                    </span>
                    <span>
                      Thời hạn khách hàng:{' '}
                      <strong className="font-semibold text-slate-700">
                        Trọn đời (1 KH – 1 CTV)
                      </strong>
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Chưa có chính sách nào đang áp dụng. SuperAdmin tạo phiên bản đầu tiên bên dưới.
              </p>
            )}
          </section>

          {/* ── Cập nhật / Lên lịch chính sách mới ── */}
          {canEdit ? (
            <section className="mx-auto w-full max-w-4xl rounded-[22px] bg-white p-6 crm-surface">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-900">
                    Cập nhật / Lên lịch chính sách mới
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tạo phiên bản mới với ngưỡng doanh số và tỷ lệ riêng. Bản đang áp dụng giữ nguyên
                    cho đến khi bản mới có hiệu lực.
                  </p>
                </div>
                <button
                  type="button"
                  className={clsx(crmButtonClass, 'inline-flex items-center gap-2')}
                  onClick={() => setEditorOpen((value) => !value)}
                >
                  <Plus className="h-4 w-4" />
                  {editorOpen ? 'Đóng' : 'Lên lịch chính sách mới'}
                </button>
              </div>

              {editorOpen ? (
                <PolicyEditor
                  onDone={() => {
                    setEditorOpen(false);
                    void qc.invalidateQueries({ queryKey: ['crm-commission-policy'] });
                  }}
                />
              ) : null}
            </section>
          ) : (
            <section className="mx-auto w-full max-w-4xl rounded-[22px] bg-white p-6 crm-surface">
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <ShieldCheck className="h-4 w-4" />
                Tài khoản này chỉ xem. SuperAdmin đặt ngưỡng và tỷ lệ trong mục này.
              </p>
            </section>
          )}

          {/* ── Lịch sử phiên bản chính sách ── */}
          <PolicyHistory history={policy.data.history} />
        </>
      ) : null}
    </CrmFrame>
  );
}

/** Dải doanh số của một bậc, dạng văn bản. */
function tierRange(tier: CtvCommissionTierView): string {
  const min = Number(tier.minMonthlyRevenueVnd);
  if (tier.maxMonthlyRevenueVnd === null) {
    return `Từ ${formatVnd(String(min))} trở lên`;
  }
  const max = Number(tier.maxMonthlyRevenueVnd);
  if (min === 0) return `Dưới ${formatVnd(String(max))}`;
  return `${formatVnd(String(min))} – dưới ${formatVnd(String(max))}`;
}

/** Một dòng phạm vi sản phẩm (✓ tính / ✕ không tính). */
function ScopeRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-700">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
      )}
      <span className="font-medium">{children}</span>
    </li>
  );
}

/** Bảng lịch sử phiên bản — vết kiểm toán. */
function PolicyHistory({ history }: { history: CtvCommissionPolicyView[] }) {
  if (history.length === 0) {
    return (
      <section className="mx-auto w-full max-w-4xl">
        <CrmEmpty>Chưa có phiên bản chính sách nào.</CrmEmpty>
      </section>
    );
  }
  return (
    <section className="mx-auto w-full max-w-4xl rounded-[22px] bg-white p-6 crm-surface">
      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
        <History className="h-4 w-4 text-slate-400" />
        Lịch sử phiên bản chính sách
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100">
              <th className="py-2 pr-3 font-semibold">Phiên bản</th>
              <th className="py-2 pr-3 font-semibold">Ngày hiệu lực</th>
              <th className="py-2 pr-3 font-semibold">Cấu hình 3 bậc</th>
              <th className="py-2 pr-3 font-semibold">Phạm vi áp dụng</th>
              <th className="py-2 pr-3 font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="py-3 pr-3">
                  <span className="font-semibold text-slate-900">v{row.version}</span>
                  <span className="ml-2 text-xs text-slate-400">{row.name}</span>
                </td>
                <td className="py-3 pr-3 whitespace-nowrap text-slate-600">
                  {formatDate(row.effectiveFrom)}
                </td>
                <td className="py-3 pr-3">
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {row.tiers.map((tier) => (
                      <li key={tier.code}>
                        <span className="font-medium text-slate-700">{tier.name}</span>{' '}
                        {tier.minMonthlyRevenueVnd === '0'
                          ? `< ${Number(tier.maxMonthlyRevenueVnd ?? 0).toLocaleString('vi-VN')}đ`
                          : tier.maxMonthlyRevenueVnd === null
                            ? `≥ ${Number(tier.minMonthlyRevenueVnd).toLocaleString('vi-VN')}đ`
                            : `${Number(tier.minMonthlyRevenueVnd).toLocaleString('vi-VN')}–${Number(tier.maxMonthlyRevenueVnd).toLocaleString('vi-VN')}đ`}{' '}
                        → <strong className="text-[#4c3ec9]">{tier.ratePercent}%</strong>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="py-3 pr-3 text-xs text-slate-600">
                  <ScopeInline ok={row.includeJobPosting}>Tin đăng</ScopeInline>
                  <ScopeInline ok={row.includeHuntPackage}>Tin săn</ScopeInline>
                  <ScopeInline ok={row.includeCreditTopup}>Nạp Credit</ScopeInline>
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-[11px] font-bold',
                      STATUS_TONE[row.status] ?? 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScopeInline({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'mr-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600',
      )}
    >
      {ok ? '✓' : '✕'} {children}
    </span>
  );
}

/** Form tạo phiên bản chính sách mới (chỉ SuperAdmin). */
function PolicyEditor({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('Chính sách hoa hồng CTV Inlink');
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom());
  const [tiers, setTiers] = useState(TIER_PRESET);
  const [includeJobPosting, setIncludeJobPosting] = useState(true);
  const [includeHuntPackage, setIncludeHuntPackage] = useState(true);
  const [includeCreditTopup, setIncludeCreditTopup] = useState(false);
  const [excludeVat, setExcludeVat] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const lead = leadDays(effectiveFrom);
  const leadOk = lead >= MIN_LEAD_DAYS;

  /** Kiểm tra khoảng doanh số liên tục, không chồng chéo, không đứt quãng. */
  const tierError = useMemo(() => validateTierRanges(tiers), [tiers]);

  const create = useMutation({
    mutationFn: (body: CreateCtvCommissionPolicyRequest) => createCrmCommissionPolicy(body),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      onDone();
    },
    onError: (err) => {
      setSaved(false);
      setError(errorText(err, 'Không lưu được chính sách'));
    },
  });

  function updateTier(index: number, patch: Partial<(typeof TIER_PRESET)[number]>) {
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
    setSaved(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (!leadOk) {
      setError(`Ngày hiệu lực phải sau ít nhất ${MIN_LEAD_DAYS} ngày kể từ hôm nay.`);
      return;
    }
    if (tierError) {
      setError(tierError);
      return;
    }
    setError(null);
    create.mutate({
      name: name.trim(),
      effectiveFrom,
      tiers: tiers.map((tier) => ({
        code: tier.code,
        name: tier.name,
        minMonthlyRevenueVnd: tier.min,
        maxMonthlyRevenueVnd: tier.max,
        ratePercent: tier.rate,
      })),
      includeJobPosting,
      includeHuntPackage,
      includeCreditTopup,
      excludeVat,
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-5 border-t border-slate-100 pt-5">
      {/* Tên + ngày hiệu lực */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Tên chính sách</span>
          <input
            className={clsx(crmFieldClass, 'mt-1.5')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Ngày hiệu lực áp dụng</span>
          <input
            type="date"
            className={clsx(crmFieldClass, 'mt-1.5')}
            value={effectiveFrom}
            onChange={(event) => {
              setEffectiveFrom(event.target.value);
              setSaved(false);
            }}
            required
          />
          <span
            className={clsx(
              'mt-1.5 block text-xs',
              leadOk ? 'text-slate-500' : 'font-medium text-rose-600',
            )}
          >
            {leadOk
              ? `Còn ${lead} ngày nữa — tối thiểu ${MIN_LEAD_DAYS} ngày.`
              : `Cần tối thiểu ${MIN_LEAD_DAYS} ngày. Hiện còn ${lead} ngày.`}
          </span>
        </label>
      </div>

      {/* Bảng bậc */}
      <div>
        <p className="text-sm font-medium text-slate-800">Cấp bậc doanh số / tháng</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-3 font-semibold">Cấp bậc</th>
                <th className="py-2 pr-3 font-semibold">Từ (đ)</th>
                <th className="py-2 pr-3 font-semibold">Đến (đ)</th>
                <th className="py-2 pr-semibold font-semibold">Tỷ lệ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tiers.map((tier, index) => (
                <tr key={tier.code}>
                  <td className="py-2 pr-3">
                    <input
                      className={crmFieldClass}
                      value={tier.name}
                      onChange={(event) => updateTier(index, { name: event.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className={crmFieldClass}
                      inputMode="numeric"
                      value={tier.min}
                      onChange={(event) => updateTier(index, { min: event.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className={crmFieldClass}
                      inputMode="numeric"
                      placeholder="Không giới hạn"
                      value={tier.max ?? ''}
                      onChange={(event) =>
                        updateTier(index, {
                          max: event.target.value.trim() === '' ? null : event.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-semibold">
                    <input
                      className={crmFieldClass}
                      inputMode="numeric"
                      min={0}
                      max={50}
                      value={tier.rate}
                      onChange={(event) =>
                        updateTier(index, { rate: Number(event.target.value) })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tierError ? <p className="mt-2 text-sm text-rose-600">{tierError}</p> : null}
      </div>

      {/* Phạm vi sản phẩm */}
      <div>
        <p className="text-sm font-medium text-slate-800">Phạm vi áp dụng</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={includeJobPosting}
            onChange={(value) => {
              setIncludeJobPosting(value);
              setSaved(false);
            }}
            label="Gói Tin đăng"
          />
          <Toggle
            checked={includeHuntPackage}
            onChange={(value) => {
              setIncludeHuntPackage(value);
              setSaved(false);
            }}
            label="Gói Tin săn"
          />
          <Toggle
            checked={includeCreditTopup}
            onChange={(value) => {
              setIncludeCreditTopup(value);
              setSaved(false);
            }}
            label="Nạp thêm Credit (mặc định tắt)"
          />
          <Toggle
            checked={excludeVat}
            onChange={(value) => {
              setExcludeVat(value);
              setSaved(false);
            }}
            label="Doanh thu chưa VAT"
          />
        </div>
      </div>

      {/* Cảnh báo hồi tố */}
      <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Thay đổi chính sách không áp dụng hồi tố cho các giao dịch và kỳ đã phát sinh. Chính sách mới
        chỉ có tác dụng từ ngày hiệu lực.
      </p>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Đã lên lịch chính sách mới.</p> : null}

      <button type="submit" className={crmButtonClass} disabled={create.isPending}>
        {create.isPending ? 'Đang lên lịch…' : 'Lên lịch chính sách mới'}
      </button>
    </form>
  );
}

/** Ô bật/tắt phạm vi sản phẩm. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-[#4c3ec9] focus:ring-[#c4b5fd]"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

/**
 * Kiểm tra dải ngưỡng: bậc đầu từ 0, liên tục, bậc cuối không giới hạn trên,
 * tỷ lệ 0–50.
 */
function validateTierRanges(
  tiers: Array<{ name: string; min: string; max: string | null; rate: number }>,
): string | null {
  if (tiers.length === 0) return 'Cần ít nhất một cấp bậc.';

  const parsed = tiers.map((tier) => ({
    name: tier.name,
    min: Number(tier.min),
    max: tier.max === null || tier.max === '' ? null : Number(tier.max),
    rate: tier.rate,
  }));

  if (parsed.some((tier) => !Number.isFinite(tier.min) || tier.min < 0)) {
    return 'Ngưỡng dưới không hợp lệ.';
  }
  if (parsed.some((tier) => !Number.isInteger(tier.rate) || tier.rate < 0 || tier.rate > 50)) {
    return 'Tỷ lệ phải là số nguyên từ 0% đến 50%.';
  }
  if (parsed[0].min !== 0) return 'Cấp bậc đầu tiên phải bắt đầu từ 0đ.';

  for (const tier of parsed) {
    if (tier.max !== null && tier.max <= tier.min) {
      return `Cấp bậc ${tier.name}: ngưỡng trên phải lớn hơn ngưỡng dưới.`;
    }
  }
  for (let i = 0; i < parsed.length - 1; i += 1) {
    const current = parsed[i];
    const upcoming = parsed[i + 1];
    if (current.max === null) {
      return `Cấp bậc ${current.name} không giới hạn trên nhưng còn cấp bậc ${upcoming.name} phía sau.`;
    }
    if (current.max !== upcoming.min) {
      return `Khoảng doanh số không liên tục giữa ${current.name} và ${upcoming.name}.`;
    }
  }
  if (parsed[parsed.length - 1].max !== null) {
    return 'Cấp bậc cuối cùng phải không giới hạn trên.';
  }
  return null;
}
