'use client';

import { UserRole } from '@industriallink/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Card, Field, Input } from '@/components/ui';
import { register, resendOtp, verifyOtp } from '@/lib/auth';
import { ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole.Candidate | UserRole.Recruiter>(UserRole.Candidate);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  async function onSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await register({ displayName, email, password, role });
      setDevOtp(res.devOtp ?? null);
      if (res.devOtp) setOtp(res.devOtp);
      setInfo('Đã gửi mã OTP tới email của bạn. Kiểm tra hộp thư (và Mailpit nếu chạy local).');
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      router.push('/login?verified=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Xác thực thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await resendOtp(email);
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
        <BrandLogo href="/" width={240} />
      </div>
      <Card>
        {step === 'form' ? (
          <>
            <h1 className="text-xl font-bold text-slate-900">Tạo tài khoản</h1>
            <p className="mt-1 text-sm text-slate-500">Bắt đầu hành trình sự nghiệp cùng AI.</p>
            <form onSubmit={onSubmitForm} className="mt-6 space-y-4">
              <Field label="Tôi là">
                <div className="grid grid-cols-2 gap-2">
                  <RoleOption
                    active={role === UserRole.Candidate}
                    label="Ứng viên"
                    onClick={() => setRole(UserRole.Candidate)}
                  />
                  <RoleOption
                    active={role === UserRole.Recruiter}
                    label="Nhà tuyển dụng"
                    onClick={() => setRole(UserRole.Recruiter)}
                  />
                </div>
              </Field>
              <Field label="Họ và tên">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Mật khẩu">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đăng ký'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Xác thực OTP</h1>
            <p className="mt-1 text-sm text-slate-500">
              Nhập mã 6 số đã gửi tới <b>{email}</b>.
            </p>
            {info && (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{info}</p>
            )}
            {devOtp && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Chế độ dev: mã OTP của bạn là <b>{devOtp}</b>
              </p>
            )}
            <form onSubmit={onVerify} className="mt-6 space-y-4">
              <Field label="Mã OTP">
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang xác thực...' : 'Xác thực & tiếp tục'}
              </Button>
            </form>
            <button
              type="button"
              className="mt-4 w-full text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
              disabled={resending || loading}
              onClick={onResend}
            >
              {resending ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
            </button>
          </>
        )}
      </Card>
      <p className="mt-4 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-medium text-brand-600">
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}

function RoleOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-lg border px-3 py-2.5 text-sm font-medium transition ' +
        (active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')
      }
    >
      {label}
    </button>
  );
}
