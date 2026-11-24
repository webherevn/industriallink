'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isCmsAdminRole, isSalesStaff, MfaMethod, UserRole } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { CtvShell } from '@/components/ctv-shell';
import { Badge, Button, Card, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  clearAuthQueryCache,
  confirmTotp,
  deleteMyAccount,
  disableTotp,
  fetchDeleteAccountStatus,
  fetchMe,
  setupTotp,
  switchToRecruiter,
  updateMfa,
} from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';
import { goToRecruiterApp, isCtvHostname } from '@/lib/hosts';

export default function AccountPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [onCtvHost, setOnCtvHost] = useState(false);
  useEffect(() => {
    setOnCtvHost(isCtvHostname());
  }, []);
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });
  const isCandidate = user?.role === UserRole.Candidate;
  const isInternalAccount = Boolean(
    user &&
      (user.role === UserRole.SuperAdmin || isCmsAdminRole(user.role) || isSalesStaff(user.role)),
  );
  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    enabled: isCandidate,
    retry: false,
  });
  const { data: deleteStatus, isLoading: deleteStatusLoading } = useQuery({
    queryKey: ['account-delete-status'],
    queryFn: fetchDeleteAccountStatus,
    enabled: Boolean(user && !isInternalAccount),
    retry: false,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [switchOpen, setSwitchOpen] = useState(false);

  const switchRoleMutation = useMutation({
    mutationFn: switchToRecruiter,
    onSuccess: () => {
      clearAuthQueryCache(qc);
      goToRecruiterApp('/company');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteMyAccount({
        confirmText: confirmText.trim(),
        reason: deleteReason.trim() || undefined,
      }),
    onSuccess: () => {
      clearAuthQueryCache(qc);
      router.replace('/login');
    },
  });

  const mfaMutation = useMutation({
    mutationFn: (enabled: boolean) => updateMfa(enabled),
    onSuccess: (next) => qc.setQueryData(['me'], next),
  });

  const [totpQr, setTotpQr] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const setupMutation = useMutation({
    mutationFn: setupTotp,
    onSuccess: (res) => setTotpQr({ secret: res.secret, qrCodeDataUrl: res.qrCodeDataUrl }),
  });

  const confirmMutation = useMutation({
    mutationFn: (code: string) => confirmTotp(code),
    onSuccess: (next) => {
      qc.setQueryData(['me'], next);
      setTotpQr(null);
      setTotpCode('');
    },
  });

  const disableMutation = useMutation({
    mutationFn: disableTotp,
    onSuccess: (next) => {
      qc.setQueryData(['me'], next);
      setTotpQr(null);
      setTotpCode('');
    },
  });

  const isEmailOtpActive = user?.mfaEnabled && user.mfaMethod === MfaMethod.EmailOtp;
  const isTotpActive = user?.mfaEnabled && user.mfaMethod === MfaMethod.Totp;

  if (isLoading || !user) {
    if (onCtvHost) {
      return (
        <CtvShell>
          <p className="text-sm text-slate-500">Đang tải...</p>
        </CtvShell>
      );
    }
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Đang tải...</p>
      </AppShell>
    );
  }

  const content = (
      <div className={isCandidate ? 'min-w-0 space-y-4' : 'w-full space-y-6'}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">Bảo mật và tuỳ chọn đăng nhập.</p>
        </div>

        <div className={isCandidate ? 'space-y-4' : 'grid items-start gap-5 lg:grid-cols-2'}>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Mã OTP qua email</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Sau khi nhập mật khẩu đúng, hệ thống gửi mã 6 số tới email để xác thực thêm.
                  </p>
                </div>
                {isEmailOtpActive && <Badge tone="green">Đang bật</Badge>}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500">{user.email}</p>
                <Button
                  type="button"
                  variant={isEmailOtpActive ? 'ghost' : 'primary'}
                  disabled={mfaMutation.isPending}
                  onClick={() => mfaMutation.mutate(!isEmailOtpActive)}
                >
                  {mfaMutation.isPending
                    ? 'Đang lưu...'
                    : isEmailOtpActive
                      ? 'Tắt'
                      : 'Bật mã OTP email'}
                </Button>
              </div>

              {mfaMutation.isError && (
                <p className="mt-3 text-sm text-red-600">
                  {mfaMutation.error instanceof ApiError
                    ? mfaMutation.error.message
                    : 'Không cập nhật được MFA'}
                </p>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Ứng dụng xác thực (Google Authenticator...)
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Mã 6 số tự đổi mỗi 30 giây trên app, không cần chờ email — an toàn hơn.
                  </p>
                </div>
                {isTotpActive && <Badge tone="green">Đang bật</Badge>}
              </div>

              {isTotpActive ? (
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">TOTP đang bảo vệ tài khoản của bạn.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disableMutation.isPending}
                    onClick={() => disableMutation.mutate()}
                  >
                    {disableMutation.isPending ? 'Đang tắt...' : 'Tắt TOTP'}
                  </Button>
                </div>
              ) : totpQr ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-600">
                    Mở app xác thực → quét QR bên dưới (hoặc nhập secret tay), rồi nhập mã 6 số hiện
                    trên app để xác nhận.
                  </p>
                  <Image
                    src={totpQr.qrCodeDataUrl}
                    alt="Mã QR liên kết ứng dụng xác thực"
                    width={176}
                    height={176}
                    unoptimized
                    className="h-44 w-44 rounded-lg border border-slate-200"
                  />
                  <p className="break-all text-xs text-slate-400">Secret: {totpQr.secret}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      inputMode="numeric"
                      className="!w-32 text-center text-lg tracking-widest"
                    />
                    <Button
                      type="button"
                      disabled={confirmMutation.isPending || totpCode.length !== 6}
                      onClick={() => confirmMutation.mutate(totpCode)}
                    >
                      {confirmMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận & bật'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setTotpQr(null)}>
                      Huỷ
                    </Button>
                  </div>
                  {confirmMutation.isError && (
                    <p className="text-sm text-red-600">
                      {confirmMutation.error instanceof ApiError
                        ? confirmMutation.error.message
                        : 'Không xác nhận được mã'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">Chưa liên kết ứng dụng xác thực.</p>
                  <Button
                    type="button"
                    disabled={setupMutation.isPending}
                    onClick={() => setupMutation.mutate()}
                  >
                    {setupMutation.isPending ? 'Đang tạo QR...' : 'Liên kết ứng dụng xác thực'}
                  </Button>
                </div>
              )}

              {setupMutation.isError && (
                <p className="mt-3 text-sm text-red-600">Không tạo được QR TOTP</p>
              )}
              {disableMutation.isError && (
                <p className="mt-3 text-sm text-red-600">Không tắt được TOTP</p>
              )}
            </Card>
        </div>

        {user.mfaEnabled && (
          <p className="text-xs text-slate-400">
            Chỉ một phương thức MFA có thể bật cùng lúc — bật phương thức mới sẽ tự tắt phương
            thức cũ.
          </p>
        )}

        {isCandidate && (
          <Card className="border-sky-200/80 bg-sky-50/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#072348]">
                  <Building2 className="h-4 w-4 shrink-0 text-[#0B468C]" />
                  Bạn là Nhà tuyển dụng lỡ đăng ký nhầm?
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Chuyển tài khoản này sang <strong>Nhà tuyển dụng (NTD)</strong> ngay mà không cần
                  đổi email. Hồ sơ tìm việc hiện tại sẽ được tự động ẩn khỏi tìm kiếm AI.
                </p>
              </div>
              {!switchOpen && (
                <button
                  type="button"
                  onClick={() => setSwitchOpen(true)}
                  className="shrink-0 rounded-xl border border-[#0B468C]/30 bg-white px-3.5 py-2 text-xs font-semibold text-[#072348] transition hover:bg-sky-50"
                >
                  Chuyển sang tài khoản NTD
                </button>
              )}
            </div>

            {switchOpen && (
              <div className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-white p-4">
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700">
                  <li>
                    Tài khoản sẽ chuyển <strong>1 chiều</strong> sang vai trò{' '}
                    <strong>Nhà tuyển dụng</strong> và điều hướng tới cổng{' '}
                    <code>tuyendung.inlink.vn</code> để thiết lập hồ sơ doanh nghiệp &amp; tải ĐKKD.
                  </li>
                  <li>
                    Hồ sơ Ứng viên cũ sẽ được tự động <strong>ẩn khỏi tìm kiếm AI</strong> và ngừng
                    nhận email gợi ý việc làm.
                  </li>
                </ul>
                {switchRoleMutation.isError && (
                  <p className="text-xs font-medium text-rose-600">
                    {switchRoleMutation.error instanceof ApiError
                      ? switchRoleMutation.error.message
                      : 'Không thể chuyển đổi tài khoản. Vui lòng thử lại.'}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={switchRoleMutation.isPending}
                    onClick={() => switchRoleMutation.mutate()}
                    className="rounded-xl bg-[#072348] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0B468C] disabled:opacity-50"
                  >
                    {switchRoleMutation.isPending
                      ? 'Đang chuyển đổi...'
                      : 'Xác nhận chuyển sang NTD'}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={switchRoleMutation.isPending}
                    onClick={() => setSwitchOpen(false)}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {!isInternalAccount && (
          <Card className="border-rose-200/80 bg-rose-50/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-base font-semibold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  Đóng / Xóa tài khoản
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {deleteStatus?.note ??
                    'Yêu cầu đóng tài khoản và ẩn danh dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.'}
                </p>
              </div>
              {deleteStatus?.canDelete && !deleteOpen && (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="shrink-0 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Yêu cầu xóa tài khoản
                </button>
              )}
            </div>

            {deleteStatusLoading && (
              <p className="mt-3 text-xs text-slate-500">Đang kiểm tra điều kiện tài khoản...</p>
            )}

            {deleteStatus && !deleteStatus.canDelete && deleteStatus.blockers.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <p className="font-semibold">
                  Chưa thể tự đóng tài khoản do đang có các ràng buộc sau:
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {deleteStatus.blockers.map((b) => (
                    <li key={b.code}>{b.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-amber-800">
                  Vui lòng hoàn tất/tất toán các mục trên hoặc liên hệ{' '}
                  <a href="mailto:hotro@inlink.vn" className="font-semibold underline">
                    hotro@inlink.vn
                  </a>{' '}
                  để được hỗ trợ đóng tài khoản.
                </p>
              </div>
            )}

            {deleteStatus?.canDelete && deleteOpen && (
              <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-white p-4">
                <p className="text-xs leading-relaxed text-slate-700">
                  Hành động này sẽ <strong>khóa vĩnh viễn</strong> quyền đăng nhập và không thể hoàn
                  tác. Nhập chính xác <code className="rounded bg-rose-50 px-1.5 py-0.5 font-bold text-rose-700">XOA TAI KHOAN</code> để xác nhận:
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Nhập XOA TAI KHOAN"
                  />
                  <Input
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Lý do (không bắt buộc)"
                    maxLength={500}
                  />
                </div>
                {deleteMutation.isError && (
                  <p className="text-xs font-medium text-rose-600">
                    {deleteMutation.error instanceof ApiError
                      ? deleteMutation.error.message
                      : 'Không thể xóa tài khoản. Vui lòng thử lại.'}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={
                      deleteMutation.isPending ||
                      confirmText.trim().toUpperCase() !== 'XOA TAI KHOAN'
                    }
                    onClick={() => deleteMutation.mutate()}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Đang xử lý...' : 'Xác nhận xóa vĩnh viễn'}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmText('');
                      setDeleteReason('');
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
  );

  if (onCtvHost) {
    return <CtvShell>{content}</CtvShell>;
  }

  return (
    <AppShell wide={isCandidate}>
      {isCandidate ? (
        <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <CandidateSidebar
            displayName={candidate?.displayName ?? user?.displayName ?? 'Ứng viên'}
            email={user?.email}
            hasAvatar={Boolean(candidate?.hasAvatar)}
            position={candidate?.profile?.currentPosition}
            profileCompletion={candidate?.profileCompletion}
          />
          {content}
        </div>
      ) : (
        content
      )}
    </AppShell>
  );
}
