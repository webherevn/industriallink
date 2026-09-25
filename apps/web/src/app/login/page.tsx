'use client';

import { isCmsAdminRole, MfaMethod, UserRole, isLoginMfaChallenge } from '@industriallink/contracts';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError, tokenStore } from '@/lib/api';
import { clearAuthQueryCache, login, resendLoginOtp, verifyLoginOtp } from '@/lib/auth';
import { isAdminHostname, navigateAfterLogin } from '@/lib/hosts';
import { registerHref, safeInternalPath } from '@/lib/safe-next';

export default function LoginPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>(MfaMethod.EmailOtp);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [onAdminHost, setOnAdminHost] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVerified(params.get('verified') === '1');
    setNextPath(safeInternalPath(params.get('next')));
    setOnAdminHost(isAdminHostname());
  }, []);

  function goHome(role: UserRole) {
    clearAuthQueryCache(queryClient);
    // admin.inlink.vn: luôn ở lại origin hiện tại, không gọi goToAdminApp/goToRecruiterApp
    if (typeof window !== 'undefined' && isAdminHostname()) {
      if (!isCmsAdminRole(role)) {
        tokenStore.clear();
        setError('Tài khoản này không có quyền vào admin. Dùng Superadmin hoặc Biên tập viên.');
        return;
      }
      const dest = nextPath && nextPath.startsWith('/admin') ? nextPath : '/admin';
      window.location.assign(dest);
      return;
    }
    if (isCmsAdminRole(role)) {
      navigateAfterLogin(role, nextPath && nextPath.startsWith('/admin') ? nextPath : '/admin');
      return;
    }
    navigateAfterLogin(role, role === UserRole.Candidate ? nextPath : null);
  }

  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      if (isLoginMfaChallenge(res)) {
        setMfaToken(res.mfaToken);
        setMfaMethod(res.mfaMethod);
        setDevOtp(res.devOtp ?? null);
        if (res.devOtp) setOtp(res.devOtp);
        setInfo(res.message);
        setStep('mfa');
        return;
      }
      goHome(res.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await verifyLoginOtp(mfaToken, otp);
      if (isLoginMfaChallenge(res)) {
        setError('Xác thực MFA chưa hoàn tất');
        return;
      }
      goHome(res.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xác thực OTP thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function onResendMfa() {
    if (!mfaToken) return;
    setError(null);
    setResending(true);
    try {
      const res = await resendLoginOtp(mfaToken);
      setDevOtp(res.devOtp ?? null);
      if (res.devOtp) setOtp(res.devOtp);
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi lại được OTP');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex justify-center">
        <BrandLogo href="/" width={320} />
      </div>
      <Card>
        {step === 'credentials' ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">
              {onAdminHost ? 'Đăng nhập Superadmin' : 'Đăng nhập'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {onAdminHost
                ? 'Chỉ tài khoản Superadmin mới vào được bảng quản trị.'
                : 'Chào mừng trở lại.'}
            </p>
            {onAdminHost && (
              <p className="mt-2 text-[11px] text-slate-400" data-il-build="admin-login-v3">
                admin-login-v3
              </p>
            )}
            {/* Marker luôn có trong HTML/SSR để curl | grep kiểm tra deploy */}
            <span hidden data-il-build="admin-login-v3">
              admin-login-v3
            </span>
            {verified && (
              <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                Xác thực thành công! Vui lòng đăng nhập.
              </p>
            )}
            <form onSubmit={onSubmitCredentials} className="mt-6 space-y-4">
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Mật khẩu">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Xác thực MFA</h1>
            <p className="mt-1 text-sm text-slate-500">
              {mfaMethod === MfaMethod.Totp
                ? 'Mở ứng dụng xác thực và nhập mã 6 số hiện tại để hoàn tất đăng nhập.'
                : 'Nhập mã OTP đã gửi tới email để hoàn tất đăng nhập.'}
            </p>
            {info && (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{info}</p>
            )}
            {devOtp && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Chế độ dev: mã OTP của bạn là <b>{devOtp}</b>
              </p>
            )}
            <form onSubmit={onSubmitMfa} className="mt-6 space-y-4">
              <Field label={mfaMethod === MfaMethod.Totp ? 'Mã từ ứng dụng xác thực' : 'Mã OTP'}>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  required
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang xác thực...' : 'Xác nhận'}
              </Button>
              {mfaMethod !== MfaMethod.Totp && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={resending}
                  onClick={onResendMfa}
                >
                  {resending ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
                </Button>
              )}
              <button
                type="button"
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setStep('credentials');
                  setMfaToken(null);
                  setMfaMethod(MfaMethod.EmailOtp);
                  setOtp('');
                  setDevOtp(null);
                  setError(null);
                  setInfo(null);
                }}
              >
                Quay lại đăng nhập
              </button>
            </form>
          </>
        )}
      </Card>
      {!onAdminHost && (
        <p className="mt-4 text-center text-sm text-slate-500">
          Chưa có tài khoản?{' '}
          <Link href={registerHref(nextPath)} className="font-medium text-brand-600">
            Đăng ký
          </Link>
        </p>
      )}
    </main>
  );
}
