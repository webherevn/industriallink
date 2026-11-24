'use client';

import { isCmsAdminRole, isCrmRole, isSalesStaff, MfaMethod, UserRole, isLoginMfaChallenge } from '@industriallink/contracts';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError, tokenStore } from '@/lib/api';
import { clearAuthQueryCache, login, logout, resendLoginOtp, switchToRecruiter, verifyLoginOtp } from '@/lib/auth';
import { goToRecruiterApp, isAdminHostname, isCrmHostname, isRecruiterHostname, navigateAfterLogin } from '@/lib/hosts';
import { registerHref, safeInternalPath } from '@/lib/safe-next';

export default function LoginPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'credentials' | 'mfa' | 'switch_recruiter'>('credentials');
  const [switchingRole, setSwitchingRole] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  const [onCrmHost, setOnCrmHost] = useState(false);
  const [onRecruiterHost, setOnRecruiterHost] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVerified(params.get('verified') === '1');
    setNextPath(safeInternalPath(params.get('next')));
    setOnAdminHost(isAdminHostname());
    setOnCrmHost(isCrmHostname());
    setOnRecruiterHost(isRecruiterHostname());
  }, []);

  function goHome(role: UserRole) {
    clearAuthQueryCache(queryClient);
    // admin.inlink.vn: luôn ở lại origin hiện tại, không gọi goToAdminApp/goToRecruiterApp
    if (typeof window !== 'undefined' && isCrmHostname()) {
      if (!isCrmRole(role)) {
        void logout();
        setError('Tài khoản này không có quyền vào CRM.');
        return;
      }
      window.location.assign(nextPath && nextPath.startsWith('/crm') ? nextPath : '/crm');
      return;
    }
    if (typeof window !== 'undefined' && isAdminHostname()) {
      if (isSalesStaff(role)) {
        navigateAfterLogin(role, '/crm');
        return;
      }
      if (!isCmsAdminRole(role)) {
        void logout();
        setError('Tài khoản này không có quyền vào admin. Dùng Superadmin hoặc Biên tập viên.');
        return;
      }
      const dest = nextPath && nextPath.startsWith('/admin') ? nextPath : '/admin';
      window.location.assign(dest);
      return;
    }
    if (isSalesStaff(role)) {
      navigateAfterLogin(role, '/crm');
      return;
    }
    if (isCmsAdminRole(role)) {
      navigateAfterLogin(role, nextPath && nextPath.startsWith('/admin') ? nextPath : '/admin');
      return;
    }
    if (role === UserRole.Candidate && typeof window !== 'undefined' && isRecruiterHostname()) {
      setError(null);
      setStep('switch_recruiter');
      return;
    }
    navigateAfterLogin(role, role === UserRole.Candidate ? nextPath : null);
  }

  async function onSwitchToRecruiter() {
    setError(null);
    setSwitchingRole(true);
    try {
      await switchToRecruiter();
      clearAuthQueryCache(queryClient);
      goToRecruiterApp('/company');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể chuyển đổi tài khoản.');
    } finally {
      setSwitchingRole(false);
    }
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
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
            {!onAdminHost && !onCrmHost && (
              <GoogleAuthButton
                mode="login"
                role={onRecruiterHost ? UserRole.Recruiter : UserRole.Candidate}
                disabled={loading}
                onError={(msg) => {
                  setInfo(null);
                  setError(msg);
                }}
                onSuccess={(res) => {
                  setError(null);
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
                }}
              />
            )}
          </>
        ) : step === 'switch_recruiter' ? (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-900">Tài khoản đang là Ứng viên</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Email này hiện được đăng ký với vai trò <strong>Ứng viên</strong>. Nếu bạn là{' '}
              <strong>Nhà tuyển dụng</strong> lỡ đăng ký nhầm, bạn có thể chuyển sang tài khoản NTD
              ngay mà không cần đổi email (hồ sơ tìm việc cũ sẽ được tự động ẩn khỏi tìm kiếm AI).
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2.5 pt-1">
              <Button
                type="button"
                className="w-full"
                disabled={switchingRole}
                onClick={onSwitchToRecruiter}
              >
                {switchingRole ? 'Đang chuyển đổi...' : 'Chuyển sang tài khoản Nhà tuyển dụng'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={switchingRole}
                onClick={() => navigateAfterLogin(UserRole.Candidate, nextPath)}
              >
                Tiếp tục vào cổng Ứng viên
              </Button>
            </div>
          </div>
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
