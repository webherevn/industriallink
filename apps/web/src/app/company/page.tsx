'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Camera,
  Loader2,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  CompanyRole,
  CompanySize,
  INDUSTRY_GROUPS,
  formatCompanySize,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  MY_COMPANY_LOGO_QUERY_KEY,
  createCompany,
  fetchMyCompanyLogoObjectUrl,
  getMyCompany,
  inviteCompanyMember,
  listCompanyMembers,
  removeCompanyMember,
  updateMyCompany,
  uploadCompanyLogo,
} from '@/lib/company';

const SIZE_LABEL: Record<CompanySize, string> = {
  [CompanySize.Micro]: 'Dưới 10 người',
  [CompanySize.Small]: '10 – 50 người',
  [CompanySize.Medium]: '50 – 200 người',
  [CompanySize.Large]: '200 – 1000 người',
  [CompanySize.Enterprise]: 'Trên 1000 người',
};

const ROLE_LABEL: Record<CompanyRole, string> = {
  [CompanyRole.Owner]: 'Chủ sở hữu',
  [CompanyRole.Admin]: 'Quản trị',
  [CompanyRole.Member]: 'Thành viên',
};

type CompanyForm = {
  name: string;
  taxCode: string;
  industry: string;
  size: CompanySize | '';
  address: string;
  website: string;
  description: string;
};

const emptyForm: CompanyForm = {
  name: '',
  taxCode: '',
  industry: '',
  size: '',
  address: '',
  website: '',
  description: '',
};

export default function CompanyPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CompanyForm>(emptyForm);

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company'],
    queryFn: getMyCompany,
    retry: false,
  });

  const { data: logoUrl } = useQuery({
    queryKey: MY_COMPANY_LOGO_QUERY_KEY,
    queryFn: fetchMyCompanyLogoObjectUrl,
    enabled: Boolean(company?.hasLogo),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name,
      taxCode: company.taxCode ?? '',
      industry: company.industry ?? '',
      size: (company.size as CompanySize) || '',
      address: company.address ?? '',
      website: company.website ?? '',
      description: company.description ?? '',
    });
  }, [company]);

  const createMutation = useMutation({
    mutationFn: () =>
      createCompany({
        name: form.name,
        taxCode: form.taxCode || undefined,
        industry: form.industry || undefined,
        size: form.size || undefined,
        address: form.address || undefined,
        website: form.website || undefined,
        description: form.description || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-company'] }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyCompany({
        name: form.name.trim(),
        taxCode: form.taxCode || undefined,
        industry: form.industry || undefined,
        size: form.size || undefined,
        address: form.address || undefined,
        website: form.website || undefined,
        description: form.description || undefined,
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
      queryClient.invalidateQueries({ queryKey: MY_COMPANY_LOGO_QUERY_KEY });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-slate-500">Đang tải...</p>
      </AppShell>
    );
  }

  if (company) {
    const isAdmin =
      company.myRole === CompanyRole.Owner || company.myRole === CompanyRole.Admin;

    return (
      <AppShell>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={company.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </span>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={logoMutation.isPending}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white hover:bg-brand-700 disabled:opacity-60"
                  title="Cập nhật logo"
                >
                  {logoMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) logoMutation.mutate(file);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-sm text-slate-500">
              {company.code} · {company.memberCount} thành viên · Bạn:{' '}
              {ROLE_LABEL[company.myRole]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && !editing && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Chỉnh sửa thông tin
              </Button>
            )}
            <Link
              href={`/companies/${company.id}`}
              className="inline-flex items-center rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
            >
              Xem trang công khai
            </Link>
          </div>
        </div>

        {logoMutation.isError && (
          <p className="mt-3 text-sm text-rose-600">
            {logoMutation.error instanceof ApiError
              ? logoMutation.error.message
              : 'Không cập nhật được logo'}
          </p>
        )}

        {editing && isAdmin ? (
          <Card className="mt-6 max-w-3xl space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Cập nhật hồ sơ công ty</h2>
            <CompanyFields form={form} setForm={setForm} />
            {updateMutation.isError && (
              <p className="text-sm text-rose-600">
                {updateMutation.error instanceof ApiError
                  ? updateMutation.error.message
                  : 'Không lưu được thay đổi'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || form.name.trim().length < 2}
              >
                {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    name: company.name,
                    taxCode: company.taxCode ?? '',
                    industry: company.industry ?? '',
                    size: (company.size as CompanySize) || '',
                    address: company.address ?? '',
                    website: company.website ?? '',
                    description: company.description ?? '',
                  });
                }}
              >
                Huỷ
              </Button>
            </div>
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card>
              <dl className="space-y-3 text-sm">
                <Row label="Ngành" value={company.industry} />
                <Row
                  label="Quy mô"
                  value={
                    company.size
                      ? SIZE_LABEL[company.size as CompanySize] ??
                        formatCompanySize(company.size)
                      : null
                  }
                />
                <Row label="Mã số thuế" value={company.taxCode} />
                <Row label="Địa chỉ" value={company.address} />
                <Row label="Website" value={company.website} />
              </dl>
            </Card>
            <Card>
              <h3 className="text-sm font-medium text-slate-700">Giới thiệu</h3>
              <p className="mt-2 text-sm text-slate-600">
                {company.description ?? 'Chưa có mô tả.'}
              </p>
            </Card>
          </div>
        )}

        <Link href="/jobs/new">
          <Button className="mt-6">Đăng tin tuyển dụng</Button>
        </Link>

        <MembersCard isAdmin={isAdmin} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Tạo hồ sơ công ty</h1>
      <p className="mt-1 text-slate-500">
        Bạn cần tạo hồ sơ công ty trước khi đăng tin tuyển dụng.
      </p>

      <Card className="mt-6 max-w-2xl space-y-4">
        <CompanyFields form={form} setForm={setForm} />

        {createMutation.isError && (
          <p className="text-sm text-red-600">
            {createMutation.error instanceof ApiError
              ? createMutation.error.message
              : 'Có lỗi xảy ra'}
          </p>
        )}

        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || form.name.trim().length < 2}
        >
          {createMutation.isPending ? 'Đang tạo...' : 'Tạo công ty'}
        </Button>
      </Card>
    </AppShell>
  );
}

function CompanyFields({
  form,
  setForm,
}: {
  form: CompanyForm;
  setForm: (next: CompanyForm) => void;
}) {
  return (
    <>
      <Field label="Tên công ty *">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Công ty TNHH Tự động hoá ABC"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ngành">
          <Select
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          >
            <option value="">-- Chọn nhóm ngành --</option>
            {INDUSTRY_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quy mô">
          <Select
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value as CompanySize })}
          >
            <option value="">-- Chọn --</option>
            {Object.values(CompanySize).map((s) => (
              <option key={s} value={s}>
                {SIZE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mã số thuế">
          <Input
            value={form.taxCode}
            onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
          />
        </Field>
        <Field label="Website">
          <Input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Địa chỉ">
        <Input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </Field>
      <Field label="Giới thiệu">
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value ?? '—'}</dd>
    </div>
  );
}

function MembersCard({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyRole.Admin | CompanyRole.Member>(CompanyRole.Member);

  const { data: members, isLoading } = useQuery({
    queryKey: ['company-members'],
    queryFn: listCompanyMembers,
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteCompanyMember({ email, roleInCompany: role }),
    onSuccess: () => {
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeCompanyMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      queryClient.invalidateQueries({ queryKey: ['my-company'] });
    },
  });

  return (
    <Card className="mt-6">
      <h3 className="text-base font-semibold text-slate-900">Thành viên công ty</h3>
      <p className="mt-1 text-sm text-slate-500">
        {isAdmin
          ? 'Mời đồng nghiệp đã có tài khoản nhà tuyển dụng tham gia công ty.'
          : 'Chỉ chủ sở hữu/quản trị mới có thể mời hoặc gỡ thành viên.'}
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Đang tải...</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {members?.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium text-slate-800">{m.displayName}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {ROLE_LABEL[m.roleInCompany]}
                </span>
                {isAdmin && m.roleInCompany !== CompanyRole.Owner && (
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600"
                    title="Gỡ thành viên"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
          <Field label="Email người dùng đã đăng ký" className="flex-1">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recruiter2@example.com"
            />
          </Field>
          <Field label="Vai trò">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as CompanyRole.Admin | CompanyRole.Member)}
            >
              <option value={CompanyRole.Member}>{ROLE_LABEL[CompanyRole.Member]}</option>
              <option value={CompanyRole.Admin}>{ROLE_LABEL[CompanyRole.Admin]}</option>
            </Select>
          </Field>
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending || !email.includes('@')}
          >
            <UserPlus className="h-4 w-4" /> Mời
          </Button>
        </div>
      )}
      {inviteMutation.isError && (
        <p className="mt-2 text-sm text-red-600">
          {inviteMutation.error instanceof ApiError
            ? inviteMutation.error.message
            : 'Không mời được thành viên'}
        </p>
      )}
      {removeMutation.isError && (
        <p className="mt-2 text-sm text-red-600">
          {removeMutation.error instanceof ApiError
            ? removeMutation.error.message
            : 'Không gỡ được thành viên'}
        </p>
      )}
    </Card>
  );
}
