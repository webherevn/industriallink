'use client';

import clsx from 'clsx';
import { FileUp, Loader2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

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

export function JdFileDrop({
  busy,
  pending,
  uploadedName,
  onFile,
  onReject,
}: {
  busy: boolean;
  pending: boolean;
  uploadedName: string | null;
  onFile: (file: File) => void;
  onReject: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(file: File | undefined) {
    if (!file || busy) return;
    const reason = rejectReason(file);
    if (reason) {
      onReject(reason);
      return;
    }
    onFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files?.[0]);
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        if (!busy) setOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={onDrop}
      className={clsx(
        'rounded-xl border border-dashed px-4 py-4 transition',
        over
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
          : 'border-brand-200 bg-brand-50/40',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
            <FileUp className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900">
              {over ? 'Thả file để AI đọc JD' : 'Upload file JD'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Kéo file vào đây hoặc bấm Chọn file. PDF, DOC, DOCX, TXT · tối đa 5MB.
            </p>
            {uploadedName && (
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs font-medium text-brand-700">
                <Upload className="h-3.5 w-3.5 shrink-0" />
                {uploadedName}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {pending ? 'Đang đọc JD…' : 'Chọn file'}
        </button>
      </div>
    </div>
  );
}
