'use client';

import type { CrmStaffAccountView } from '@industriallink/contracts';
import { UserRole, UserStatus } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmSelect } from '@/components/crm/fields';
import { errorText } from '@/components/crm/format';
import { createCrmStaffAccount, deleteCrmStaffAccount, fetchCrmStaffDirectory, updateCrmStaffAccount } from '@/lib/crm';

const ROLE_OPTIONS = [
  { value: UserRole.Sales, label: 'Nhân viên kinh doanh' },
  { value: UserRole.SalesManager, label: 'Trưởng phòng kinh doanh' },
];

const STATUS_OPTIONS = [
  { value: UserStatus.Active, label: 'Đang dùng' },
  { value: UserStatus.Locked, label: 'Khóa' },
];

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function statusLabel(status: string): string {
  if (status === UserStatus.Locked) return 'Khóa';
  return 'Đang dùng';
}

function statusValue(status: string): string {
  return status === UserStatus.Locked ? UserStatus.Locked : UserStatus.Active;
}

export function CrmStaffDirectoryPanel() {
  const qc = useQueryClient();
  const directory = useQuery({ queryKey: ['crm-staff-accounts'], queryFn: fetchCrmStaffDirectory });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = directory.data?.canEdit === true;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['crm-staff-accounts'] });
    void qc.invalidateQueries({ queryKey: ['crm-staff-profile'] });
  }

  const remove = useMutation({
    mutationFn: deleteCrmStaffAccount,
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(errorText(err, 'Không xóa được nhân sự')),
  });

  return (
    <CrmFrame
      kicker="Cài đặt"
      title="Nhân sự"
      description="Cùng danh sách với Người dùng ở Admin. SuperAdmin thêm, sửa và xóa. Trưởng phòng chỉ thêm nhân viên kinh doanh."
    >
      {directory.isLoading ? <CrmEmpty>Đang tải nhân sự…</CrmEmpty> : null}
      {directory.isError ? <CrmEmpty>{errorText(directory.error, 'Không tải được bảng nhân sự.')}</CrmEmpty> : null}
      {directory.data ? (
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <div className="flex justify-end">
            <button type="button" className={crmButtonClass} onClick={() => { setAdding((open) => !open); setEditing(null); setError(null); }}>
              {adding ? 'Đóng' : 'Thêm nhân sự'}
            </button>
          </div>
          {adding ? (
            <AccountForm
              mode="add"
              canChooseRole={canEdit}
              onCancel={() => setAdding(false)}
              onDone={() => {
                setAdding(false);
                setError(null);
                refresh();
              }}
              onError={setError}
            />
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
            {directory.data.rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có nhân sự.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#efeaff] text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3 font-semibold">Mã</th>
                      <th className="px-3 py-3 font-semibold">Tên</th>
                      <th className="px-3 py-3 font-semibold">Phòng ban</th>
                      <th className="px-3 py-3 font-semibold">Vai trò</th>
                      <th className="px-3 py-3 font-semibold">Trạng thái</th>
                      {canEdit ? <th className="px-5 py-3 font-semibold"> </th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f0ff]">
                    {directory.data.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-3.5 font-medium text-slate-500">{row.code}</td>
                        <td className="px-3 py-3.5">
                          <p className="font-semibold text-[#072348]">{row.displayName}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                          {canEdit ? (
                            <Link href={`/crm/settings/profile?user=${row.id}`} className="text-xs font-semibold text-[#4c3ec9]">
                              Hồ sơ
                            </Link>
                          ) : null}
                        </td>
                        <td className="px-3 py-3.5 text-slate-700">{row.department || '—'}</td>
                        <td className="px-3 py-3.5 text-slate-700">{roleLabel(row.role)}</td>
                        <td className="px-3 py-3.5 text-slate-700">{statusLabel(row.status)}</td>
                        {canEdit ? (
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end gap-2">
                              <button type="button" className={crmActionClass} onClick={() => { setEditing(row.id); setAdding(false); setError(null); }}>
                                Sửa
                              </button>
                              <button
                                type="button"
                                className={crmActionClass}
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (!window.confirm(`Xóa ${row.displayName}? Tài khoản cũng mất ở Admin.`)) return;
                                  remove.mutate(row.id);
                                }}
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {canEdit && editing ? (
            <AccountForm
              mode="edit"
              canChooseRole
              account={directory.data.rows.find((row) => row.id === editing)}
              onCancel={() => setEditing(null)}
              onDone={() => {
                setEditing(null);
                setError(null);
                refresh();
              }}
              onError={setError}
            />
          ) : null}
        </div>
      ) : null}
    </CrmFrame>
  );
}

function AccountForm({
  mode,
  canChooseRole,
  account,
  onCancel,
  onDone,
  onError,
}: {
  mode: 'add' | 'edit';
  canChooseRole: boolean;
  account?: CrmStaffAccountView;
  onCancel: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState(account?.department ?? '');
  const [role, setRole] = useState<string>(account?.role ?? UserRole.Sales);
  const [status, setStatus] = useState(statusValue(account?.status ?? UserStatus.Active));

  const save = useMutation({
    mutationFn: () => {
      if (mode === 'add') {
        return createCrmStaffAccount({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          department: department.trim() || null,
          role: canChooseRole ? (role === UserRole.SalesManager ? UserRole.SalesManager : UserRole.Sales) : undefined,
        });
      }
      return updateCrmStaffAccount(account!.id, {
        displayName: displayName.trim(),
        department: department.trim(),
        role: role === UserRole.SalesManager ? UserRole.SalesManager : UserRole.Sales,
        status,
        password: password.trim() || undefined,
      });
    },
    onSuccess: () => onDone(),
    onError: (err) => onError(errorText(err, mode === 'add' ? 'Không thêm được nhân sự' : 'Không sửa được nhân sự')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (displayName.trim().length < 2) {
      onError('Cần tên đầy đủ');
      return;
    }
    if (mode === 'add' && password.trim().length < 8) {
      onError('Mật khẩu từ 8 ký tự');
      return;
    }
    if (mode === 'edit' && password.trim() && password.trim().length < 8) {
      onError('Mật khẩu từ 8 ký tự');
      return;
    }
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-[22px] bg-white p-5 crm-surface">
      <h2 className="text-base font-semibold text-[#072348]">{mode === 'add' ? 'Thêm nhân sự' : `Sửa ${account?.displayName ?? ''}`}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">
          Tên đầy đủ
          <input className={`${crmFieldClass} mt-1`} value={displayName} required maxLength={160} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        {mode === 'add' ? (
          <label className="block text-sm text-slate-700">
            Email đăng nhập
            <input className={`${crmFieldClass} mt-1`} type="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
          </label>
        ) : (
          <label className="block text-sm text-slate-700">
            Email đăng nhập
            <input className={`${crmFieldClass} mt-1 bg-slate-50 text-slate-500`} value={account?.email ?? ''} disabled readOnly />
          </label>
        )}
        <label className="block text-sm text-slate-700">
          {mode === 'add' ? 'Mật khẩu' : 'Mật khẩu mới'}
          <input className={`${crmFieldClass} mt-1`} type="password" value={password} minLength={mode === 'add' ? 8 : undefined} required={mode === 'add'} placeholder={mode === 'edit' ? 'Để trống nếu giữ mật khẩu cũ' : ''} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="block text-sm text-slate-700">
          Phòng ban
          <input className={`${crmFieldClass} mt-1`} value={department} maxLength={80} placeholder="Kinh doanh" onChange={(event) => setDepartment(event.target.value)} />
        </label>
        {canChooseRole ? (
          <label className="block text-sm text-slate-700">
            Vai trò
            <div className="mt-1">
              <CrmSelect value={role} options={ROLE_OPTIONS} onChange={setRole} />
            </div>
          </label>
        ) : (
          <p className="self-end text-sm text-slate-500">Vai trò: Nhân viên kinh doanh</p>
        )}
        {mode === 'edit' ? (
          <label className="block text-sm text-slate-700">
            Trạng thái
            <div className="mt-1">
              <CrmSelect value={status} options={STATUS_OPTIONS} onChange={setStatus} />
            </div>
          </label>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={crmActionClass} onClick={onCancel}>
          Hủy
        </button>
        <button type="submit" className={crmButtonClass} disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : mode === 'add' ? 'Thêm' : 'Lưu'}
        </button>
      </div>
    </form>
  );
}
