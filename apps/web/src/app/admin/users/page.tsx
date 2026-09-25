'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, UserStatus } from '@industriallink/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { createAdminUser, listAdminUsers, updateAdminUser } from '@/lib/admin-users';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.SuperAdmin, label: 'Superadmin' },
  { value: UserRole.Recruiter, label: 'Nhà tuyển dụng' },
  { value: UserRole.CompanyAdmin, label: 'Admin công ty' },
  { value: UserRole.HiringManager, label: 'Hiring manager' },
  { value: UserRole.Candidate, label: 'Ứng viên' },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listAdminUsers,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Recruiter);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Cập nhật thất bại');
    },
  });

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900">Người dùng & phân quyền</h1>
      <p className="mt-1 text-sm text-slate-500">
        Tài khoản Superadmin mặc định: <b>ilinkadmin@inlink.vn</b>. Tạo thêm tài khoản và gán
        quyền tại đây.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="text-sm font-bold text-slate-900">Tạo tài khoản</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <Field label="Họ tên">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </Field>
            <Field label="Email (đăng nhập)">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-emerald-600">{info}</p>}
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </form>
        </Card>

        <Card className="overflow-x-auto">
          <h2 className="text-sm font-bold text-slate-900">Danh sách</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
          ) : (
            <table className="mt-3 w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="pb-2 font-semibold">Tên</th>
                  <th className="pb-2 font-semibold">Email</th>
                  <th className="pb-2 font-semibold">Vai trò</th>
                  <th className="pb-2 font-semibold">Trạng thái</th>
                  <th className="pb-2 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 font-medium text-slate-900">{u.displayName}</td>
                    <td className="py-3 text-slate-600">{u.email}</td>
                    <td className="py-3">
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
                    <td className="py-3">
                      <Select
                        className="h-9 min-w-[110px] text-xs"
                        value={u.status}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: u.id,
                            body: { status: e.target.value as UserStatus },
                          })
                        }
                      >
                        <option value={UserStatus.Active}>active</option>
                        <option value={UserStatus.Locked}>locked</option>
                        <option value={UserStatus.Verified}>verified</option>
                        <option value={UserStatus.Created}>created</option>
                      </Select>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-600"
                        onClick={() => {
                          const pw = window.prompt('Mật khẩu mới (≥ 8 ký tự):');
                          if (!pw) return;
                          updateMutation.mutate({ id: u.id, body: { password: pw } });
                        }}
                      >
                        Đổi MK
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
