'use client';

import { useMutation } from '@tanstack/react-query';
import type { CrmAiOutreachChannel, CrmAiOutreachPurpose } from '@industriallink/contracts';
import { Check, Copy, FileSearch, Mail, MessageSquare, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { crmFieldClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { diagnoseCrmAiCompanyJds, draftCrmAiOutreach, fetchCrmAiCompanyBrief } from '@/lib/crm';

type CopilotTab = 'brief' | 'outreach' | 'jd';

const PURPOSES: Array<{ value: CrmAiOutreachPurpose; label: string }> = [
  { value: 'missing_license', label: 'Nhắc nộp Giấy phép ĐKKD' },
  { value: 'upgrade_free', label: 'Nâng cấp gói Khám phá → Trả phí' },
  { value: 'renewal_churn', label: 'Chăm sóc giữ chân / Gia hạn gói' },
  { value: 'stale_quote', label: 'Follow-up báo giá quá hạn' },
  { value: 'general_care', label: 'Chăm sóc định kỳ & hỏi nhu cầu' },
];

export function CrmCompanyAiCopilot({ companyId }: { companyId: string }) {
  const [tab, setTab] = useState<CopilotTab>('brief');
  const [channel, setChannel] = useState<CrmAiOutreachChannel>('zalo');
  const [purpose, setPurpose] = useState<CrmAiOutreachPurpose>('upgrade_free');
  const [customNote, setCustomNote] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const brief = useMutation({
    mutationFn: () => fetchCrmAiCompanyBrief(companyId),
  });

  const outreach = useMutation({
    mutationFn: () => draftCrmAiOutreach(companyId, { channel, purpose, customNote: customNote.trim() || undefined }),
  });

  const jdDiag = useMutation({
    mutationFn: () => diagnoseCrmAiCompanyJds(companyId),
  });

  function copyText(key: string, text: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000);
    });
  }

  return (
    <section className="rounded-[22px] border border-[#DCE6F4] bg-white p-5 crm-surface lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#072348] text-[#E8872A]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#072348]">Trợ lý AI Sale & CS (inLink Copilot)</h2>
            <p className="text-xs text-slate-500">
              Tóm tắt hồ sơ 30 giây trước khi gọi, soạn tin nhắn Zalo/Email cá nhân hóa và chẩn đoán JD ít ứng viên.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['brief', 'Tóm tắt 30s', Sparkles],
              ['outreach', 'Soạn Zalo / Email', MessageSquare],
              ['jd', 'Chẩn đoán JD', FileSearch],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                tab === key
                  ? 'bg-[#072348] text-white'
                  : 'bg-[#F5F8FC] text-[#072348] hover:bg-[#E8F0FA]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'brief' ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={brief.isPending}
              onClick={() => brief.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8872A] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d6781f] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {brief.isPending ? 'Đang tổng hợp hồ sơ…' : brief.data ? 'Tạo lại tóm tắt 30s' : 'AI Tóm tắt & Gợi ý gọi'}
            </button>
            {brief.data ? (
              <button
                type="button"
                onClick={() => copyText('brief', brief.data.content)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#DCE6F4] bg-[#F5F8FC] px-3 py-2 text-xs font-semibold text-[#072348] hover:bg-[#E8F0FA]"
              >
                {copiedKey === 'brief' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === 'brief' ? 'Đã copy' : 'Copy tóm tắt'}
              </button>
            ) : null}
          </div>
          {brief.isError ? (
            <p className="text-xs text-rose-600">{errorText(brief.error, 'Không gọi được trợ lý AI')}</p>
          ) : null}
          {brief.data ? (
            <div className="whitespace-pre-line rounded-2xl border border-[#DCE6F4] bg-[#F5F8FC] p-4 text-sm leading-relaxed text-slate-800">
              {brief.data.content}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#DCE6F4] bg-[#F5F8FC]/50 px-4 py-4 text-xs text-slate-500">
              Bấm nút <strong>AI Tóm tắt & Gợi ý gọi</strong> để đọc nhanh gói đang dùng, Credit, số ứng viên, lịch sử chăm sóc và nhận câu mở lời gợi ý trước khi nhấc máy.
            </p>
          )}
        </div>
      ) : null}

      {tab === 'outreach' ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-xs font-semibold text-[#072348]">
              Kênh gửi
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('zalo')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    channel === 'zalo'
                      ? 'border-[#072348] bg-[#072348] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Zalo
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('email')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    channel === 'email'
                      ? 'border-[#072348] bg-[#072348] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>
              </div>
            </label>
            <label className="block text-xs font-semibold text-[#072348]">
              Tình huống chăm sóc
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as CrmAiOutreachPurpose)}
                className={`${crmFieldClass} mt-1.5`}
              >
                {PURPOSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#072348]">
              Ghi chú thêm cho AI (tuỳ chọn)
              <input
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="VD: nhấn mạnh ưu đãi tháng này..."
                className={`${crmFieldClass} mt-1.5`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={outreach.isPending}
              onClick={() => outreach.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8872A] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#d6781f] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {outreach.isPending ? 'Đang soạn tin nhắn…' : `AI Soạn tin ${channel === 'zalo' ? 'Zalo' : 'Email'}`}
            </button>
            {outreach.data ? (
              <button
                type="button"
                onClick={() =>
                  copyText(
                    'outreach',
                    outreach.data.subject
                      ? `Tiêu đề: ${outreach.data.subject}\n\n${outreach.data.message}`
                      : outreach.data.message,
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[#DCE6F4] bg-[#F5F8FC] px-3 py-2 text-xs font-semibold text-[#072348] hover:bg-[#E8F0FA]"
              >
                {copiedKey === 'outreach' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === 'outreach' ? 'Đã copy' : 'Copy tin nhắn'}
              </button>
            ) : null}
          </div>
          {outreach.isError ? (
            <p className="text-xs text-rose-600">{errorText(outreach.error, 'Không soạn được tin nhắn')}</p>
          ) : null}
          {outreach.data ? (
            <div className="rounded-2xl border border-[#DCE6F4] bg-[#F5F8FC] p-4 text-sm text-slate-800">
              {outreach.data.subject ? (
                <p className="mb-2 border-b border-[#DCE6F4] pb-2 font-semibold text-[#072348]">
                  Tiêu đề: {outreach.data.subject}
                </p>
              ) : null}
              <div className="whitespace-pre-line leading-relaxed">{outreach.data.message}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'jd' ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={jdDiag.isPending}
              onClick={() => jdDiag.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0B468C] disabled:opacity-50"
            >
              <FileSearch className="h-3.5 w-3.5" />
              {jdDiag.isPending ? 'Đang phân tích các tin JD…' : 'AI Chẩn đoán JD & Gợi ý tối ưu'}
            </button>
            {jdDiag.data ? (
              <button
                type="button"
                onClick={() => copyText('jd', jdDiag.data.diagnosis)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#DCE6F4] bg-[#F5F8FC] px-3 py-2 text-xs font-semibold text-[#072348] hover:bg-[#E8F0FA]"
              >
                {copiedKey === 'jd' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === 'jd' ? 'Đã copy gửi HR' : 'Copy gợi ý gửi HR'}
              </button>
            ) : null}
          </div>
          {jdDiag.isError ? (
            <p className="text-xs text-rose-600">{errorText(jdDiag.error, 'Không phân tích được JD')}</p>
          ) : null}
          {jdDiag.data ? (
            <div className="space-y-2 rounded-2xl border border-[#DCE6F4] bg-[#F5F8FC] p-4 text-sm text-slate-800">
              {jdDiag.data.jobTitles.length > 0 ? (
                <p className="text-xs font-semibold text-[#0B468C]">
                  Đã phân tích {jdDiag.data.analyzedJobCount} tin: {jdDiag.data.jobTitles.join(' · ')}
                </p>
              ) : null}
              <div className="whitespace-pre-line leading-relaxed">{jdDiag.data.diagnosis}</div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#DCE6F4] bg-[#F5F8FC]/50 px-4 py-4 text-xs text-slate-500">
              Dùng khi khách trả phí đã đăng tin nhưng ít/0 ứng viên — AI sẽ chỉ ra điểm yếu của JD hiện tại và viết sẵn gợi ý sửa để CS gửi lại cho HR nhà máy.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
