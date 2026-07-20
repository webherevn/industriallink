'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';
import { MfaMethod } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { confirmTotp, disableTotp, fetchMe, setupTotp, updateMfa } from '@/lib/auth';

export default function AccountPage() {
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
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

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">Bảo mật và tuỳ chọn đăng nhập.</p>
        </div>

        {isLoading || !user ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : (
          <>
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

            {user.mfaEnabled && (
              <p className="text-xs text-slate-400">
                Chỉ một phương thức MFA có thể bật cùng lúc — bật phương thức mới sẽ tự tắt phương
                thức cũ.
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
