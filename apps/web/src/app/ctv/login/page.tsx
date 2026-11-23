'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, CheckCircle2, Coins, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { UserRole } from '@industriallink/contracts';
import { BrandLogo } from '@/components/brand-logo';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { clearAuthQueryCache, fetchMe, login, register, verifyOtp } from '@/lib/auth';
import { publicSiteUrl } from '@/lib/hosts';

type AuthMode = 'login' | 'register' | 'otp';

/**
 * Trang đăng nhập / đăng ký của Cổng Cộng tác viên.
 * Bố cục riêng (không Sidebar) — sau khi đăng nhập thì vào /ctv.
 */
export default function CtvLoginPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });

  // Đã đăng nhập rồi -> vào thẳng cổng CTV.
  useEffect(() => {
    if (meQuery.isSuccess && meQuery.data) router.replace('/ctv');
  }, [meQuery.isSuccess, meQuery.data, router]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const loginMut = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: async (res) => {
      setAuthErr(null);
      if ('mfaRequired' in res && res.mfaRequired) {
        setAuthErr(
          'Tài khoản đang bật xác thực 2 bước (MFA). Vui lòng đăng nhập qua trang chính Inlink để xác thực OTP.',
        );
        return;
      }
      clearAuthQueryCache(qc);
      await qc.invalidateQueries({ queryKey: ['me'] });
      await qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => {
      setAuthErr(err instanceof ApiError ? err.message : 'Đăng nhập không thành công');
    },
  });

  const registerMut = useMutation({
    mutationFn: () =>
      register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        role: UserRole.Candidate,
      }),
    onSuccess: (res) => {
      setAuthErr(null);
      setAuthMsg(res.message || 'Đã gửi mã OTP tới email của bạn.');
      setMode('otp');
    },
    onError: (err) => {
      setAuthErr(err instanceof ApiError ? err.message : 'Không đăng ký được tài khoản');
    },
  });

  const verifyMut = useMutation({
    mutationFn: async () => {
      await verifyOtp(email.trim(), otp.trim());
      return login(email.trim(), password);
    },
    onSuccess: async () => {
      setAuthErr(null);
      setAuthMsg(null);
      clearAuthQueryCache(qc);
      await qc.invalidateQueries({ queryKey: ['me'] });
      await qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => {
      setAuthErr(err instanceof ApiError ? err.message : 'Mã OTP không đúng hoặc đã hết hạn');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthErr(null);
    if (mode === 'login') loginMut.mutate();
    else if (mode === 'register') registerMut.mutate();
    else verifyMut.mutate();
  }

  const busy = loginMut.isPending || registerMut.isPending || verifyMut.isPending;

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo href="/ctv" />
            <span className="hidden rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-[#E8872A] ring-1 ring-amber-200 sm:inline-flex">
              Cổng Cộng tác viên · ctv.inlink.vn
            </span>
          </div>
          <a
            href={publicSiteUrl()}
            className="hidden items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#072348] sm:inline-flex"
          >
            Trang chủ Inlink
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {meQuery.isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang kiểm tra phiên đăng nhập...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:items-start">
            <div className="space-y-4">
              <section className="brand-hero-surface rounded-2xl p-6 text-white shadow-sm sm:p-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  Inlink Partner Portal
                </span>
                <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  Trở thành Cộng tác viên kết nối tuyển dụng công nghiệp
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-white/80">
                  Bất kỳ ai cũng có thể đăng ký tài khoản trực tiếp tại{' '}
                  <strong>ctv.inlink.vn</strong> để nhận mã giới thiệu riêng, khóa MST doanh nghiệp
                  và hưởng hoa hồng khi khách hàng thanh toán gói dịch vụ.
                </p>
              </section>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <Link2 className="h-5 w-5 text-[#0B468C]" />
                  <p className="mt-2 text-sm font-bold text-[#072348]">Mã giới thiệu riêng</p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    Theo dõi tự động mọi lượt đăng ký qua link của bạn.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <ShieldCheck className="h-5 w-5 text-[#E8872A]" />
                  <p className="mt-2 text-sm font-bold text-[#072348]">Khóa MST bảo vệ</p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    Chủ động khóa MST khách hàng để giữ quyền hoa hồng.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <Coins className="h-5 w-5 text-emerald-600" />
                  <p className="mt-2 text-sm font-bold text-[#072348]">Ví hoa hồng rõ ràng</p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    Đối soát minh bạch và chi trả định kỳ hàng tháng.
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setAuthErr(null);
                  }}
                  className={clsx(
                    'flex-1 rounded-lg py-2 transition',
                    mode === 'login' ? 'bg-white text-[#072348] shadow-2xs' : 'text-slate-600',
                  )}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setAuthErr(null);
                  }}
                  className={clsx(
                    'flex-1 rounded-lg py-2 transition',
                    mode !== 'login' ? 'bg-white text-[#072348] shadow-2xs' : 'text-slate-600',
                  )}
                >
                  Tạo tài khoản CTV
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                {mode === 'register' && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Họ và tên *
                    </label>
                    <Input
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                    />
                  </div>
                )}

                {mode !== 'otp' && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Email *
                      </label>
                      <Input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Mật khẩu *
                      </label>
                      <Input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tối thiểu 8 ký tự"
                      />
                    </div>
                  </>
                )}

                {mode === 'otp' && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {authMsg ?? 'Nhập mã OTP đã gửi về email của bạn.'}
                    </p>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Mã OTP *
                    </label>
                    <Input
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Nhập 6 số OTP"
                    />
                  </div>
                )}

                {mode === 'register' && (
                  <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-slate-600">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#E8872A]"
                    />
                    <span>
                      Tôi đã đọc và đồng ý với{' '}
                      <a
                        href="https://inlink.vn/trang/dieu-khoan-dich-vu"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0B468C] hover:underline"
                      >
                        Điều khoản dịch vụ
                      </a>
                      ,{' '}
                      <a
                        href="https://inlink.vn/trang/chinh-sach-quyen-rieng-tu"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0B468C] hover:underline"
                      >
                        Chính sách bảo mật
                      </a>{' '}
                      và{' '}
                      <a
                        href="https://inlink.vn/partner"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0B468C] hover:underline"
                      >
                        Chính sách Cộng tác viên
                      </a>{' '}
                      của inLink.
                    </span>
                  </label>
                )}

                {authErr && <p className="text-xs font-medium text-rose-600">{authErr}</p>}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={busy || (mode === 'register' && !acceptedTerms)}
                >
                  {busy
                    ? 'Đang xử lý...'
                    : mode === 'login'
                      ? 'Đăng nhập vào cổng CTV'
                      : mode === 'register'
                        ? 'Đăng ký tài khoản'
                        : 'Xác thực OTP & Đăng nhập'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
