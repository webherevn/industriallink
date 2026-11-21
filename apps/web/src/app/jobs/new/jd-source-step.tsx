'use client';

import clsx from 'clsx';
import {
  AlertCircle,
  Briefcase,
  ClipboardList,
  FileUp,
  Loader2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { JobTrack } from '@industriallink/contracts';

const ACCEPT =
  '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['pdf', 'doc', 'docx', 'txt']);

function rejectReason(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED.has(ext)) return 'Chỉ nhận file PDF, DOC, DOCX hoặc TXT.';
  if (file.size > MAX_BYTES) return 'File lớn hơn 5MB.';
  return null;
}

export function JdSourceStep({
  track,
  onSwitchTrack,
  step,
  onStep,
  text,
  onTextChange,
  sampleJd,
  exampleSnippet,
  busy,
  filePending,
  textPending,
  uploadedName,
  parseError,
  onFile,
  onRejectFile,
  onAnalyzeText,
  onSkipManual,
}: {
  track: JobTrack;
  onSwitchTrack?: (next: JobTrack) => void;
  step: number;
  onStep: (step: number) => void;
  text: string;
  onTextChange: (value: string) => void;
  sampleJd: string;
  exampleSnippet: string;
  busy: boolean;
  filePending: boolean;
  textPending: boolean;
  uploadedName: string | null;
  parseError: string | null;
  onFile: (file: File) => void;
  onRejectFile: (message: string) => void;
  onAnalyzeText: () => void;
  onSkipManual: () => void;
}) {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function takeFile(file: File | undefined) {
    if (!file || busy) return;
    const reason = rejectReason(file);
    if (reason) {
      onRejectFile(reason);
      return;
    }
    setMode('upload');
    onFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    takeFile(event.dataTransfer.files?.[0]);
  }

  const canAnalyze = !busy && text.trim().length >= 40;
  const charCount = text.trim().length;

  return (
    <div
      data-guide="jd-source"
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_-10px_rgba(7,35,72,0.08)]"
    >
      {/* Header + 3 bước */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#F8FAFC] via-white to-[#FFF8F1]/80 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#072348] text-white shadow-sm">
            <Sparkles className="h-4 w-4 text-[#FFB366]" />
          </span>
          <h2 className="text-lg font-bold text-[#072348] sm:text-xl">
            Tạo JD tuyển dụng bằng AI
          </h2>
          <span className="rounded-full border border-[#FFD0A3] bg-[#FFF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#C25E12]">
            AI Copilot
          </span>
        </div>
        <p className="mt-1.5 text-[13px] text-slate-600">
          Tải lên JD có sẵn hoặc nhập mô tả. AI sẽ phân tích và chuẩn hóa thông tin tuyển dụng giúp bạn.
        </p>

        <ol
          data-guide="jd-steps"
          className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]"
        >
          {[
            { id: 1, label: '1. Nguồn JD' },
            { id: 2, label: '2. Xác nhận thông tin' },
            { id: 3, label: '3. Xem trước và đăng' },
          ].map((s, idx) => (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStep(s.id)}
                className={clsx(
                  'rounded-full px-3.5 py-1.5 font-medium transition',
                  step === s.id
                    ? 'bg-[#072348] font-semibold text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-[#0B468C]/40 hover:bg-sky-50/50 hover:text-[#072348]',
                )}
              >
                {s.label}
              </button>
              {idx < 2 && <span className="font-semibold text-slate-300">→</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="p-5 sm:p-6">
        {/* Nhóm vị trí tuyển dụng */}
        <div>
          <div className="flex items-center gap-2">
            <span className="brand-accent-dot" />
            <p className="text-[14px] font-bold text-[#072348]">Nhóm vị trí tuyển dụng</p>
          </div>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSwitchTrack?.(JobTrack.Sales)}
              className={clsx(
                'group relative rounded-xl border p-3.5 text-left transition-all',
                track === JobTrack.Sales
                  ? 'border-[#0B468C] bg-sky-50/40 ring-2 ring-[#0B468C]/10 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={clsx(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      track === JobTrack.Sales
                        ? 'bg-[#072348] text-white shadow-xs'
                        : 'bg-sky-50 text-[#0B468C] group-hover:bg-sky-100',
                    )}
                  >
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-bold text-[#072348]">Kinh doanh</span>
                </div>
                {track === JobTrack.Sales && (
                  <span className="rounded-full bg-[#072348] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Đang chọn
                  </span>
                )}
              </div>
              <p className="mt-1.5 pl-[42px] text-[12px] text-slate-500">
                Sales B2B, kinh doanh kỹ thuật...
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSwitchTrack?.(JobTrack.Technical)}
              className={clsx(
                'group relative rounded-xl border p-3.5 text-left transition-all',
                track === JobTrack.Technical
                  ? 'border-[#E8872A] bg-[#FFF8F1]/80 ring-2 ring-[#E8872A]/15 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={clsx(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      track === JobTrack.Technical
                        ? 'bg-[#E8872A] text-white shadow-xs'
                        : 'bg-[#FFF8F1] text-[#C25E12] group-hover:bg-amber-100/70',
                    )}
                  >
                    <Wrench className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-bold text-[#072348]">Kỹ thuật</span>
                </div>
                {track === JobTrack.Technical && (
                  <span className="rounded-full bg-[#E8872A] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Đang chọn
                  </span>
                )}
              </div>
              <p className="mt-1.5 pl-[42px] text-[12px] text-slate-500">
                Kỹ sư, kỹ thuật viên, bảo trì...
              </p>
            </button>
          </div>
        </div>

        {/* Cách cung cấp JD */}
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <span className="brand-accent-dot" />
            <p className="text-[14px] font-bold text-[#072348]">Cách cung cấp JD</p>
          </div>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            {/* Thẻ 1: Tải file JD */}
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                if (!busy) setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                setMode('upload');
                if (!busy) fileInputRef.current?.click();
              }}
              className={clsx(
                'group flex cursor-pointer flex-col items-center justify-center rounded-xl border p-5 text-center transition-all',
                dragOver
                  ? 'border-dashed border-[#0B468C] bg-sky-50/70 ring-2 ring-[#0B468C]/20'
                  : mode === 'upload'
                    ? 'border-[#0B468C] bg-sky-50/40 ring-2 ring-[#0B468C]/10 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  takeFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <span
                className={clsx(
                  'inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-all',
                  mode === 'upload' || dragOver
                    ? 'bg-[#072348] text-white shadow-xs'
                    : 'bg-sky-50 text-[#0B468C] group-hover:bg-sky-100',
                )}
              >
                {filePending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileUp className="h-5 w-5" strokeWidth={1.8} />
                )}
              </span>
              <p className="mt-3 text-[14px] font-bold text-[#072348]">Tải file JD</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {filePending
                  ? 'Đang trích xuất & phân tích JD...'
                  : uploadedName
                    ? `Đã chọn: ${uploadedName}`
                    : 'PDF, DOC, DOCX, TXT (tối đa 5MB)'}
              </p>
              <span
                className={clsx(
                  'mt-3 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                  mode === 'upload'
                    ? 'border border-[#0B468C]/30 bg-sky-100/80 text-[#072348]'
                    : 'border border-slate-200 bg-white text-[#072348] group-hover:border-[#0B468C]/40 group-hover:bg-sky-50/50',
                )}
              >
                Chọn file
              </span>
            </div>

            {/* Thẻ 2: Dán nội dung JD */}
            <button
              type="button"
              onClick={() => {
                setMode('paste');
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
              className={clsx(
                'group flex flex-col items-center justify-center rounded-xl border p-5 text-center transition-all',
                mode === 'paste'
                  ? 'border-[#0B468C] bg-sky-50/40 ring-2 ring-[#0B468C]/10 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60',
              )}
            >
              <span
                className={clsx(
                  'inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-all',
                  mode === 'paste'
                    ? 'bg-[#072348] text-white shadow-xs'
                    : 'bg-sky-50 text-[#0B468C] group-hover:bg-sky-100',
                )}
              >
                <ClipboardList className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="mt-3 text-[14px] font-bold text-[#072348]">Dán nội dung JD</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Sao chép mô tả tuyển dụng có sẵn
              </p>
              <span
                className={clsx(
                  'mt-3 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                  mode === 'paste'
                    ? 'border border-[#0B468C]/30 bg-sky-100/80 text-[#072348]'
                    : 'border border-slate-200 bg-white text-[#072348] group-hover:border-[#0B468C]/40 group-hover:bg-sky-50/50',
                )}
              >
                {mode === 'paste' ? 'Đang chọn nhập nội dung' : 'Nhập nội dung'}
              </span>
            </button>
          </div>
        </div>

        {/* Ô nhập nội dung JD */}
        {mode === 'paste' && (
          <div className="mt-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                rows={7}
                placeholder="Dán mô tả tin tuyển dụng tại đây (tối thiểu ~40 ký tự)..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-800 shadow-2xs outline-none transition placeholder:text-slate-400 focus:border-[#0B468C] focus:ring-2 focus:ring-[#0B468C]/15"
              />
              <div className="mt-1.5 flex items-center justify-end text-[11.5px]">
                <span
                  className={clsx(
                    'font-semibold',
                    charCount >= 40 ? 'text-emerald-600' : 'text-slate-500',
                  )}
                >
                  {charCount >= 40
                    ? `✓ Sẵn sàng phân tích (${charCount} ký tự)`
                    : `${charCount}/40 ký tự tối thiểu`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Ví dụ nội dung JD */}
        <div className="mt-4 rounded-xl border border-[#FFD0A3] bg-[#FFF8F1]/80 px-4 py-3.5 text-[12.5px] leading-relaxed text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#C25E12]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8872A]" />
              Ví dụ nội dung JD
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode('paste');
                onTextChange(sampleJd);
              }}
              className="rounded-full border border-[#FFD0A3] bg-white px-3 py-1 text-[12px] font-semibold text-[#C25E12] shadow-2xs transition hover:border-[#E8872A] hover:bg-[#E8872A] hover:text-white disabled:opacity-50"
            >
              Dùng mẫu này
            </button>
          </div>
          <p className="mt-1.5 text-slate-600">{exampleSnippet}</p>
        </div>

        {parseError && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {parseError}
          </p>
        )}

        {/* Footer hành động */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-slate-500">
            <span>AI sẽ phân tích và đề xuất các trường thông tin còn thiếu.</span>
            <button
              type="button"
              onClick={onSkipManual}
              className="font-semibold text-[#0B468C] hover:text-[#E8872A] hover:underline"
            >
              Bỏ qua, điền tay →
            </button>
          </div>

          <button
            type="button"
            data-guide="jd-ai"
            disabled={!canAnalyze}
            onClick={onAnalyzeText}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition-all',
              canAnalyze
                ? 'bg-[#E8872A] text-white shadow-sm hover:bg-[#d6761b]'
                : 'cursor-not-allowed bg-[#E8872A]/45 text-white',
            )}
          >
            {textPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Phân tích JD bằng AI
          </button>
        </div>
      </div>
    </div>
  );
}
