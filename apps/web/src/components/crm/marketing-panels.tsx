'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Flag, Radio } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CrmCampaignStatus, CrmCampaignView, CrmMarketingChannelGroup } from '@industriallink/contracts';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmSelect } from '@/components/crm/fields';
import { errorText, formatVnd } from '@/components/crm/format';
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

  return (
    <CrmFrame
      kicker="Kênh, chiến dịch và khoản đã chi"
      title="Quản lý marketing"
      description="Sale tạo chiến dịch của mình và gắn cơ hội. SuperAdmin đặt ngân sách và ghi chi phí. Chưa tính doanh thu ở màn này."
      footnote="Không tạo đơn, không bật gói và không cộng hoa hồng vào chi phí."
    >
      {marketing.isLoading ? <CrmEmpty>Đang tải marketing…</CrmEmpty> : null}
      {marketing.isError ? <CrmEmpty>Không tải được marketing.</CrmEmpty> : null}
      {data ? (
        <CrmCardGrid columns={3}>
          <CrmCard tone="violet" icon={<Flag className="h-5 w-5" />} title={`${data.activeCount} chiến dịch đang chạy`} text={`${data.campaignCount} chiến dịch trong sổ.`} />
          <CrmCard tone="sky" icon={<Radio className="h-5 w-5" />} title={money(data.budgetVnd === '0' && data.campaignCount === 0 ? null : data.budgetVnd)} text="Ngân sách các chiến dịch chưa hủy." />
          <CrmCard tone="orange" icon={<CircleDollarSign className="h-5 w-5" />} title={formatVnd(data.spentVnd)} text="Đã chi. Không gồm hoa hồng cộng tác viên." />
        </CrmCardGrid>
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
