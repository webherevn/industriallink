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
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#072348]/[0.04] via-sky-50/70 to-accent-50/60 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#072348] to-[#0B468C] text-white shadow-sm shadow-sky-900/20">
            <Sparkles className="h-4 w-4 text-accent-300" />
          </span>
          <h2 className="text-lg font-bold text-[#072348] sm:text-xl">
            Tạo JD tuyển dụng bằng AI
          </h2>
          <span className="rounded-full border border-accent-200 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-700">
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
                    ? 'bg-gradient-to-r from-[#072348] to-[#0B468C] font-semibold text-white shadow-sm shadow-sky-900/20'
                    : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-[#0B468C]',
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
                  ? 'border-[#0B468C] bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 ring-2 ring-[#0B468C]/15 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/20',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={clsx(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      track === JobTrack.Sales
                        ? 'bg-gradient-to-br from-[#072348] to-[#0B468C] text-white shadow-sm'
                        : 'bg-sky-50 text-[#0B468C] group-hover:bg-sky-100',
                    )}
                  >
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-bold text-[#072348]">Kinh doanh</span>
                </div>
                {track === JobTrack.Sales && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-[#0B468C]">
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
                  ? 'border-accent-500 bg-gradient-to-br from-accent-50/90 via-white to-amber-50/40 ring-2 ring-accent-500/15 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-accent-200 hover:bg-accent-50/20',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={clsx(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      track === JobTrack.Technical
                        ? 'bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-sm'
                        : 'bg-accent-50 text-accent-600 group-hover:bg-accent-100',
                    )}
                  >
                    <Wrench className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-bold text-[#072348]">Kỹ thuật</span>
                </div>
                {track === JobTrack.Technical && (
                  <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
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
                  ? 'border-dashed border-sky-500 bg-sky-50/80 ring-2 ring-sky-400/25'
                  : mode === 'upload'
                    ? 'border-[#0B468C] bg-gradient-to-b from-sky-50/75 to-white ring-2 ring-[#0B468C]/15 shadow-sm'
                    : 'border-slate-200 bg-slate-50/40 hover:border-sky-200 hover:bg-sky-50/30',
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
                  'inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-all',
                  mode === 'upload' || dragOver
                    ? 'bg-gradient-to-br from-[#072348] to-[#0B468C] text-white shadow-md shadow-sky-900/20'
                    : 'bg-sky-50 text-[#0B468C] group-hover:bg-sky-100',
                )}
              >
                {filePending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <FileUp className="h-6 w-6" strokeWidth={1.8} />
                )}
              </span>
              <p className="mt-3 text-[14px] font-bold text-[#072348]">Tải file JD</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {filePending
                  ? 'Đang trích xuất & phân tích JD...'
                  : uploadedName
                    ? `Đã chọn: ${uploadedName}`
                    : 'PDF, DOC, DOCX, TXT'}
              </p>
              <span
                className={clsx(
                  'mt-3 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                  mode === 'upload'
                    ? 'bg-gradient-to-r from-[#072348] to-[#0B468C] text-white shadow-sm'
                    : 'border border-sky-200 bg-white text-[#0B468C] group-hover:bg-sky-50',
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
                  ? 'border-[#0B468C] bg-gradient-to-b from-indigo-50/60 via-sky-50/40 to-white ring-2 ring-[#0B468C]/15 shadow-sm'
                  : 'border-slate-200 bg-slate-50/40 hover:border-indigo-200 hover:bg-indigo-50/30',
              )}
            >
              <span
                className={clsx(
                  'inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-all',
                  mode === 'paste'
                    ? 'bg-gradient-to-br from-[#072348] to-indigo-600 text-white shadow-md shadow-indigo-900/20'
                    : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
                )}
              >
                <ClipboardList className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <p className="mt-3 text-[14px] font-bold text-[#072348]">Dán nội dung JD</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Sao chép mô tả tuyển dụng có sẵn
              </p>
              <span
                className={clsx(
                  'mt-3 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                  mode === 'paste'
                    ? 'bg-gradient-to-r from-[#072348] to-[#0B468C] text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 group-hover:border-indigo-200 group-hover:text-indigo-700',
                )}
              >
                Nhập nội dung
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0B468C] focus:bg-white focus:ring-4 focus:ring-sky-500/10"
              />
              <div className="mt-1.5 flex items-center justify-end text-[11.5px]">
                <span
                  className={clsx(
                    'font-medium',
                    charCount >= 40 ? 'text-emerald-600' : 'text-slate-400',
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
        <div className="mt-4 rounded-xl border border-accent-200/80 bg-gradient-to-r from-accent-50/75 via-amber-50/40 to-white px-4 py-3.5 text-[12.5px] leading-relaxed text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-accent-800">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              Ví dụ nội dung JD
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode('paste');
                onTextChange(sampleJd);
              }}
              className="rounded-full border border-accent-300 bg-white px-3 py-1 text-[12px] font-semibold text-accent-700 shadow-xs transition hover:border-accent-500 hover:bg-accent-500 hover:text-white disabled:opacity-50"
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
              className="font-semibold text-[#0B468C] hover:text-accent-600 hover:underline"
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
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all',
              canAnalyze
                ? 'bg-gradient-to-r from-[#072348] via-[#0B468C] to-[#1258ad] text-white shadow-md shadow-[#072348]/25 hover:shadow-lg hover:brightness-110'
                : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400',
            )}
          >
            {textPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent-300" />
            )}
            Phân tích JD bằng AI
          </button>
        </div>
      </div>
    </div>
  );
}
