'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CrmImportLeadRow, ImportCrmLeadsResult } from '@industriallink/contracts';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { importCrmLeads } from '@/lib/crm';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === ';') && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCsvText(raw: string): CrmImportLeadRow[] {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const findCol = (keys: string[], fallbackIdx: number) => {
    const idx = header.findIndex((h) => keys.some((k) => h.includes(k)));
    return idx >= 0 ? idx : fallbackIdx;
  };
  const iCompany = findCol(['cong ty', 'company', 'doanh nghiep', 'ten'], 0);
  const iTax = findCol(['mst', 'ma so thue', 'tax'], 1);
  const iContact = findCol(['lien he', 'contact', 'hr', 'nguoi'], 2);
  const iPhone = findCol(['sdt', 'dien thoai', 'phone'], 3);
  const iEmail = findCol(['email', 'mail'], 4);
  const iProvince = findCol(['tinh', 'thanh', 'province', 'khu vuc'], 5);
  const iIndustry = findCol(['nganh', 'industry', 'linh vuc'], 6);
  const iAddress = findCol(['dia chi', 'address'], 7);

  const rows: CrmImportLeadRow[] = [];
  for (let i = 1; i < lines.length && rows.length < 300; i++) {
    const cols = parseCsvLine(lines[i]);
    const companyName = cols[iCompany] ?? '';
    const taxCode = cols[iTax] ?? '';
    const contactName = cols[iContact] ?? '';
    if (!companyName && !taxCode) continue;
    rows.push({
      companyName,
      taxCode,
      contactName: contactName || 'Bộ phận HR',
      contactPhone: cols[iPhone] || null,
      contactEmail: cols[iEmail] || null,
      province: cols[iProvince] || null,
      industry: cols[iIndustry] || null,
      address: cols[iAddress] || null,
    });
  }
  return rows;
}

export function CrmLeadImportPanel({
  sources,
  campaigns,
  canAutoAssign,
  onClose,
}: {
  sources: Array<{ value: string; label: string }>;
  campaigns: Array<{ value: string; label: string }>;
  canAutoAssign: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<CrmImportLeadRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState(sources[0]?.value ?? 'web');
  const [campaignId, setCampaignId] = useState('');
  const [autoAssign, setAutoAssign] = useState(canAutoAssign);
  const [result, setResult] = useState<ImportCrmLeadsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runImport = useMutation({
    mutationFn: () =>
      importCrmLeads({
        source,
        campaignId: campaignId || null,
        autoAssign: canAutoAssign ? autoAssign : false,
        rows,
      }),
    onSuccess: (res) => {
      setResult(res);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-sla-alerts'] });
    },
    onError: (err) => setError(errorText(err, 'Không import được danh sách lead')),
  });

  function downloadTemplate() {
    const csv = [
      '\uFEFFTenCongTy,MaSoThue,NguoiLienHe,SoDienThoai,Email,TinhThanh,NganhNghe,DiaChi',
      '"Công ty TNHH Cơ khí Mẫu","0101234567","Nguyễn Văn A","0912345678","hr@cokhimau.vn","Bắc Ninh","Cơ khí chế tạo","KCN VSIP Bắc Ninh"',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-import-lead-inlink.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvText(String(reader.result ?? ''));
      setRows(parsed);
      if (parsed.length === 0) {
        setError('Không đọc được dòng dữ liệu nào. Vui lòng dùng đúng file CSV mẫu.');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  return (
    <section className="rounded-[22px] border border-[#DCE6F4] bg-white p-5 crm-surface">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FB] text-[#072348]">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#072348]">Import Lead hàng loạt (CSV · Tự lọc trùng MST/SĐT)</h2>
            <p className="text-xs text-slate-500">
              Tối đa 300 dòng/lần. Hệ thống tự động bỏ qua dòng trùng Mã số thuế hoặc Số điện thoại đã có trong CRM.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE6F4] bg-[#F5F8FC] px-3 py-1.5 text-xs font-semibold text-[#072348] hover:bg-[#E8F0FA]"
          >
            <Download className="h-3.5 w-3.5" />
            Tải file CSV mẫu
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="block text-xs font-semibold text-[#072348]">
          Chọn file CSV (UTF-8)
          <div className="mt-1.5">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#0B468C]/40 bg-[#F5F8FC] px-3 py-2 text-xs font-semibold text-[#072348] hover:bg-[#EEF4FB]">
              <Upload className="h-4 w-4 text-[#E8872A]" />
              <span className="truncate">{fileName || 'Chọn file .csv từ máy…'}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </label>
        <label className="block text-xs font-semibold text-[#072348]">
          Nguồn khách hàng
          <select value={source} onChange={(e) => setSource(e.target.value)} className={`${crmFieldClass} mt-1.5`}>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#072348]">
          Gắn chiến dịch (tuỳ chọn)
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={`${crmFieldClass} mt-1.5`}>
            <option value="">Không gắn chiến dịch</option>
            {campaigns.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canAutoAssign ? (
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[#072348]">
          <input
            type="checkbox"
            checked={autoAssign}
            onChange={(e) => setAutoAssign(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-[#072348]"
          />
          Tự động chia đều Round-Robin cho nhân viên kinh doanh ngay sau khi import
        </label>
      ) : null}

      {error ? <p className="mt-3 text-xs font-medium text-rose-600">{error}</p> : null}

      {rows.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#072348]">
              Xem trước {Math.min(rows.length, 5)} / {rows.length} dòng đọc được:
            </p>
            <button
              type="button"
              disabled={runImport.isPending}
              onClick={() => runImport.mutate()}
              className={`${crmButtonClass} inline-flex items-center gap-1.5 text-xs`}
            >
              <Upload className="h-3.5 w-3.5" />
              {runImport.isPending ? 'Đang import & lọc trùng…' : `Import ${rows.length} lead`}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#DCE6F4]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F8FC] text-[#072348]">
                <tr>
                  <th className="px-3 py-2">Công ty</th>
                  <th className="px-3 py-2">MST</th>
                  <th className="px-3 py-2">Liên hệ</th>
                  <th className="px-3 py-2">SĐT</th>
                  <th className="px-3 py-2">Tỉnh/TP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 5).map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.companyName}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">{r.taxCode}</td>
                    <td className="px-3 py-2 text-slate-700">{r.contactName}</td>
                    <td className="px-3 py-2 text-slate-600">{r.contactPhone || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.province || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-2xl border border-[#C7D9EE] bg-[#EEF4FB] p-4 text-xs text-[#072348]">
          <p className="font-bold">
            Hoàn tất import: Đã tạo {result.createdCount} lead mới · Bỏ qua {result.skippedDuplicateCount} trùng MST/SĐT · {result.invalidCount} dòng thiếu dữ liệu
            {result.assignedCount > 0 ? ` · Đã chia Round-Robin ${result.assignedCount} lead.` : '.'}
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-slate-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Dòng {e.rowIndex} ({e.companyName}): {e.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
