'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Building2,
  CheckCircle2,
  Clock,
  Crosshair,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Search,
  Send,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  SOURCING_OUTREACH_STATUS_META,
  type CrmSourcingOutreachItemView,
  type SourcingOutreachStatus,
} from '@industriallink/contracts';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { errorText, formatWhen } from '@/components/crm/format';
import { fetchCrmSourcingOutreach, updateCrmSourcingOutreachStatus } from '@/lib/crm';

const STATUS_KEYS = Object.keys(SOURCING_OUTREACH_STATUS_META) as SourcingOutreachStatus[];

const STATUS_BADGE_TONE: Record<SourcingOutreachStatus, string> = {
  pending_contact: 'bg-slate-100 text-slate-700 ring-slate-200',
  unreachable: 'bg-amber-50 text-amber-800 ring-amber-200',
  awaiting_reply: 'bg-sky-50 text-sky-800 ring-sky-200',
  declined: 'bg-rose-50 text-rose-700 ring-rose-200',
  agreed: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  guided_pending_apply: 'bg-violet-50 text-violet-800 ring-violet-200',
  applied: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export function CrmSourcingOutreachPageView() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [selectedJobItem, setSelectedJobItem] = useState<CrmSourcingOutreachItemView | null>(null);

  const query = useQuery({
    queryKey: ['crm-sourcing-outreach', statusFilter, searchText],
    queryFn: () =>
      fetchCrmSourcingOutreach({
        status: statusFilter,
        q: searchText,
      }),
  });

  const stats = query.data?.stats ?? {
    handedOver: 0,
    pendingContact: 0,
    contacted: 0,
    agreed: 0,
    guided: 0,
    applied: 0,
  };
  const items = query.data?.items ?? [];

  return (
    <CrmFrame
      kicker="Chăm sóc · Gói Săn chuyên sâu"
      title="Bàn giao liên hệ Săn nhân sự"
      description="Danh sách ứng viên tiềm năng do Nhà tuyển dụng bàn giao cho đội ngũ Inlink liên hệ tiếp cận, kết nối và hướng dẫn ứng tuyển. Mọi cập nhật trạng thái tại đây đồng bộ trực tiếp sang bảng KPI Hiệu quả hỗ trợ chuyên sâu của Nhà tuyển dụng."
    >
      {/* Hàng KPI 5 bước chuẩn gói Săn chuyên sâu */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-4 w-4" />
            </span>
            {stats.pendingContact > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                Chờ xử lý: {stats.pendingContact}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">Đã bàn giao</p>
          <p className="mt-1 text-2xl font-extrabold text-[#072348]">{stats.handedOver}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Phone className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">Đã liên hệ</p>
          <p className="mt-1 text-2xl font-extrabold text-sky-700">{stats.contacted}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <UserCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">Đồng ý kết nối</p>
          <p className="mt-1 text-2xl font-extrabold text-violet-700">{stats.agreed}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[#E8872A]">
              <Send className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">Đã hướng dẫn ứng tuyển</p>
          <p className="mt-1 text-2xl font-extrabold text-[#E8872A]">{stats.guided}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">Đã ứng tuyển</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{stats.applied}</p>
        </div>
      </div>

      {/* Bộ lọc trạng thái & Tìm kiếm */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                statusFilter === 'all'
                  ? 'bg-[#072348] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              Tất cả ({stats.handedOver})
            </button>
            {STATUS_KEYS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  statusFilter === st
                    ? 'bg-[#072348] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                title={SOURCING_OUTREACH_STATUS_META[st].description}
              >
                {SOURCING_OUTREACH_STATUS_META[st].label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm ứng viên, SĐT, công ty, tin săn..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#072348] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {query.isLoading ? <CrmEmpty>Đang tải danh sách bàn giao liên hệ…</CrmEmpty> : null}
      {query.isError ? (
        <CrmEmpty>Không tải được danh sách bàn giao liên hệ Săn nhân sự.</CrmEmpty>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <CrmEmpty>
          Chưa có yêu cầu «Giao Inlink liên hệ» nào khớp bộ lọc hiện tại.
        </CrmEmpty>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <OutreachRowCard
              key={`${item.engagementId}-${item.candidateId}`}
              item={item}
              onViewJob={() => setSelectedJobItem(item)}
            />
          ))}
        </div>
      ) : null}

      {selectedJobItem ? (
        <JobCriteriaModal item={selectedJobItem} onClose={() => setSelectedJobItem(null)} />
      ) : null}
    </CrmFrame>
  );
}

export function CrmCompanySourcingOutreachSection({
  items,
  companyId,
}: {
  items: CrmSourcingOutreachItemView[];
  companyId: string;
}) {
  const [selectedJobItem, setSelectedJobItem] = useState<CrmSourcingOutreachItemView | null>(null);

  return (
    <section className="rounded-[22px] bg-white p-5 crm-surface lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Crosshair className="h-4 w-4 text-[#E8872A]" />
            Ứng viên bàn giao Inlink liên hệ ({items.length})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Danh sách ứng viên doanh nghiệp đã giao đội ngũ Inlink liên hệ trong gói Săn chuyên sâu.
          </p>
        </div>
        <Link
          href={`/crm/sourcing-outreach`}
          className="text-xs font-semibold text-[#4c3ec9] hover:underline"
        >
          Mở bàn điều phối Săn nhân sự →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Doanh nghiệp chưa bàn giao ứng viên nào cho Inlink liên hệ.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <OutreachRowCard
              key={`${item.engagementId}-${item.candidateId}`}
              item={item}
              companyId={companyId}
              hideCompanyLink
              onViewJob={() => setSelectedJobItem(item)}
            />
          ))}
        </div>
      )}

      {selectedJobItem ? (
        <JobCriteriaModal item={selectedJobItem} onClose={() => setSelectedJobItem(null)} />
      ) : null}
    </section>
  );
}

function OutreachRowCard({
  item,
  companyId,
  hideCompanyLink = false,
  onViewJob,
}: {
  item: CrmSourcingOutreachItemView;
  companyId?: string;
  hideCompanyLink?: boolean;
  onViewJob: () => void;
}) {
  const qc = useQueryClient();
  const [noteInput, setNoteInput] = useState(item.note ?? '');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (payload: { status: SourcingOutreachStatus; note?: string | null }) =>
      updateCrmSourcingOutreachStatus({
        companyId: item.companyId,
        engagementId: item.engagementId,
        candidateId: item.candidateId,
        status: payload.status,
        note: payload.note,
      }),
    onSuccess: () => {
      setErrMsg(null);
      void qc.invalidateQueries({ queryKey: ['crm-sourcing-outreach'] });
      if (companyId) {
        void qc.invalidateQueries({ queryKey: ['crm-company', companyId] });
      }
      void qc.invalidateQueries({ queryKey: ['crm-company', item.companyId] });
    },
    onError: (err) => setErrMsg(errorText(err, 'Không cập nhật được trạng thái')),
  });

  const statusMeta =
    SOURCING_OUTREACH_STATUS_META[item.status] ?? SOURCING_OUTREACH_STATUS_META.pending_contact;

  return (
    <div className="rounded-2xl border border-slate-200/85 bg-white p-4 shadow-2xs transition hover:border-slate-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Cột trái: Thông tin Ứng viên & Vị trí Săn */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#072348]">{item.candidateName}</span>
            {item.candidateCode ? (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                #{item.candidateCode}
              </span>
            ) : null}
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1',
                STATUS_BADGE_TONE[item.status],
              )}
              title={statusMeta.description}
            >
              {statusMeta.label}
            </span>
            <Link
              href={`/candidates/${item.candidateId}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              Xem hồ sơ UV
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Thông tin liên hệ của ứng viên */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            {item.candidatePhone ? (
              <a
                href={`tel:${item.candidatePhone}`}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {item.candidatePhone}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Phone className="h-3.5 w-3.5" />
                Chưa có SĐT
              </span>
            )}
            {item.candidateEmail ? (
              <a
                href={`mailto:${item.candidateEmail}`}
                className="inline-flex items-center gap-1 text-slate-700 hover:underline"
              >
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {item.candidateEmail}
              </a>
            ) : null}
            {item.candidatePosition ? (
              <span className="text-slate-600">
                Vị trí hiện tại: <strong>{item.candidatePosition}</strong>
              </span>
            ) : null}
            {item.candidateExperienceYears != null ? (
              <span className="text-slate-600">{item.candidateExperienceYears} năm KN</span>
            ) : null}
            {item.candidateCity ? (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {item.candidateCity}
              </span>
            ) : null}
          </div>

          {/* Thông tin Doanh nghiệp & Vị trí Tin săn */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/90 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200/60">
            {!hideCompanyLink ? (
              <>
                <Link
                  href={`/crm/companies/${item.companyId}`}
                  className="inline-flex items-center gap-1 font-bold text-[#072348] hover:text-[#4c3ec9] hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {item.companyName}
                </Link>
                <span className="text-slate-300">·</span>
              </>
            ) : null}
            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200">
              {item.planName}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-800">
              Tin săn: {item.jobTitle ?? item.engagementTitle}
            </span>
            {item.jobLocation ? (
              <span className="text-slate-500">({item.jobLocation})</span>
            ) : null}
            <button
              type="button"
              onClick={onViewJob}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200/80 hover:bg-sky-100"
            >
              <FileText className="h-3 w-3" />
              Xem JD & Tiêu chí
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Bàn giao: {formatWhen(item.createdAt)}
            </span>
            <span>·</span>
            <span>Cập nhật: {formatWhen(item.updatedAt)}</span>
          </div>
        </div>

        {/* Cột phải: Điều khiển Trạng thái phụ & Ghi chú CSKH */}
        <div className="w-full shrink-0 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 lg:w-80">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Trạng thái hỗ trợ chuyên sâu
          </label>
          <select
            value={item.status}
            disabled={mut.isPending}
            onChange={(e) =>
              mut.mutate({
                status: e.target.value as SourcingOutreachStatus,
                note: noteInput,
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#072348] focus:border-[#072348] focus:outline-none disabled:opacity-50"
          >
            {STATUS_KEYS.map((st) => (
              <option key={st} value={st}>
                {SOURCING_OUTREACH_STATUS_META[st].label} — {SOURCING_OUTREACH_STATUS_META[st].description}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ghi chú kết quả gọi / phản hồi UV..."
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#072348] focus:outline-none"
            />
            <button
              type="button"
              disabled={mut.isPending || noteInput === (item.note ?? '')}
              onClick={() => mut.mutate({ status: item.status, note: noteInput })}
              className="shrink-0 rounded-lg bg-[#072348] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0c3266] disabled:opacity-40"
            >
              Lưu
            </button>
          </div>
          {errMsg ? <p className="text-[11px] text-rose-600">{errMsg}</p> : null}
        </div>
      </div>
    </div>
  );
}

function JobCriteriaModal({
  item,
  onClose,
}: {
  item: CrmSourcingOutreachItemView;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#E8872A]">{item.companyName}</p>
            <h3 className="text-base font-bold text-[#072348]">
              {item.jobTitle ?? item.engagementTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm text-slate-700">
          {item.jobLocation ? (
            <p className="text-xs text-slate-500">
              Địa điểm làm việc: <strong className="text-slate-800">{item.jobLocation}</strong>
            </p>
          ) : null}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Mô tả công việc (JD)
            </h4>
            <div className="mt-1.5 whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
              {item.jobDescription || 'Chưa có mô tả chi tiết.'}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Yêu cầu & Tiêu chí tuyển dụng
            </h4>
            <div className="mt-1.5 whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
              {item.jobRequirements || 'Chưa có yêu cầu chi tiết.'}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
