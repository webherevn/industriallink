'use client';

import type { AdminUserView } from '@industriallink/contracts';
import { UserRole, UserStatus } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { createAdminUser, listAdminUsers, updateAdminUser } from '@/lib/admin-users';

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: UserRole.SuperAdmin, label: 'Superadmin', hint: 'Toàn quyền nền tảng' },
  { value: UserRole.Editor, label: 'Biên tập viên', hint: 'CMS · viết bài · SEO' },
  { value: UserRole.CompanyAdmin, label: 'Admin công ty', hint: 'Quản trị NTD' },
  { value: UserRole.HiringManager, label: 'Hiring manager', hint: 'Tuyển dụng nội bộ' },
  { value: UserRole.Recruiter, label: 'Nhà tuyển dụng', hint: 'Đăng JD & inbox' },
  { value: UserRole.Candidate, label: 'Ứng viên', hint: 'Tìm việc & CV' },
];

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: UserStatus.Active, label: 'Hoạt động' },
  { value: UserStatus.Verified, label: 'Đã xác minh' },
  { value: UserStatus.Created, label: 'Mới tạo' },
  { value: UserStatus.Locked, label: 'Đã khoá' },
];

function roleLabel(role: UserRole | string) {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function roleBadgeClass(role: string) {
  switch (role) {
    case UserRole.SuperAdmin:
      return 'bg-brand-600 text-white';
    case UserRole.Editor:
      return 'bg-violet-50 text-violet-800 ring-1 ring-violet-100';
    case UserRole.CompanyAdmin:
      return 'bg-brand-100 text-brand-800';
    case UserRole.HiringManager:
      return 'bg-sky-50 text-sky-800 ring-1 ring-sky-100';
    case UserRole.Recruiter:
      return 'bg-accent-50 text-accent-800 ring-1 ring-accent-100';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case UserStatus.Active:
    case UserStatus.Verified:
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
    case UserStatus.Locked:
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
    default:
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-100';
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listAdminUsers,
  });

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Recruiter);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [pwUser, setPwUser] = useState<AdminUserView | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = data.length;
    const active = data.filter(
      (u) => u.status === UserStatus.Active || u.status === UserStatus.Verified,
    ).length;
    const locked = data.filter((u) => u.status === UserStatus.Locked).length;
    const admins = data.filter((u) => u.role === UserRole.SuperAdmin).length;
    return { total, active, locked, admins };
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.code?.toLowerCase().includes(q)
      );
    });
  }, [data, query, roleFilter, statusFilter]);

  const createMutation = useMutation({
    mutationFn: () => createAdminUser({ email, password, displayName, role }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole(UserRole.Recruiter);
      setError(null);
      setInfo('Đã tạo tài khoản.');
      setCreateOpen(false);
    },
    onError: (err) => {
      setInfo(null);
      setError(err instanceof ApiError ? err.message : 'Tạo thất bại');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { role?: UserRole; status?: UserStatus; password?: string };
    }) => updateAdminUser(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      setInfo('Đã cập nhật.');
      setPwUser(null);
      setPwValue('');
      setPwError(null);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Cập nhật thất bại';
      setError(msg);
      setPwError(msg);
    },
  });

  function openCreate() {
    setError(null);
    setInfo(null);
    setCreateOpen(true);
  }

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Nền tảng</p>
          <h1 className="cms-page-title mt-1.5">Người dùng & phân quyền</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            Quản lý tài khoản, vai trò RBAC và trạng thái truy cập nền tảng.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0 gap-1.5 self-start !rounded-xl !bg-[#072348] !px-4 !py-2.5 !font-semibold shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] hover:!bg-[#0c3a72] sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          Tạo tài khoản
        </Button>
      </div>

      {(info || error) && !createOpen && !pwUser && (
        <div
          className={clsx(
            'mt-4 rounded-2xl border px-4 py-3 text-sm',
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          )}
        >
          {error || info}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Tổng tài khoản', value: stats.total, icon: Users, tone: 'text-[#E8872A] bg-[#FFF8F1]' },
          { label: 'Đang hoạt động', value: stats.active, icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50' },
          { label: 'Superadmin', value: stats.admins, icon: Shield, tone: 'text-accent-600 bg-accent-50' },
          { label: 'Đã khoá', value: stats.locked, icon: Lock, tone: 'text-rose-600 bg-rose-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="admin-dash-card px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {s.label}
                </p>
                <span className={clsx('rounded-lg p-1.5', s.tone)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#072348]">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="admin-dash-card admin-dash-rise mt-6 overflow-hidden" style={{ animationDelay: '80ms' }}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên, email…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="sm:w-[180px]"
            >
              <option value="all">Tất cả vai trò</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
              className="sm:w-[160px]"
            >
              <option value="all">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 px-5 py-8">
            <div className="admin-dash-skel h-12 rounded-xl" />
            <div className="admin-dash-skel h-12 rounded-xl" />
            <div className="admin-dash-skel h-12 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8F1] text-[#E8872A] ring-1 ring-[#FFD0A3]">
              <Users className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#072348]">Không có tài khoản phù hợp</p>
            <p className="mt-1 text-xs text-slate-400">Thử đổi bộ lọc hoặc tạo tài khoản mới.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.map((u) => (
                <li key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#072348] text-xs font-bold text-white ring-2 ring-[#FFD0A3]">
                      {initials(u.displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{u.displayName}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={clsx(
                            'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                            roleBadgeClass(u.role),
                          )}
                        >
                          {roleLabel(u.role)}
                        </span>
                        <span
                          className={clsx(
                            'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                            statusBadgeClass(String(u.status)),
                          )}
                        >
                          {statusLabel(String(u.status))}
                        </span>
                        {u.mfaEnabled && (
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            MFA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <Field label="Vai trò">
                      <Select
                        value={u.role}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: u.id,
                            body: { role: e.target.value as UserRole },
                          })
                        }
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Trạng thái">
                      <Select
                        value={u.status}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: u.id,
                            body: { status: e.target.value as UserStatus },
                          })
                        }
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <button
                      type="button"
                      onClick={() => {
                        setPwUser(u);
                        setPwValue('');
                        setPwError(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#E8872A] transition hover:border-[#FFD0A3] hover:bg-[#FFF8F1]"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Đổi mật khẩu
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f8fafc] text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Người dùng</th>
                    <th className="px-3 py-3 font-semibold">Vai trò</th>
                    <th className="px-3 py-3 font-semibold">Trạng thái</th>
                    <th className="px-3 py-3 font-semibold">Bảo mật</th>
                    <th className="px-5 py-3 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u) => (
                    <tr key={u.id} className="admin-dash-row">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#072348] text-[11px] font-bold text-white ring-2 ring-[#FFD0A3]">
                            {initials(u.displayName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#072348]">{u.displayName}</p>
                            <p className="truncate text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <Select
                          className="h-9 min-w-[150px] text-xs"
                          value={u.role}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: u.id,
                              body: { role: e.target.value as UserRole },
                            })
                          }
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-3.5">
                        <Select
                          className="h-9 min-w-[130px] text-xs"
                          value={u.status}
                          onChange={(e) =>
                            updateMutation.mutate({
                              id: u.id,
                              body: { status: e.target.value as UserStatus },
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={clsx(
                              'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                              statusBadgeClass(String(u.status)),
                            )}
                          >
                            {statusLabel(String(u.status))}
                          </span>
                          {u.mfaEnabled ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                              MFA
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setPwUser(u);
                            setPwValue('');
                            setPwError(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#E8872A] transition hover:bg-[#FFF8F1]"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Đổi MK
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 sm:px-5">
              Hiển thị {filtered.length} / {data.length} tài khoản
            </div>
          </>
        )}
      </div>

      {/* Create drawer */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Đóng"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-[0_24px_50px_-24px_rgba(7,35,72,0.55)] animate-soft-rise">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#072348]">Tạo tài khoản</p>
                <p className="text-xs text-slate-500">Gán vai trò và mật khẩu đăng nhập</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="flex flex-1 flex-col overflow-y-auto px-5 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="space-y-3">
                <Field label="Họ tên">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    placeholder="Nguyễn Văn A"
                  />
                </Field>
                <Field label="Email (đăng nhập)">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                  />
                </Field>
                <Field label="Mật khẩu (≥ 8 ký tự)">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
                <Field label="Vai trò">
                  <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} — {o.hint}
                      </option>
                    ))}
                  </Select>
                </Field>
                {error && <p className="text-sm text-rose-600">{error}</p>}
              </div>
              <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setCreateOpen(false)}
                >
                  Huỷ
                </Button>
                <Button type="submit" className="flex-1 gap-1.5 !rounded-xl !bg-[#072348] hover:!bg-[#0c3a72]" disabled={createMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  {createMutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password modal */}
      {pwUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Đóng"
            onClick={() => setPwUser(null)}
          />
          <div className="admin-dash-card relative z-10 w-full max-w-md p-5 animate-soft-rise">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#072348]">Đổi mật khẩu</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {pwUser.displayName} · {pwUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPwUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwValue.length < 8) {
                  setPwError('Mật khẩu tối thiểu 8 ký tự');
                  return;
                }
                updateMutation.mutate({ id: pwUser.id, body: { password: pwValue } });
              }}
            >
              <Field label="Mật khẩu mới">
                <Input
                  type="password"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </Field>
              {pwError && <p className="text-sm text-rose-600">{pwError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setPwUser(null)}>
                  Huỷ
                </Button>
                <Button type="submit" className="flex-1 !rounded-xl !bg-[#072348] hover:!bg-[#0c3a72]" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Đang lưu...' : 'Cập nhật'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
