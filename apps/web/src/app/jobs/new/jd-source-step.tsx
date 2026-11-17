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

  return (
    <div
      data-guide="jd-source"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      {/* Header + 3 bước */}
      <div>
        <h2 className="text-lg font-bold text-[#072348] sm:text-xl">
          Tạo JD tuyển dụng bằng AI
        </h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Tải lên JD có sẵn hoặc nhập mô tả. AI sẽ phân tích và chuẩn hóa thông tin tuyển dụng giúp bạn.
        </p>

        <ol
          data-guide="jd-steps"
          className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[12.5px]"
        >
          {[
            { id: 1, label: '1. Nguồn JD' },
            { id: 2, label: '2. Xác nhận thông tin' },
            { id: 3, label: '3. Xem trước và đăng' },
          ].map((s, idx) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStep(s.id)}
                className={clsx(
                  'rounded-full px-3 py-1 font-medium transition',
                  step === s.id
                    ? 'bg-sky-50 font-semibold text-[#0B468C]'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {s.label}
              </button>
              {idx < 2 && <span className="text-slate-300">→</span>}
            </li>
          ))}
        </ol>
      </div>

      <hr className="my-5 border-slate-100" />

      {/* Nhóm vị trí tuyển dụng */}
      <div>
        <p className="text-[14px] font-bold text-[#072348]">Nhóm vị trí tuyển dụng</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSwitchTrack?.(JobTrack.Sales)}
            className={clsx(
              'rounded-xl border p-3.5 text-left transition',
              track === JobTrack.Sales
                ? 'border-[#072348] bg-white ring-1 ring-[#072348]/20'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center gap-2">
              <Briefcase
                className={clsx(
                  'h-4 w-4',
                  track === JobTrack.Sales ? 'text-[#072348]' : 'text-slate-500',
                )}
              />
              <span className="text-[14px] font-bold text-[#072348]">Kinh doanh</span>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Sales B2B, kinh doanh kỹ thuật...
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSwitchTrack?.(JobTrack.Technical)}
            className={clsx(
              'rounded-xl border p-3.5 text-left transition',
              track === JobTrack.Technical
                ? 'border-[#072348] bg-white ring-1 ring-[#072348]/20'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center gap-2">
              <Wrench
                className={clsx(
                  'h-4 w-4',
                  track === JobTrack.Technical ? 'text-[#072348]' : 'text-slate-500',
                )}
              />
              <span className="text-[14px] font-bold text-[#072348]">Kỹ thuật</span>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Kỹ sư, kỹ thuật viên, bảo trì...
            </p>
          </button>
        </div>
      </div>

      {/* Cách cung cấp JD */}
      <div className="mt-5">
        <p className="text-[14px] font-bold text-[#072348]">Cách cung cấp JD</p>
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
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border p-5 text-center transition',
              dragOver
                ? 'border-brand-500 bg-sky-50/60'
                : mode === 'upload'
                  ? 'border-[#0B468C] bg-sky-50/20 ring-1 ring-[#0B468C]/15'
                  : 'border-slate-200 bg-white hover:border-slate-300',
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
            {filePending ? (
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            ) : (
              <FileUp className="h-7 w-7 text-brand-600" strokeWidth={1.7} />
            )}
            <p className="mt-2.5 text-[14px] font-bold text-[#072348]">Tải file JD</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {filePending
                ? 'Đang trích xuất & phân tích JD...'
                : uploadedName
                  ? `Đã chọn: ${uploadedName}`
                  : 'PDF, DOC, DOCX, TXT'}
            </p>
            <span className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
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
              'flex flex-col items-center justify-center rounded-xl border p-5 text-center transition',
              mode === 'paste'
                ? 'border-[#0B468C] bg-sky-50/20 ring-1 ring-[#0B468C]/15'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <ClipboardList className="h-7 w-7 text-brand-600" strokeWidth={1.7} />
            <p className="mt-2.5 text-[14px] font-bold text-[#072348]">Dán nội dung JD</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Sao chép mô tả tuyển dụng có sẵn
            </p>
            <span
              className={clsx(
                'mt-3 rounded-lg px-3 py-1 text-[12px] font-semibold',
                mode === 'paste'
                  ? 'bg-sky-100 text-[#0B468C]'
                  : 'border border-slate-200 bg-slate-50 text-slate-700',
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
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={7}
            placeholder="Dán mô tả tin tuyển dụng tại đây (tối thiểu ~40 ký tự)..."
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none ring-brand-500/30 transition focus:border-brand-400 focus:ring-2"
          />
        </div>
      )}

      {/* Ví dụ nội dung JD */}
      <div className="mt-4 rounded-xl bg-slate-50/80 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium italic text-slate-400">Ví dụ nội dung JD</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode('paste');
              onTextChange(sampleJd);
            }}
            className="text-[12px] font-semibold text-[#0B468C] hover:underline disabled:opacity-50"
          >
            Dùng mẫu này
          </button>
        </div>
        <p className="mt-1 text-slate-600">{exampleSnippet}</p>
      </div>

      {parseError && (
        <p className="mt-3 flex items-start gap-2 text-[13px] text-rose-600">
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
            className="font-semibold text-[#0B468C] hover:underline"
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
            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition',
            canAnalyze
              ? 'bg-[#072348] text-white shadow-sm hover:bg-[#0c3266]'
              : 'cursor-not-allowed bg-slate-200 text-slate-500',
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
  );
}
