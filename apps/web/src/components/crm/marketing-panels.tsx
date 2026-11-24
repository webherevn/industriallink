'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleDollarSign, Copy, Flag, Radio, TrendingUp } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CrmCampaignStatus, CrmCampaignView, CrmMarketingChannelGroup } from '@industriallink/contracts';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmSelect } from '@/components/crm/fields';
import { errorText, formatVnd } from '@/components/crm/format';
import { BRAND_RECRUITER_SITE_URL } from '@/lib/brand';
import { fetchCrmOwners } from '@/lib/crm';
import {
  createCrmCampaign,
  createCrmMarketingChannel,
  createCrmMarketingCost,
  deleteCrmMarketingCost,
  fetchCrmMarketing,
  updateCrmCampaign,
  updateCrmMarketingChannel,
} from '@/lib/crm';

const STATUS: Array<{ value: CrmCampaignStatus; label: string }> = [
  { value: 'draft', label: 'Nháp' },
  { value: 'active', label: 'Đang chạy' },
  { value: 'ended', label: 'Đã kết thúc' },
  { value: 'cancelled', label: 'Đã hủy' },
];

function statusLabel(status: CrmCampaignStatus): string {
  return STATUS.find((item) => item.value === status)?.label ?? status;
}

function groupLabel(group: CrmMarketingChannelGroup): string {
  return group === 'social' ? 'Social' : 'Sở hữu';
}

function money(value: string | null): string {
  if (!value) return 'Chưa đặt';
  return formatVnd(value);
}

function useMarketing() {
  return useQuery({ queryKey: ['crm-marketing'], queryFn: fetchCrmMarketing });
}

export function CrmMarketingHomePanel() {
  const marketing = useMarketing();
  const data = marketing.data;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function buildUtmLink(c: CrmCampaignView): string {
    const qs = new URLSearchParams({
      utm_source: c.channelCode || 'web',
      utm_medium: c.channelGroup === 'social' ? 'paid_social' : 'owned',
      utm_campaign: c.campaignCode,
    });
    return `${BRAND_RECRUITER_SITE_URL}/bang-gia?${qs.toString()}`;
  }

  function copyUtm(c: CrmCampaignView) {
    void navigator.clipboard?.writeText(buildUtmLink(c)).then(() => {
      setCopiedId(c.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === c.id ? null : cur)), 2000);
    });
  }

  return (
    <CrmFrame
      kicker="Kênh, chiến dịch & Hiệu quả ROI"
      title="Quản lý Marketing · UTM → ROAS & CAC"
      description="Theo dõi chi phí quảng cáo, doanh thu chưa VAT mang về từ các chiến dịch, chỉ số ROAS/CAC và sao chép nhanh link UTM chuẩn để chạy Ads."
      footnote="Doanh thu tính từ đơn hàng đã thanh toán (chưa VAT) của doanh nghiệp gắn với chiến dịch. Không cộng hoa hồng CTV vào chi phí Ads."
    >
      {marketing.isLoading ? <CrmEmpty>Đang tải marketing…</CrmEmpty> : null}
      {marketing.isError ? <CrmEmpty>Không tải được marketing.</CrmEmpty> : null}
      {data ? (
        <div className="space-y-5">
          <CrmCardGrid columns={4}>
            <CrmCard
              tone="sky"
              icon={<Flag className="h-5 w-5" />}
              title={`${data.activeCount} đang chạy`}
              text={`${data.campaignCount} chiến dịch · ${data.totalLeadCount ?? 0} Lead gắn nguồn.`}
            />
            <CrmCard
              tone="orange"
              icon={<CircleDollarSign className="h-5 w-5" />}
              title={formatVnd(data.spentVnd)}
              text={`Chi phí đã chi · Ngân sách ${money(data.budgetVnd === '0' && data.campaignCount === 0 ? null : data.budgetVnd)}.`}
            />
            <CrmCard
              tone="green"
              icon={<Radio className="h-5 w-5" />}
              title={formatVnd(data.totalRevenueVnd ?? '0')}
              text={`Doanh thu chưa VAT · ${data.totalPaidCustomers ?? 0} DN đã thanh toán.`}
            />
            <CrmCard
              tone="violet"
              icon={<TrendingUp className="h-5 w-5" />}
              title={data.overallRoas != null ? `ROAS ${data.overallRoas.toFixed(2)}x` : 'ROAS —'}
              text={`CAC: ${data.overallCacVnd ? formatVnd(data.overallCacVnd) : 'Chưa có đơn trả phí'}.`}
            />
          </CrmCardGrid>

          <section className="overflow-hidden rounded-2xl border border-[#DCE6F4] bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-[#072348]/[0.03] px-5 py-3.5">
              <div>
                <h2 className="text-sm font-bold text-[#072348]">
                  Hiệu quả chiến dịch (UTM → Lead → Doanh thu · CAC · ROAS)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Bấm «Copy link UTM» để gắn trực tiếp vào quảng cáo Facebook, Google, LinkedIn, Zalo.
                </p>
              </div>
            </div>

            {data.campaigns.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-500">
                Chưa có chiến dịch nào. Vào mục <strong>Chiến dịch</strong> để tạo chiến dịch mới.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Chiến dịch</th>
                      <th className="px-3 py-3">Kênh</th>
                      <th className="px-3 py-3 text-right">Lead / DN trả phí</th>
                      <th className="px-3 py-3 text-right">Chi phí</th>
                      <th className="px-3 py-3 text-right">Doanh thu</th>
                      <th className="px-3 py-3 text-right">CAC</th>
                      <th className="px-3 py-3 text-right">ROAS</th>
                      <th className="px-4 py-3 text-right">Link UTM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.campaigns.map((c) => {
                      const roas = c.roas ?? null;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#072348]">{c.name}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                              {c.campaignCode} · {statusLabel(c.status)}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{c.channelName}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-700">
                            {c.leadCount ?? 0} /{' '}
                            <span className="font-bold text-emerald-700">
                              {c.paidCustomerCount ?? 0}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                            {formatVnd(c.spentVnd)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#072348]">
                            {formatVnd(c.revenueVnd ?? '0')}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {c.cacVnd ? formatVnd(c.cacVnd) : '—'}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {roas != null ? (
                              <span
                                className={
                                  roas >= 3
                                    ? 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700'
                                    : roas >= 1
                                      ? 'inline-flex rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800'
                                      : 'inline-flex rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-700'
                                }
                              >
                                {roas.toFixed(2)}x
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => copyUtm(c)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#072348]/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#072348] transition hover:border-[#E8872A] hover:text-[#E8872A]"
                            >
                              {copiedId === c.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Đã sao chép
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy link UTM
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </CrmFrame>
  );
}

export function CrmCampaignsPanel() {
  const marketing = useMarketing();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [status, setStatus] = useState<CrmCampaignStatus>('draft');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [budgetVnd, setBudgetVnd] = useState('');
  const [note, setNote] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSpend = marketing.data?.canManageSpend === true;
  const owners = useQuery({ queryKey: ['crm-owners'], queryFn: fetchCrmOwners, enabled: canSpend });
  const channels = (marketing.data?.channels ?? []).filter((channel) => channel.isActive || channel.id === channelId);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        channelId,
        status,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        note: note || null,
        ...(canSpend ? { budgetVnd: budgetVnd || null, ownerUserId: ownerUserId || null } : {}),
      };
      return editingId ? updateCrmCampaign(editingId, body) : createCrmCampaign(body);
    },
    onSuccess: (overview) => {
      qc.setQueryData(['crm-marketing'], overview);
      setName('');
      setChannelId('');
      setStatus('draft');
      setStartsOn('');
      setEndsOn('');
      setBudgetVnd('');
      setNote('');
      setOwnerUserId('');
      setEditingId(null);
      setError(null);
    },
    onError: (err) => setError(errorText(err, 'Không lưu được chiến dịch')),
  });

  function edit(row: CrmCampaignView) {
    setEditingId(row.id);
    setName(row.name);
    setChannelId(row.channelId);
    setStatus(row.status);
    setStartsOn(row.startsOn ?? '');
    setEndsOn(row.endsOn ?? '');
    setBudgetVnd(row.budgetVnd ?? '');
    setNote(row.note ?? '');
    setOwnerUserId(row.ownerUserId);
    setError(null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <CrmFrame
      kicker="Một đợt, một kênh chính"
      title="Chiến dịch"
      description="Nháp, đang chạy, đã kết thúc hoặc đã hủy. Ngân sách là số dự chi, chưa phải khoản đã chi."
      footnote="Tạo chiến dịch không tạo đơn và không bật gói."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2">
        <input className={crmFieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên chiến dịch" required />
        <CrmSelect
          value={channelId}
          required
          placeholder="Chọn kênh"
          options={channels.map((channel) => ({ value: channel.id, label: `${channel.name} · ${groupLabel(channel.group)}` }))}
          onChange={setChannelId}
        />
        <CrmSelect value={status} placeholder="Trạng thái" options={STATUS} onChange={(value) => setStatus(value as CrmCampaignStatus)} />
        <input className={crmFieldClass} type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} aria-label="Ngày bắt đầu" />
        <input className={crmFieldClass} type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} aria-label="Ngày kết thúc" />
        {canSpend ? (
          <input className={crmFieldClass} inputMode="numeric" value={budgetVnd} onChange={(event) => setBudgetVnd(event.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="Ngân sách VND" />
        ) : null}
        {canSpend ? (
          <CrmSelect
            value={ownerUserId}
            placeholder="Người phụ trách"
            options={(owners.data ?? []).map((owner) => ({ value: owner.id, label: owner.name }))}
            onChange={setOwnerUserId}
          />
        ) : null}
        <input className={crmFieldClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú" maxLength={500} />
        <button type="submit" className={crmButtonClass} disabled={save.isPending || !channelId}>
          {save.isPending ? 'Đang lưu…' : editingId ? 'Lưu chiến dịch' : 'Tạo chiến dịch'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {marketing.isLoading ? <CrmEmpty>Đang tải chiến dịch…</CrmEmpty> : null}
      {marketing.isError ? <CrmEmpty>Không tải được chiến dịch.</CrmEmpty> : null}
      {marketing.data && marketing.data.campaigns.length === 0 ? <CrmEmpty>Chưa có chiến dịch.</CrmEmpty> : null}
      {marketing.data && marketing.data.campaigns.length > 0 ? (
        <CrmCardGrid columns={3}>
          {marketing.data.campaigns.map((row) => (
            <CrmCard
              key={row.id}
              tone={row.status === 'active' ? 'green' : row.status === 'cancelled' ? 'rose' : 'violet'}
              icon={<Flag className="h-5 w-5" />}
              title={row.name}
              text={`${row.channelName} · ${groupLabel(row.channelGroup)}. ${statusLabel(row.status)}.`}
              meta={`${row.campaignCode} · ${row.ownerName} · Ngân sách ${money(row.budgetVnd)} · Đã chi ${formatVnd(row.spentVnd)}`}
            >
              <button type="button" className={`${crmActionClass} mt-4`} onClick={() => edit(row)}>Sửa</button>
            </CrmCard>
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}

export function CrmChannelsPanel() {
  const marketing = useMarketing();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<CrmMarketingChannelGroup>('social');
  const [error, setError] = useState<string | null>(null);
  const canSpend = marketing.data?.canManageSpend === true;

  const save = useMutation({
    mutationFn: () => createCrmMarketingChannel({ name, group }),
    onSuccess: (overview) => {
      qc.setQueryData(['crm-marketing'], overview);
      setName('');
      setError(null);
    },
    onError: (err) => setError(errorText(err, 'Không thêm được kênh')),
  });
  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => updateCrmMarketingChannel(input.id, { isActive: input.isActive }),
    onSuccess: (overview) => qc.setQueryData(['crm-marketing'], overview),
    onError: (err) => setError(errorText(err, 'Không đổi được kênh')),
  });

  return (
    <CrmFrame
      kicker="Mỗi mạng là một kênh"
      title="Kênh"
      description="Web, Zalo, sự kiện, cộng tác viên và các mạng social. Kênh tắt không dùng cho chiến dịch mới."
      footnote="Chưa nối API. Chi phí kênh chưa nối thì nhập tay."
    >
      {canSpend ? (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
          className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-[1fr_220px_auto]"
        >
          <input className={crmFieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên kênh mới" required />
          <CrmSelect
            value={group}
            options={[{ value: 'social', label: 'Social' }, { value: 'owned', label: 'Sở hữu' }]}
            onChange={(value) => setGroup(value as CrmMarketingChannelGroup)}
          />
          <button type="submit" className={crmButtonClass} disabled={save.isPending}>{save.isPending ? 'Đang lưu…' : 'Thêm kênh'}</button>
        </form>
      ) : null}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {marketing.isLoading ? <CrmEmpty>Đang tải kênh…</CrmEmpty> : null}
      {marketing.isError ? <CrmEmpty>Không tải được kênh.</CrmEmpty> : null}
      {marketing.data ? (
        <CrmCardGrid>
          {marketing.data.channels.map((channel) => (
            <CrmCard
              key={channel.id}
              tone={channel.isActive ? 'sky' : 'rose'}
              icon={<Radio className="h-5 w-5" />}
              title={channel.name}
              text={`${groupLabel(channel.group)}. ${channel.isActive ? 'Đang dùng' : 'Đang tắt'}.`}
              meta={channel.code}
            >
              {canSpend ? (
                <button
                  type="button"
                  className={`${crmActionClass} mt-4`}
                  onClick={() => toggle.mutate({ id: channel.id, isActive: !channel.isActive })}
                >
                  {channel.isActive ? 'Tắt kênh' : 'Bật kênh'}
                </button>
              ) : null}
            </CrmCard>
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}

export function CrmCostsPanel() {
  const marketing = useMarketing();
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [spentOn, setSpentOn] = useState('');
  const [amountVnd, setAmountVnd] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canSpend = marketing.data?.canManageSpend === true;
  const campaigns = marketing.data?.campaigns ?? [];
  const channels = marketing.data?.channels ?? [];

  const save = useMutation({
    mutationFn: () => createCrmMarketingCost({
      campaignId,
      channelId: channelId || null,
      spentOn,
      amountVnd,
      note: note || null,
    }),
    onSuccess: (overview) => {
      qc.setQueryData(['crm-marketing'], overview);
      setAmountVnd('');
      setNote('');
      setError(null);
    },
    onError: (err) => setError(errorText(err, 'Không ghi được chi phí')),
  });
  const remove = useMutation({
    mutationFn: deleteCrmMarketingCost,
    onSuccess: (overview) => qc.setQueryData(['crm-marketing'], overview),
    onError: (err) => setError(errorText(err, 'Không xóa được khoản chi')),
  });

  return (
    <CrmFrame
      kicker="Số đã chi, không phải ngân sách"
      title="Chi phí"
      description="Mỗi khoản ghi ngày, số tiền VND, chiến dịch và kênh. Hoa hồng cộng tác viên không nhập ở đây."
      footnote="Chỉ SuperAdmin ghi và xóa khoản chi."
    >
      {canSpend ? (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate();
          }}
          className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2"
        >
          <CrmSelect
            value={campaignId}
            required
            placeholder="Chọn chiến dịch"
            options={campaigns.map((row) => ({ value: row.id, label: `${row.name} · ${row.campaignCode}` }))}
            onChange={(value) => {
              setCampaignId(value);
              const campaign = campaigns.find((row) => row.id === value);
              if (campaign) setChannelId(campaign.channelId);
            }}
          />
          <CrmSelect
            value={channelId}
            placeholder="Kênh của khoản chi"
            options={channels.filter((channel) => channel.isActive).map((channel) => ({ value: channel.id, label: channel.name }))}
            onChange={setChannelId}
          />
          <input className={crmFieldClass} type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} aria-label="Ngày chi" required />
          <input className={crmFieldClass} inputMode="numeric" value={amountVnd} onChange={(event) => setAmountVnd(event.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="Số tiền VND" required />
          <input className={crmFieldClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú" maxLength={500} />
          <button type="submit" className={crmButtonClass} disabled={save.isPending || !campaignId}>{save.isPending ? 'Đang lưu…' : 'Ghi chi phí'}</button>
        </form>
      ) : (
        <p className="text-center text-sm text-slate-500">Bạn xem được khoản chi của chiến dịch mình phụ trách.</p>
      )}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {marketing.isLoading ? <CrmEmpty>Đang tải chi phí…</CrmEmpty> : null}
      {marketing.isError ? <CrmEmpty>Không tải được chi phí.</CrmEmpty> : null}
      {marketing.data && marketing.data.costs.length === 0 ? <CrmEmpty>Chưa có khoản chi.</CrmEmpty> : null}
      {marketing.data && marketing.data.costs.length > 0 ? (
        <CrmCardGrid columns={3}>
          {marketing.data.costs.map((row) => (
            <CrmCard
              key={row.id}
              tone="orange"
              icon={<CircleDollarSign className="h-5 w-5" />}
              title={formatVnd(row.amountVnd)}
              text={`${row.campaignName} · ${row.channelName}`}
              meta={`${row.spentOn} · ${row.campaignCode}${row.note ? ` · ${row.note}` : ''}`}
            >
              {canSpend ? (
                <button
                  type="button"
                  className={`${crmActionClass} mt-4`}
                  onClick={() => {
                    if (window.confirm('Xóa khoản chi này?')) remove.mutate(row.id);
                  }}
                >
                  Xóa khoản này
                </button>
              ) : null}
            </CrmCard>
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
