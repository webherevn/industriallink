'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Check,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  QrCode,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Button, Card } from '@/components/ui';
import { fetchMyPartner } from '@/lib/crm';

/** Các đích đến của link giới thiệu. */
const LINK_TARGETS = [
  { id: 'pricing', label: 'Bảng giá dịch vụ', path: '/bang-gia' },
  { id: 'home', label: 'Trang chủ Inlink', path: '/' },
  { id: 'signup', label: 'Trang đăng ký NTD', path: '/recruiter/dang-ky' },
] as const;

/** Gói dịch vụ có tính hoa hồng — bảng tóm tắt để CTV tư vấn khách. */
const PLANS = [
  {
    name: 'Gói Tin đăng',
    price: 'Từ 1.900.000đ/tháng',
    commission: 'Có hoa hồng',
    note: 'Đăng tin tuyển dụng, giá > 0',
  },
  {
    name: 'Gói Tin đăng Plus',
    price: 'Từ 3.900.000đ/tháng',
    commission: 'Có hoa hồng',
    note: 'Đăng tin nâng cao, nhiều vị trí hơn',
  },
  {
    name: 'Gói Săn nhân sự',
    price: 'Từ 5.900.000đ/tháng',
    commission: 'Có hoa hồng',
    note: 'Tìm kiếm & sàng lọc ứng viên theo yêu cầu',
  },
  {
    name: 'Gói Săn chuyên sâu',
    price: 'Theo báo giá',
    commission: 'Có hoa hồng',
    note: 'Bộ lọc nâng cao, hỗ trợ tuyển dụng',
  },
  {
    name: 'Gói Khám phá',
    price: '0đ',
    commission: 'Không tính hoa hồng',
    note: 'Dùng thử miễn phí — không sinh hoa hồng',
  },
  {
    name: 'Nạp lẻ Credit',
    price: 'Thanh toán riêng',
    commission: 'Không tính hoa hồng',
    note: 'Mua thêm lượt xem hồ sơ, không tính hoa hồng',
  },
];

export default function CtvLinksPage() {
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [targetId, setTargetId] = useState<string>(LINK_TARGETS[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  const code = mine.data?.partner?.code ?? null;
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://inlink.vn';

  const link = useMemo(() => {
    if (!code) return '';
    const target = LINK_TARGETS.find((item) => item.id === targetId) ?? LINK_TARGETS[0];
    return `${origin}${target.path}?ref=${encodeURIComponent(code)}`;
  }, [code, origin, targetId]);

  const templates = useMemo(() => {
    if (!link) return [];
    return [
      `Chào anh/chị, Inlink giúp tuyển dụng công nghiệp nhanh hơn: đăng tin, săn ứng viên, quản lý hồ sơ tập trung một chỗ. Anh/chị đăng ký tại link này để em hỗ trợ ưu đãi: ${link}`,
      `Anh/chị đang cần tuyển dụng vị trí kỹ thuật hay kinh doanh? Inlink có sẵn tin đăng + dịch vụ săn nhân sự theo yêu cầu. Đăng ký tại: ${link}`,
      `Gửi anh/chị bảng giá Inlink đầy đủ (gói tin đăng & gói săn nhân sự). Khách đăng ký qua link của em thì em hỗ trợ theo sau bán: ${link}`,
    ];
  }, [link]);

  useEffect(() => {
    if (!link) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(link, {
      width: 320,
      margin: 1,
      color: { dark: '#0F2440', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function downloadQr() {
    if (!link) return;
    void QRCode.toDataURL(link, {
      width: 320,
      margin: 1,
      color: { dark: '#0F2440', light: '#ffffff' },
    })
      .then((dataUrl) => {
        const anchor = document.createElement('a');
        anchor.download = `inlink-ctv-${code}.png`;
        anchor.href = dataUrl;
        anchor.click();
      })
      .catch(() => {
        setQrError(true);
      });
  }

  return (
    <div className="space-y-5">
      {/* Bộ tạo link */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Tạo link giới thiệu</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Chọn đích đến — mã CTV được gắn tự động. Mỗi khách mở link sẽ được ghi nhận trong
              14 ngày.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {LINK_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => setTargetId(target.id)}
              className={clsx(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                targetId === target.id
                  ? 'bg-[#0F2440] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {target.label}
            </button>
          ))}
        </div>

        {mine.isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải mã CTV...
          </p>
        ) : !code ? (
          <p className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Bạn chưa có mã CTV. Hãy đăng ký ở trang Tổng quan trước.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="ctv-link">
                Link giới thiệu
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="ctv-link"
                  readOnly
                  value={link}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => void copy(link, 'link')}
                >
                  {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === 'link' ? 'Đã chép' : 'Chép link'}
                </Button>
              </div>
              <p className="mt-2 text-xs leading-snug text-slate-500">
                Mã CTV: <span className="font-mono font-semibold text-slate-700">{code}</span>
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg bg-white">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Mã QR link giới thiệu" className="h-full w-full" />
                ) : qrError ? (
                  <p className="px-2 text-center text-[11px] text-rose-600">
                    Không tạo được mã QR
                  </p>
                ) : (
                  <QrCode className="h-10 w-10 animate-pulse text-slate-200" strokeWidth={1.2} />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full px-3 py-1.5 text-[13px]"
                onClick={downloadQr}
              >
                <Download className="h-3.5 w-3.5" />
                Tải PNG
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Mẫu tin nhắn mời */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Mẫu tin nhắn mời khách hàng B2B</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Chuẩn Zalo / Email — link giới thiệu của bạn đã được điền sẵn. Bấm một nút là chép
              toàn bộ.
            </p>
          </div>
        </div>
        {templates.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Đăng ký mã CTV để có mẫu tin nhắn.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {templates.map((template, index) => (
              <li
                key={template}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Mẫu {index + 1}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{template}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2.5 h-9 px-3 py-1.5 text-[13px]"
                  onClick={() => void copy(template, `tpl-${index}`)}
                >
                  {copied === `tpl-${index}` ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === `tpl-${index}` ? 'Đã chép' : 'Chép tin nhắn'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tóm tắt gói dịch vụ */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Tóm tắt gói dịch vụ Inlink</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Bảng giá gọn để tư vấn khách. Gói Khám phá 0đ và nạp lẻ Credit không tính hoa hồng.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Gói dịch vụ</th>
                <th className="px-5 py-3">Giá</th>
                <th className="px-5 py-3">Hoa hồng</th>
                <th className="px-5 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map((plan) => (
                <tr key={plan.name} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium text-slate-900">{plan.name}</td>
                  <td className="px-5 py-3 text-slate-700">{plan.price}</td>
                  <td className="px-5 py-3">
                    <span
                      className={clsx(
                        'rounded-full px-2.5 py-1 text-xs font-semibold',
                        plan.commission === 'Có hoa hồng'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {plan.commission}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs leading-snug text-slate-500">{plan.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ghi chú nhất quán về phạm vi áp dụng hoa hồng. */}
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        Hoa hồng áp dụng cho mọi giao dịch mua Gói Tin đăng và Gói Tin săn (mua mới, mua lại, nâng
        cấp) trọn đời khách hàng. Không áp dụng cho Gói Khám phá (0đ) và Nạp thêm Credit.
      </p>
    </div>
  );
}
