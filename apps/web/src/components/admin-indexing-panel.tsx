'use client';

import type { IndexingNotificationType, IndexingSettingsView, IndexingSubmitResult, IndexingTestResult } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, Copy, ExternalLink, FileJson, KeyRound, Loader2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchIndexingSettings, submitIndexing, testIndexing, updateIndexingSettings } from '@/lib/admin-indexing';

const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#FFD0A3] focus:ring-2 focus:ring-[#FFF8F1] disabled:bg-slate-50';

type Banner = { tone: 'ok' | 'err'; text: string } | null;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function Notice({ banner }: { banner: Banner }) {
  if (!banner) return null;
  return (
    <p
      className={clsx(
        'mt-4 rounded-2xl border px-3 py-2 text-sm',
        banner.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      {banner.text}
    </p>
  );
}

export function AdminIndexingPanel() {
  const { data, isError } = useQuery({ queryKey: ['admin-indexing-settings'], queryFn: fetchIndexingSettings, retry: false });
  if (isError || !data) return null;
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <SettingsCard data={data} />
      <SubmitCard data={data} />
    </section>
  );
}

function Guide({ clientEmail }: { clientEmail: string | null }) {
  const steps = [
    <>
      Vào{' '}
      <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="font-semibold text-accent-700 underline">
        Google Cloud Console
      </a>{' '}
      tạo project (hoặc dùng project đã có khóa PageSpeed).
    </>,
    <>
      Bật{' '}
      <a
        href="https://console.cloud.google.com/apis/library/indexing.googleapis.com"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-accent-700 underline"
      >
        Web Search Indexing API
      </a>{' '}
      cho project đó.
    </>,
    <>
      Vào{' '}
      <a
        href="https://console.cloud.google.com/iam-admin/serviceaccounts"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-accent-700 underline"
      >
        IAM → Service Accounts
      </a>{' '}
      → Create service account (không cần cấp role) → mở account → tab Keys → Add key → JSON. Máy tải về một file .json.
    </>,
    <>
      Vào{' '}
      <a
        href="https://search.google.com/search-console/users"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-accent-700 underline"
      >
        Search Console → Cài đặt → Người dùng và quyền
      </a>{' '}
      của property inlink.vn → Thêm người dùng: {clientEmail ? <b className="text-[#072348]">{clientEmail}</b> : 'email client_email trong file JSON'}, quyền{' '}
      <b>Chủ sở hữu</b>. Quyền “Toàn quyền” không đủ.
    </>,
    <>Chọn file .json ở ô bên dưới (hoặc dán nội dung), bấm Lưu, rồi Kiểm tra kết nối.</>,
  ];
  return (
    <details className="group mt-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#FFD0A3]" open={!clientEmail}>
      <summary className="cursor-pointer text-sm font-semibold text-[#072348] marker:text-accent-600">Cách lấy khóa service account</summary>
      <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#072348] text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-xl bg-[#FFF8F1] px-3 py-2 text-[11px] leading-relaxed text-accent-800">
        Google chỉ chính thức hỗ trợ Indexing API cho trang tin tuyển dụng (JobPosting). Bài cẩm nang vẫn gửi được nhưng Google có thể bỏ qua,
        nên bài viết vẫn dựa vào sitemap là chính. Hạn mức mặc định 200 URL/ngày.
      </p>
    </details>
  );
}

function SettingsCard({ data }: { data: IndexingSettingsView }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [autoNotify, setAutoNotify] = useState(data.autoNotify);
  const [clearKey, setClearKey] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [test, setTest] = useState<IndexingTestResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAutoNotify(data.autoNotify);
    setClearKey(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateIndexingSettings({
        credentialsJson: clearKey ? null : json.trim() || undefined,
        autoNotify,
      }),
    onSuccess: async (view) => {
      qc.setQueryData(['admin-indexing-settings'], view);
      setJson('');
      setFileName(null);
      setTest(null);
      setBanner({ tone: 'ok', text: view.hasCredentials ? 'Đã lưu. Bấm Kiểm tra kết nối để xác nhận quyền Search Console.' : 'Đã lưu cài đặt.' });
      await qc.invalidateQueries({ queryKey: ['admin-cms-crawl'] });
    },
    onError: (err) => setBanner({ tone: 'err', text: errorText(err, 'Lưu thất bại.') }),
  });

  const runTest = useMutation({
    mutationFn: testIndexing,
    onSuccess: (res) => {
      setTest(res);
      setBanner(null);
    },
    onError: (err) => setBanner({ tone: 'err', text: errorText(err, 'Kiểm tra thất bại.') }),
  });

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10_000) {
      setBanner({ tone: 'err', text: 'File quá lớn — khóa service account chỉ khoảng 2–3 KB.' });
      return;
    }
    setJson(await file.text());
    setFileName(file.name);
    setClearKey(false);
    setBanner(null);
  }

  async function copyEmail() {
    if (!data.clientEmail) return;
    await navigator.clipboard.writeText(data.clientEmail);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article className="admin-dash-card border-[#FFD0A3] bg-gradient-to-b from-[#FFF8F1] to-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-accent-600 ring-1 ring-[#FFD0A3]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#072348]">Khóa Google Indexing API</h2>
            <p className="mt-0.5 text-xs font-medium text-accent-700">Service account JSON · lưu mã hoá trong database</p>
          </div>
        </div>
        <span
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
            data.hasCredentials ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200',
          )}
        >
          {data.hasCredentials ? (data.source === 'env' ? 'Đang dùng khóa từ .env' : 'Đã có khóa') : 'Chưa có khóa'}
        </span>
      </div>

      {data.clientEmail ? (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Service account · thêm làm Chủ sở hữu trong Search Console</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-sm font-semibold text-[#072348]">{data.clientEmail}</code>
            <button
              type="button"
              onClick={() => void copyEmail()}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#f8fafc] px-2.5 text-xs font-semibold text-[#072348] ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Đã chép' : 'Chép'}
            </button>
          </div>
          {data.projectId ? <p className="mt-1 text-xs text-slate-500">Project: {data.projectId}</p> : null}
        </div>
      ) : null}

      <Guide clientEmail={data.clientEmail} />

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800">
            {data.hasCredentials ? 'Thay khóa mới' : 'Khóa service account (.json)'}
          </span>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void onFile(event)} />
          <button
            type="button"
            disabled={clearKey}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-semibold text-[#072348] ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:ring-[#FFD0A3] disabled:opacity-50"
          >
            <FileJson className="h-3.5 w-3.5" />
            Chọn file .json
          </button>
        </div>
        <span className="mt-0.5 block text-xs text-slate-500">
          {fileName
            ? `Đã đọc ${fileName}. Bấm Lưu để mã hoá và lưu.`
            : data.hasCredentials
              ? 'Để trống khi Lưu = giữ khóa hiện tại.'
              : 'Chọn file hoặc dán toàn bộ nội dung file JSON.'}
        </span>
        <textarea
          rows={4}
          spellCheck={false}
          autoComplete="off"
          disabled={clearKey}
          value={clearKey ? '' : json}
          placeholder={'{ "type": "service_account", "client_email": "…", "private_key": "-----BEGIN PRIVATE KEY-----…" }'}
          onChange={(event) => {
            setJson(event.target.value);
            setFileName(null);
          }}
          className={clsx(INPUT, 'mt-2 py-2 font-mono text-xs')}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={autoNotify} onChange={(event) => setAutoNotify(event.target.checked)} />
          Tự gửi khi tin tuyển dụng / bài viết được đăng, sửa hoặc gỡ
        </label>
        {data.source === 'db' ? (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={clearKey} onChange={(event) => setClearKey(event.target.checked)} />
            Xoá khóa đã lưu
          </label>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="!rounded-xl !bg-[#072348] hover:!bg-[#0c3a72]">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lưu
        </Button>
        <Button variant="outline" onClick={() => runTest.mutate()} disabled={runTest.isPending || !data.hasCredentials}>
          {runTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {runTest.isPending ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </Button>
      </div>

      <Notice banner={banner} />
      {test ? (
        <div
          className={clsx(
            'mt-4 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-sm',
            test.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {test.statusCode ? <b>HTTP {test.statusCode} · </b> : null}
            {test.message}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function SubmitCard({ data }: { data: IndexingSettingsView }) {
  const qc = useQueryClient();
  const [urls, setUrls] = useState('');
  const [type, setType] = useState<IndexingNotificationType>('URL_UPDATED');
  const [banner, setBanner] = useState<Banner>(null);
  const [result, setResult] = useState<IndexingSubmitResult | null>(null);
  const blocked = !data.hasCredentials || data.siteIsLocal;
  const lines = urls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const submit = useMutation({
    mutationFn: (mode: 'urls' | 'jobs') =>
      submitIndexing(mode === 'jobs' ? { target: 'jobs', type: 'URL_UPDATED' } : { urls: lines, type }),
    onSuccess: async (res, mode) => {
      setResult(res);
      setBanner(null);
      if (mode === 'urls' && res.failed === 0) setUrls('');
      await qc.invalidateQueries({ queryKey: ['admin-cms-crawl'] });
    },
    onError: (err) => setBanner({ tone: 'err', text: errorText(err, 'Gửi thất bại.') }),
  });

  return (
    <article className="admin-dash-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8fafc] text-[#072348] ring-1 ring-slate-200">
          <Send className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#072348]">Gửi URL cho Google</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tự gửi đã chạy nền mỗi khi đăng hoặc gỡ tin. Dùng mục này cho lần đầu, hoặc khi cần Google cập nhật ngay.
          </p>
        </div>
      </div>

      {blocked ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {!data.hasCredentials
            ? 'Cần lưu khóa service account trước.'
            : `Site đang là ${data.siteUrl}. Google chỉ nhận URL của inlink.vn — thao tác này dùng được trên máy chủ thật.`}
        </p>
      ) : null}

      <div className="mt-4 rounded-2xl bg-[#f8fafc] px-4 py-3 ring-1 ring-slate-100">
        <p className="text-sm font-semibold text-[#072348]">Toàn bộ tin tuyển dụng đang hiển thị</p>
        <p className="mt-0.5 text-xs text-slate-500">Gửi URL_UPDATED cho tin mới cập nhật trước, dừng khi hết hạn mức còn lại trong ngày.</p>
        <Button
          className="mt-3 !rounded-xl !bg-accent-600 hover:!bg-accent-700"
          disabled={blocked || submit.isPending}
          onClick={() => submit.mutate('jobs')}
        >
          {submit.isPending && submit.variables === 'jobs' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gửi tất cả tin tuyển dụng
        </Button>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800">URL cụ thể</span>
          <div className="flex rounded-xl bg-[#f8fafc] p-1 ring-1 ring-slate-200">
            {(
              [
                ['URL_UPDATED', 'Cập nhật'],
                ['URL_DELETED', 'Đã xoá'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={clsx(
                  'rounded-lg px-3 py-1 text-xs font-semibold transition',
                  type === value ? 'bg-[#072348] text-white' : 'text-slate-500 hover:text-[#072348]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="mt-0.5 block text-xs text-slate-500">Mỗi dòng một URL, dạng /viec-lam/ten-tin hoặc https://inlink.vn/… Tối đa 200.</span>
        <textarea
          rows={4}
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          placeholder={'/viec-lam/ky-su-plc\nhttps://inlink.vn/cam-nang/lo-trinh-nghe'}
          className={clsx(INPUT, 'mt-2 py-2 text-xs')}
        />
        <Button
          variant="outline"
          className="mt-2"
          disabled={blocked || submit.isPending || lines.length === 0}
          onClick={() => submit.mutate('urls')}
        >
          {submit.isPending && submit.variables === 'urls' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gửi {lines.length > 0 ? `${lines.length} URL` : 'URL'}
        </Button>
      </div>

      <Notice banner={banner} />
      {result ? <SubmitSummary result={result} /> : null}
    </article>
  );
}

function SubmitSummary({ result }: { result: IndexingSubmitResult }) {
  const failed = result.items.filter((item) => !item.ok);
  return (
    <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="grid grid-cols-4 divide-x divide-slate-100 text-center">
        {(
          [
            ['Đã gửi', result.sent, 'text-emerald-700'],
            ['Lỗi', result.failed, result.failed ? 'text-red-700' : 'text-[#072348]'],
            ['Bỏ qua', result.skipped, result.skipped ? 'text-amber-700' : 'text-[#072348]'],
            ['Quota còn', result.quotaLeft, 'text-[#072348]'],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="px-2 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={clsx('mt-0.5 text-lg font-bold tabular-nums', tone)}>{value}</p>
          </div>
        ))}
      </div>
      {result.skipped > 0 ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-amber-800">
          {result.skipped} URL chưa gửi vì hết hạn mức ngày hoặc Google trả 429. Gửi lại vào ngày mai.
        </p>
      ) : null}
      {failed.length > 0 ? (
        <ul className="max-h-48 divide-y divide-slate-100 overflow-auto border-t border-slate-100">
          {failed.map((item) => (
            <li key={item.url} className="px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-50 px-1.5 py-0.5 font-bold text-red-700">{item.statusCode ?? 'lỗi'}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[#072348] hover:text-accent-600">
                  {item.url}
                </a>
                <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
              </div>
              {item.error ? <p className="mt-1 text-slate-500">{item.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
