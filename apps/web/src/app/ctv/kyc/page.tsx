'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CreditCard,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CrmKycSide, CrmKycStatus } from '@industriallink/contracts';
import { Button, Input } from '@/components/ui';
import { errorText } from '@/components/crm/format';
import { KYC_STATUS_META } from '@/components/ctv-shell';
import { KycDropzone } from '@/components/ctv-kyc-dropzone';
import { fetchKycImageBlob, fetchMyKyc, saveMyKyc, uploadKycImage } from '@/lib/ctv-kyc';
import { fetchMyPartner } from '@/lib/crm';

/** Danh sách ngân hàng Việt Nam theo chuẩn mã BIN NAPAS / VietQR. */
const BANKS = [
  { code: '970436', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)' },
  { code: '970415', name: 'Ngân hàng TMCP Công thương Việt Nam (VietinBank)' },
  { code: '970418', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)' },
  { code: '970405', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)' },
  { code: '970407', name: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)' },
  { code: '970422', name: 'Ngân hàng TMCP Quân đội (MB)' },
  { code: '970416', name: 'Ngân hàng TMCP Á Châu (ACB)' },
  { code: '970432', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)' },
  { code: '970423', name: 'Ngân hàng TMCP Tiên Phong (TPBank)' },
  { code: '970403', name: 'Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)' },
  { code: '970437', name: 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh (HDBank)' },
  { code: '970441', name: 'Ngân hàng TMCP Quốc tế Việt Nam (VIB)' },
  { code: '970443', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)' },
  { code: '970448', name: 'Ngân hàng TMCP Phương Đông (OCB)' },
  { code: '970426', name: 'Ngân hàng TMCP Hàng Hải Việt Nam (MSB)' },
  { code: '970449', name: 'Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)' },
  { code: '970431', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)' },
  { code: '970440', name: 'Ngân hàng TMCP Đông Nam Á (SeABank)' },
  { code: '970428', name: 'Ngân hàng TMCP Nam Á (Nam A Bank)' },
  { code: '970409', name: 'Ngân hàng TMCP Bắc Á (Bac A Bank)' },
  { code: '970425', name: 'Ngân hàng TMCP An Bình (ABBANK)' },
  { code: '970454', name: 'Ngân hàng TMCP Bản Việt (BVBank)' },
  { code: '970452', name: 'Ngân hàng TMCP Kiên Long (KienlongBank)' },
  { code: '970438', name: 'Ngân hàng TMCP Bảo Việt (BaoViet Bank)' },
];

export default function CtvKycPage() {
  const qc = useQueryClient();
  const partnerQuery = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const partnerId = partnerQuery.data?.partner?.id ?? null;
  const kycQuery = useQuery({
    queryKey: ['ctv-kyc'],
    queryFn: fetchMyKyc,
    enabled: Boolean(partnerId),
    retry: false,
  });

  const kyc = kycQuery.data;
  const status: CrmKycStatus = kyc?.status ?? 'UNVERIFIED';
  const meta = KYC_STATUS_META[status];

  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idIssuedDate, setIdIssuedDate] = useState('');
  const [idIssuedPlace, setIdIssuedPlace] = useState('');
  const [personalTaxCode, setPersonalTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [confirmChange, setConfirmChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Ảnh preview (object URL) cho 2 mặt.
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Nạp ảnh đã lưu từ endpoint private (cần token).
  useEffect(() => {
    if (!partnerId || !kyc?.hasFrontImage) return;
    let cancelled = false;
    void fetchKycImageBlob(partnerId, 'front')
      .then((url) => {
        if (!cancelled) setFrontUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImageError('Không tải được ảnh mặt trước.');
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId, kyc?.hasFrontImage]);

  useEffect(() => {
    if (!partnerId || !kyc?.hasBackImage) return;
    let cancelled = false;
    void fetchKycImageBlob(partnerId, 'back')
      .then((url) => {
        if (!cancelled) setBackUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImageError('Không tải được ảnh mặt sau.');
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId, kyc?.hasBackImage]);

  // Điền form từ hồ sơ đã có.
  useEffect(() => {
    if (!kyc) return;
    setFullName(kyc.fullName ?? '');
    setIdNumber(kyc.idNumber ?? '');
    setIdIssuedDate(kyc.idIssuedDate ? kyc.idIssuedDate.slice(0, 10) : '');
    setIdIssuedPlace(kyc.idIssuedPlace ?? '');
    setPersonalTaxCode(kyc.personalTaxCode ?? '');
    setPhone(kyc.phone ?? '');
    setBankCode(kyc.bankCode ?? '');
    setBankAccountNumber(kyc.bankAccountNumber ?? '');
    setBankAccountHolder(kyc.bankAccountHolder ?? '');
  }, [kyc]);

  const upload = useMutation({
    mutationFn: ({ side, file }: { side: CrmKycSide; file: File }) =>
      uploadKycImage(side, file),
    onSuccess: (result, variables) => {
      setError(null);
      setImageError(null);
      const url = URL.createObjectURL(variables.file);
      if (result.side === 'front') setFrontUrl(url);
      else setBackUrl(url);
      void qc.invalidateQueries({ queryKey: ['ctv-kyc'] });
    },
    onError: (err) => setError(errorText(err, 'Không tải được ảnh CCCD')),
  });

  const save = useMutation({
    mutationFn: () =>
      saveMyKyc({
        fullName: fullName.trim(),
        idNumber: idNumber.trim(),
        idIssuedDate: idIssuedDate || null,
        idIssuedPlace: idIssuedPlace.trim() || null,
        personalTaxCode: personalTaxCode.trim() || null,
        phone: phone.trim(),
        bankCode,
        bankName: BANKS.find((bank) => bank.code === bankCode)?.name ?? '',
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountHolder: bankAccountHolder.trim(),
        confirmChange,
      }),
    onSuccess: () => {
      setError(null);
      setSuccess('Đã gửi hồ sơ. CRM Admin sẽ duyệt trong thời gian sớm nhất.');
      setConfirmChange(false);
      void qc.invalidateQueries({ queryKey: ['ctv-kyc'] });
    },
    onError: (err) => {
      setSuccess(null);
      setError(errorText(err, 'Không lưu được hồ sơ xác thực'));
    },
  });

  const readOnly = status === 'PENDING';
  const verified = status === 'VERIFIED';
  const locked = readOnly || (verified && !confirmChange);

  function onPick(side: CrmKycSide, file: File) {
    upload.mutate({ side, file });
  }

  return (
    <div className="space-y-5">
      {/* Thẻ trạng thái */}
      <section
        className={clsx(
          'flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between',
          status === 'VERIFIED'
            ? 'border-emerald-200 bg-emerald-50'
            : status === 'REJECTED'
              ? 'border-rose-200 bg-rose-50'
              : status === 'PENDING'
                ? 'border-blue-200 bg-blue-50'
                : 'border-amber-200 bg-amber-50',
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            {verified ? (
              <BadgeCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldCheck className={clsx('h-5 w-5', meta.chip.split(' ')[1])} />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Trạng thái xác thực</h2>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1',
                  meta.chip,
                )}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-1 text-sm leading-snug text-slate-700">
              {status === 'UNVERIFIED'
                ? 'Chưa xác thực. Hoàn tất CCCD 2 mặt + tài khoản ngân hàng để nhận hoa hồng định kỳ.'
                : status === 'PENDING'
                  ? 'Hồ sơ đã gửi, đang chờ CRM Admin duyệt. Bạn không thể sửa cho tới khi có kết quả.'
                  : status === 'VERIFIED'
                    ? 'Đã xác thực. Bạn được nhận hoa hồng từ kỳ chi trả tiếp theo.'
                    : `Bị từ chối: ${kyc?.kycRejectReason ?? 'Vui lòng gửi lại hồ sơ.'}`}
            </p>
          </div>
        </div>
        {verified ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => setConfirmChange((value) => !value)}
          >
            <RefreshCw className="h-4 w-4" />
            Yêu cầu thay đổi thông tin
          </Button>
        ) : null}
      </section>

      {verified && confirmChange ? (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              Thay đổi thông tin sẽ chuyển hồ sơ về trạng thái Chờ duyệt lại
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              Kỳ chi trả đang chờ sẽ tạm giữ cho tới khi CRM Admin duyệt lại. Số dư vẫn được bảo
              lưu an toàn trong ví.
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Phần 1 — Định danh & CCCD 2 mặt */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#0F2440]">
                Phần 1 — Định danh cá nhân & CCCD 2 mặt
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Ảnh lưu trong kho riêng tư, chỉ bạn và kế toán CRM được xem.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <KycDropzone
              label="Mặt trước CCCD"
              hint="Chụp rõ 4 góc, không lóa, không che số"
              previewUrl={frontUrl}
              hasImage={Boolean(kyc?.hasFrontImage)}
              disabled={locked || upload.isPending}
              onPick={(file) => onPick('front', file)}
            />
            <KycDropzone
              label="Mặt sau CCCD"
              hint="Chụp rõ dòng số và ngày cấp"
              previewUrl={backUrl}
              hasImage={Boolean(kyc?.hasBackImage)}
              disabled={locked || upload.isPending}
              onPick={(file) => onPick('back', file)}
            />
          </div>
          {upload.isPending ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang tải ảnh lên kho riêng tư…
            </p>
          ) : null}
          {imageError ? <p className="mt-2 text-xs text-rose-600">{imageError}</p> : null}

          <div className="mt-4 space-y-3">
            <Field label="Họ và tên theo CCCD" required>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={locked}
              />
            </Field>
            <Field label="Số CCCD" required hint="12 chữ số, không có dấu cách">
              <Input
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="001203012345"
                inputMode="numeric"
                disabled={locked}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ngày cấp">
                <Input
                  type="date"
                  value={idIssuedDate}
                  onChange={(event) => setIdIssuedDate(event.target.value)}
                  disabled={locked}
                />
              </Field>
              <Field label="Nơi cấp">
                <Input
                  value={idIssuedPlace}
                  onChange={(event) => setIdIssuedPlace(event.target.value)}
                  placeholder="Hà Nội"
                  disabled={locked}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mã số thuế cá nhân" hint="Dùng để khấu trừ thuế TNCN">
                <Input
                  value={personalTaxCode}
                  onChange={(event) => setPersonalTaxCode(event.target.value)}
                  placeholder="Tùy chọn"
                  disabled={locked}
                />
              </Field>
              <Field label="Số điện thoại" required>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="09xx xxx xxx"
                  disabled={locked}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Phần 2 — Tài khoản ngân hàng */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#0F2440]">
                Phần 2 — Tài khoản ngân hàng nhận hoa hồng
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Chuyển khoản ngày 10 hàng tháng về tài khoản này.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Field label="Ngân hàng" required>
              <select
                value={bankCode}
                onChange={(event) => setBankCode(event.target.value)}
                disabled={locked}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">— Chọn ngân hàng —</option>
                {BANKS.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số tài khoản" required>
              <Input
                value={bankAccountNumber}
                onChange={(event) => setBankAccountNumber(event.target.value.replace(/\s/g, ''))}
                placeholder="0123456789"
                inputMode="numeric"
                disabled={locked}
              />
            </Field>
            <Field
              label="Tên chủ tài khoản"
              required
              hint="Bắt buộc khớp với Họ tên trên CCCD"
            >
              <Input
                value={bankAccountHolder}
                onChange={(event) => setBankAccountHolder(event.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={locked}
              />
            </Field>

            {fullName.trim() && bankAccountHolder.trim() &&
            !namesMatch(fullName, bankAccountHolder) ? (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900 ring-1 ring-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tên chủ tài khoản chưa khớp với họ tên trên CCCD. CRM Admin sẽ thấy cảnh báo này khi
                duyệt.
              </p>
            ) : null}
          </div>

          {/* Nút hành động */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            {error ? (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm leading-snug text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm leading-snug text-emerald-800 ring-1 ring-emerald-200">
                {success}
              </p>
            ) : null}

            {readOnly ? (
              <p className="text-sm leading-snug text-slate-500">
                Hồ sơ đang chờ duyệt — không thể sửa cho tới khi CRM Admin xử lý.
              </p>
            ) : verified && !confirmChange ? (
              <p className="text-sm leading-snug text-slate-500">
                Hồ sơ đã xác thực, đang ở chế độ chỉ đọc. Bấm “Yêu cầu thay đổi thông tin” để sửa.
              </p>
            ) : (
              <Button
                type="submit"
                className="w-full"
                disabled={save.isPending || upload.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {save.isPending ? 'Đang gửi…' : 'Gửi hồ sơ xác thực'}
              </Button>
            )}
          </div>
        </section>
      </div>

      <section className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          Inlink khấu trừ thuế TNCN 10% khi khoản chi trong một kỳ từ 2.000.000đ trở lên và bạn là
          cá nhân. Số thực nhận = tổng hoa hồng kỳ − thuế. Lịch chuyển khoản ngày 10 hàng tháng.
        </p>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1.5 text-xs font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
        {hint ? <span className="font-normal text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/** Bỏ dấu tiếng Việt + gộp khoảng trắng để so khớp tên. */
function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function namesMatch(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right;
}
