'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Building2,
  Camera,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Globe,
  ImagePlus,
  Info,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CompanyRole,
  CompanySize,
  INDUSTRY_GROUPS,
  formatCompanySize,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { companyPublicPath } from '@/lib/public-paths';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  COMPANY_PHOTO_ACCEPT,
  MY_COMPANY_LOGO_QUERY_KEY,
  companyMediaUrl,
  createCompany,
  deleteCompanyCulture,
  fetchMyCompanyLicenseObjectUrl,
  fetchMyCompanyLogoObjectUrl,
  getMyCompany,
  getMyCompanyVerification,
  inviteCompanyMember,
  listCompanyMembers,
  removeCompanyMember,
  submitCompanyVerification,
  updateCompanyBrand,
  updateMyCompany,
  uploadCompanyBanner,
  uploadCompanyCulture,
  uploadCompanyLogo,
  uploadCompanyVerificationLicense,
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

type CompanyTab = 'info' | 'culture' | 'media' | 'verification' | 'members';

type CompanyForm = {
  name: string;
  taxCode: string;
  industry: string;
  size: CompanySize | '';
  address: string;
  website: string;
  description: string;
  foundedYear: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  cultureNote: string;
  coreActivities: string[];
};

const emptyForm: CompanyForm = {
  name: '',
  taxCode: '',
  industry: '',
  size: '',
  address: '',
  website: '',
  description: '',
  foundedYear: '',
  email: '',
  phone: '',
  linkedinUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  cultureNote: '',
  coreActivities: [],
};

export default function CompanyPage() {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const cultureInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<CompanyTab>('info');
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [newActivity, setNewActivity] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['my-company'],
    queryFn: getMyCompany,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: logoUrl } = useQuery({
    queryKey: MY_COMPANY_LOGO_QUERY_KEY,
    queryFn: fetchMyCompanyLogoObjectUrl,
    enabled: Boolean(company?.hasLogo),
    staleTime: 5 * 60_000,
  });

  const resetFormFromCompany = () => {
    if (!company) return;
    setForm({
      name: company.name,
      taxCode: company.taxCode ?? '',
      industry: company.industry ?? '',
      size: (company.size as CompanySize) || '',
      address: company.address ?? '',
      website: company.website ?? '',
      description: company.description ?? '',
      foundedYear: company.brand?.foundedYear != null ? String(company.brand.foundedYear) : '',
      email: company.brand?.email ?? '',
      phone: company.brand?.phone ?? '',
      linkedinUrl: company.brand?.linkedinUrl ?? '',
      facebookUrl: company.brand?.facebookUrl ?? '',
      youtubeUrl: company.brand?.youtubeUrl ?? '',
      cultureNote: company.brand?.cultureNote ?? '',
      coreActivities: company.brand?.coreActivities ?? [],
    });
  };

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
      foundedYear: company.brand?.foundedYear != null ? String(company.brand.foundedYear) : '',
      email: company.brand?.email ?? '',
      phone: company.brand?.phone ?? '',
      linkedinUrl: company.brand?.linkedinUrl ?? '',
      facebookUrl: company.brand?.facebookUrl ?? '',
      youtubeUrl: company.brand?.youtubeUrl ?? '',
      cultureNote: company.brand?.cultureNote ?? '',
      coreActivities: company.brand?.coreActivities ?? [],
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

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const parsedYear = form.foundedYear.trim() ? Number(form.foundedYear.trim()) : null;
      await updateMyCompany({
        name: form.name.trim(),
        taxCode: form.taxCode.trim() || undefined,
        industry: form.industry || undefined,
        size: form.size || undefined,
        address: form.address.trim() || undefined,
        website: form.website.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      await updateCompanyBrand({
        foundedYear: parsedYear && Number.isFinite(parsedYear) ? parsedYear : null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        facebookUrl: form.facebookUrl.trim() || null,
        youtubeUrl: form.youtubeUrl.trim() || null,
        cultureNote: form.cultureNote.trim() || null,
        coreActivities: form.coreActivities,
      });
    },
    onSuccess: async () => {
      setSaveMessage('Đã lưu thay đổi hồ sơ công ty.');
      await queryClient.invalidateQueries({ queryKey: ['my-company'] });
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-company'] });
      await queryClient.invalidateQueries({ queryKey: MY_COMPANY_LOGO_QUERY_KEY });
    },
  });

  const bannerMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyBanner(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-company'] }),
  });

  const cultureUploadMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyCulture(file, 'Hình ảnh công ty', ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-company'] }),
  });

  const cultureDeleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteCompanyCulture(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-company'] }),
  });

  const completion = useMemo(() => {
    if (!company) return { pct: 0, checks: [] as { id: string; label: string; done: boolean; tab: CompanyTab }[] };
    const checks: { id: string; label: string; done: boolean; tab: CompanyTab }[] = [
      {
        id: 'basic',
        label: 'Thông tin doanh nghiệp',
        done: Boolean(form.name.trim() && form.industry && form.size && form.address.trim()),
        tab: 'info',
      },
      {
        id: 'desc',
        label: 'Giới thiệu doanh nghiệp',
        done: form.description.trim().length >= 30,
        tab: 'info',
      },
      {
        id: 'culture',
        label: 'Văn hóa doanh nghiệp',
        done: form.cultureNote.trim().length >= 20,
        tab: 'culture',
      },
      {
        id: 'media',
        label: 'Hình ảnh hoạt động',
        done: (company.brand?.cultureGallery?.length ?? 0) > 0,
        tab: 'media',
      },
      {
        id: 'contact',
        label: 'Liên hệ & Mạng xã hội',
        done: Boolean(form.email.trim() || form.phone.trim() || form.website.trim()),
        tab: 'info',
      },
      {
        id: 'members',
        label: 'Thành viên',
        done: company.memberCount >= 1,
        tab: 'members',
      },
    ];
    const doneCount = checks.filter((c) => c.done).length;
    const pct = Math.round((doneCount / checks.length) * 100);
    return { pct, checks };
  }, [company, form]);

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-12 text-center text-sm text-slate-500">Đang tải hồ sơ công ty...</p>
      </AppShell>
    );
  }

  // Chưa có công ty -> form tạo công ty mới
  if (!company) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
            Doanh nghiệp
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Tạo hồ sơ công ty</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cần hồ sơ công ty để đăng tin và quản lý ứng viên.
          </p>

          <Card className="mt-6 space-y-4">
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
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || form.name.trim().length < 2}
            >
              Tạo công ty
            </Button>
            {createMutation.isError && (
              <p className="text-sm text-red-600">
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : 'Không tạo được công ty'}
              </p>
            )}
          </Card>
        </div>
      </AppShell>
    );
  }

  const isAdmin =
    company.myRole === CompanyRole.Owner || company.myRole === CompanyRole.Admin;
  const bannerUrl = companyMediaUrl(company.brand?.bannerUrl);
  const cultureItems = company.brand?.cultureGallery ?? [];
  const publicUrl = companyPublicPath(company);

  function addActivityTag() {
    const val = newActivity.trim();
    if (!val) return;
    if (!form.coreActivities.includes(val)) {
      setForm((prev) => ({ ...prev, coreActivities: [...prev.coreActivities, val] }));
    }
    setNewActivity('');
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
            <span className="h-3.5 w-1 rounded-full bg-accent-500" />
            Doanh nghiệp
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#072348]">
            Hồ sơ công ty
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý thông tin doanh nghiệp, xây dựng thương hiệu tuyển dụng và hiển thị trên trang công khai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={publicUrl}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#072348] shadow-2xs transition hover:border-brand-300 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            Xem trang công khai
          </Link>

          <button
            type="button"
            onClick={() => {
              const fullUrl =
                typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl;
              void navigator.clipboard?.writeText(fullUrl).then(() => {
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2500);
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#072348] px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0c3266]"
          >
            <Share2 className="h-3.5 w-3.5" />
            {copiedShare ? 'Đã sao chép link!' : 'Chia sẻ trang'}
          </button>
        </div>
      </div>

      {/* Card Cover Banner + Logo + Tabs */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        {/* Banner */}
        <div className="relative h-32 w-full bg-gradient-to-r from-[#072348] via-[#0B468C] to-[#1D4ED8] sm:h-40">
          {bannerUrl && (
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
          <input
            ref={bannerInputRef}
            type="file"
            accept={COMPANY_PHOTO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) bannerMutation.mutate(file);
              e.target.value = '';
            }}
          />
          {isAdmin && (
            <button
              type="button"
              disabled={bannerMutation.isPending}
              onClick={() => bannerInputRef.current?.click()}
              className="absolute right-4 top-3.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-slate-900/85"
            >
              {bannerMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Thay đổi ảnh bìa
            </button>
          )}
        </div>

        {/* Logo + Company Meta + Progress */}
        <div className="px-5 pb-4 pt-3 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative -mt-12 shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-slate-50 shadow-md sm:h-24 sm:w-24">
                  {company.hasLogo && logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Building2 className="h-9 w-9 text-[#072348]" />
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={COMPANY_PHOTO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) logoMutation.mutate(file);
                    e.target.value = '';
                  }}
                />
                {isAdmin && (
                  <button
                    type="button"
                    aria-label="Đổi logo công ty"
                    disabled={logoMutation.isPending}
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#072348] text-white shadow-sm transition hover:bg-[#0c3266]"
                  >
                    {logoMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="min-w-0 pb-1">
                <h2 className="truncate text-lg font-bold text-[#072348] sm:text-xl">
                  {form.name || company.name}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                  <span className="font-mono">{company.code}</span>
                  {form.foundedYear && <span>· Thành lập: {form.foundedYear}</span>}
                  {form.size && <span>· Quy mô: {formatCompanySize(form.size)}</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Hồ sơ hoàn thiện {completion.pct}%
              </span>
              <div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${completion.pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* 5 Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-2.5">
            {(
              [
                { key: 'info', label: 'Thông tin chung', icon: Info },
                { key: 'culture', label: 'Giới thiệu & Văn hóa', icon: Sparkles },
                { key: 'media', label: 'Hình ảnh & Hoạt động', icon: ImagePlus },
                { key: 'verification', label: 'Xác minh doanh nghiệp', icon: ShieldCheck },
                { key: 'members', label: 'Thành viên', icon: Users },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs font-semibold transition',
                    active
                      ? 'border-[#072348] text-[#072348]'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main 2 Columns */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Left column */}
        <div className="min-w-0 space-y-4">
          {activeTab === 'info' && (
            <>
              {/* Thông tin doanh nghiệp */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[#E8872A]">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#072348]">Thông tin doanh nghiệp</h3>
                    <p className="text-xs text-slate-500">Thông tin cơ bản về công ty.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Tên công ty *">
                    <Input
                      value={form.name}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Công ty Cổ phần Công nghiệp..."
                    />
                  </Field>

                  <Field
                    label={
                      company.brand?.verified
                        ? 'Mã số thuế (đã khóa sau khi xác thực)'
                        : 'Mã số thuế'
                    }
                  >
                    <Input
                      value={form.taxCode}
                      disabled={!isAdmin || Boolean(company.brand?.verified)}
                      onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                      placeholder="0101234567 hoặc 0101234567-001"
                    />
                    {company.brand?.verified ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                        <Lock className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span>Đã xác thực — liên hệ CSKH inLink nếu cần điều chỉnh MST.</span>
                      </p>
                    ) : null}
                  </Field>

                  <Field label="Năm thành lập">
                    <Input
                      type="number"
                      min={1900}
                      max={2030}
                      value={form.foundedYear}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, foundedYear: e.target.value })}
                      placeholder="Ví dụ: 2012"
                    />
                  </Field>

                  <Field label="Quy mô nhân sự">
                    <Select
                      value={form.size}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, size: e.target.value as CompanySize })}
                    >
                      <option value="">-- Chọn quy mô --</option>
                      {Object.values(CompanySize).map((s) => (
                        <option key={s} value={s}>
                          {SIZE_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Ngành nghề chính *">
                    <Select
                      value={form.industry}
                      disabled={!isAdmin}
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

                  <Field label="Địa chỉ trụ sở">
                    <Input
                      value={form.address}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Số 123..."
                    />
                  </Field>
                </div>

                {/* Hoạt động cốt lõi (multi-tag) */}
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Lĩnh vực &amp; Hoạt động cốt lõi
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                    {form.coreActivities.map((act) => (
                      <span
                        key={act}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#0B468C]"
                      >
                        {act}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                coreActivities: prev.coreActivities.filter((x) => x !== act),
                              }))
                            }
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <input
                          value={newActivity}
                          onChange={(e) => setNewActivity(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addActivityTag();
                            }
                          }}
                          placeholder="Thêm lĩnh vực (VD: Thủy lực)..."
                          className="h-7 bg-transparent px-1.5 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={addActivityTag}
                          className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-xs font-semibold text-[#072348] shadow-2xs ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          <Plus className="h-3 w-3" /> Thêm
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Liên hệ & Mạng xã hội */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Website">
                    <Input
                      value={form.website}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://company.com.vn"
                    />
                  </Field>
                  <Field label="Điện thoại">
                    <Input
                      value={form.phone}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="024 3 888 9999"
                    />
                  </Field>
                  <Field label="Email liên hệ">
                    <Input
                      value={form.email}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="hr@company.com.vn"
                    />
                  </Field>
                  <Field label="LinkedIn URL">
                    <Input
                      value={form.linkedinUrl}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/company/..."
                    />
                  </Field>
                  <Field label="Facebook URL">
                    <Input
                      value={form.facebookUrl}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })}
                      placeholder="https://facebook.com/..."
                    />
                  </Field>
                  <Field label="YouTube Video / Kênh">
                    <Input
                      value={form.youtubeUrl}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/..."
                    />
                  </Field>
                </div>
              </section>

              {/* Giới thiệu doanh nghiệp */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-[#0B468C]">
                    <Pencil className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#072348]">Giới thiệu doanh nghiệp</h3>
                    <p className="text-xs text-slate-500">
                      Giới thiệu ngắn gọn về công ty, sản phẩm/dịch vụ và giá trị cốt lõi.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Textarea
                    rows={4}
                    maxLength={1000}
                    disabled={!isAdmin}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Mô tả lĩnh vực hoạt động, năng lực cốt lõi của doanh nghiệp..."
                  />
                  <p className="mt-1 text-right text-[11px] text-slate-400">
                    {form.description.length} / 1.000
                  </p>
                </div>
              </section>

              {/* Văn hóa doanh nghiệp */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-[#E8872A]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#072348]">Văn hóa doanh nghiệp</h3>
                    <p className="text-xs text-slate-500">
                      Giá trị, môi trường làm việc, con người và những điểm đặc biệt.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Textarea
                    rows={3}
                    maxLength={500}
                    disabled={!isAdmin}
                    value={form.cultureNote}
                    onChange={(e) => setForm({ ...form, cultureNote: e.target.value })}
                    placeholder="Môi trường làm việc cởi mở, tôn trọng và khuyến khích phát triển năng lực..."
                  />
                  <p className="mt-1 text-right text-[11px] text-slate-400">
                    {form.cultureNote.length} / 500
                  </p>
                </div>
              </section>

              {/* Hình ảnh doanh nghiệp */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <ImagePlus className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-bold text-[#072348]">Hình ảnh doanh nghiệp</h3>
                      <p className="text-xs text-slate-500">
                        Thêm hình ảnh văn phòng, hoạt động, sản phẩm (tối đa 8 ảnh).
                      </p>
                    </div>
                  </div>
                </div>

                <input
                  ref={cultureInputRef}
                  type="file"
                  accept={COMPANY_PHOTO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) cultureUploadMutation.mutate(file);
                    e.target.value = '';
                  }}
                />

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {cultureItems.map((item) => {
                    const src = companyMediaUrl(item.url);
                    return (
                      <div
                        key={item.id ?? item.url}
                        className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        {src && <img src={src} alt={item.title} className="h-full w-full object-cover" />}
                        {isAdmin && item.id && (
                          <button
                            type="button"
                            onClick={() => cultureDeleteMutation.mutate(item.id!)}
                            className="absolute right-1.5 top-1.5 hidden rounded-lg bg-slate-900/70 p-1 text-white group-hover:block hover:bg-rose-600"
                            title="Xoá ảnh"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {isAdmin && cultureItems.length < 8 && (
                    <button
                      type="button"
                      disabled={cultureUploadMutation.isPending}
                      onClick={() => cultureInputRef.current?.click()}
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-sky-50/40"
                    >
                      {cultureUploadMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                      ) : (
                        <ImagePlus className="h-5 w-5 text-slate-400" />
                      )}
                      <span>Thêm ảnh</span>
                    </button>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === 'culture' && (
            <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h3 className="text-[15px] font-bold text-[#072348]">Giới thiệu &amp; Văn hóa</h3>
              <Field label="Giới thiệu doanh nghiệp">
                <Textarea
                  rows={5}
                  maxLength={1000}
                  disabled={!isAdmin}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field label="Văn hóa & Môi trường làm việc">
                <Textarea
                  rows={4}
                  maxLength={500}
                  disabled={!isAdmin}
                  value={form.cultureNote}
                  onChange={(e) => setForm({ ...form, cultureNote: e.target.value })}
                />
              </Field>
            </section>
          )}

          {activeTab === 'media' && (
            <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-[#072348]">Hình ảnh hoạt động (tối đa 8 ảnh)</h3>
                  <p className="text-xs text-slate-500">
                    Hiển thị nổi bật trên trang công khai doanh nghiệp. Video giới thiệu có thể nhập qua YouTube URL ở tab Thông tin chung.
                  </p>
                </div>
                {isAdmin && cultureItems.length < 8 && (
                  <Button variant="outline" onClick={() => cultureInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Thêm ảnh
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cultureItems.map((item) => {
                  const src = companyMediaUrl(item.url);
                  return (
                    <div
                      key={item.id ?? item.url}
                      className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      {src && <img src={src} alt={item.title} className="h-full w-full object-cover" />}
                      {isAdmin && item.id && (
                        <button
                          type="button"
                          onClick={() => cultureDeleteMutation.mutate(item.id!)}
                          className="absolute right-2 top-2 hidden rounded-lg bg-slate-900/70 p-1.5 text-white group-hover:block hover:bg-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'verification' && <CompanyVerificationCard />}
          {activeTab === 'members' && <MembersCard isAdmin={isAdmin} />}

          {/* Thanh lưu thay đổi (chỉ hiện ở các tab chỉnh sửa form chung) */}
          {isAdmin && (activeTab === 'info' || activeTab === 'culture') && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-3.5 shadow-2xs">
              <div className="text-xs">
                {saveAllMutation.isError && (
                  <span className="font-medium text-rose-600">
                    {saveAllMutation.error instanceof ApiError
                      ? saveAllMutation.error.message
                      : 'Không lưu được thay đổi.'}
                  </span>
                )}
                {saveMessage && !saveAllMutation.isError && (
                  <span className="font-semibold text-emerald-700">{saveMessage}</span>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSaveMessage(null);
                    resetFormFromCompany();
                  }}
                >
                  Huỷ thay đổi
                </Button>
                <Button
                  type="button"
                  disabled={saveAllMutation.isPending || form.name.trim().length < 2}
                  onClick={() => {
                    setSaveMessage(null);
                    saveAllMutation.mutate();
                  }}
                >
                  {saveAllMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Live Preview + Mức độ hoàn thiện + Gợi ý */}
        <aside className="space-y-4">
          {/* Xem trước trang công khai */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#072348]">Xem trước trang công khai</h3>
              <Link href={publicUrl} className="text-xs font-semibold text-[#1D4ED8] hover:underline">
                Mở trang →
              </Link>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
              <div className="h-16 bg-gradient-to-r from-[#072348] to-[#1D4ED8]">
                {bannerUrl && <img src={bannerUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="p-3">
                <div className="-mt-8 flex items-end gap-2.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-slate-50 shadow-xs">
                    {company.hasLogo && logoUrl ? (
                      <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <Building2 className="h-5 w-5 text-[#072348]" />
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm font-bold text-[#072348]">
                  {form.name || company.name}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {form.coreActivities.length > 0
                    ? form.coreActivities.slice(0, 3).join(' · ')
                    : form.industry || 'Chưa chọn ngành'}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  {form.address && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      {form.address}
                    </span>
                  )}
                  {form.size && <span>{formatCompanySize(form.size)}</span>}
                  {form.foundedYear && <span>Thành lập {form.foundedYear}</span>}
                </div>
                {form.description && (
                  <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-slate-600">
                    {form.description}
                  </p>
                )}
                {cultureItems.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {cultureItems.slice(0, 3).map((it) => {
                      const src = companyMediaUrl(it.url);
                      return (
                        <div key={it.id ?? it.url} className="aspect-[4/3] overflow-hidden rounded-md bg-slate-100">
                          {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mức độ hoàn thiện hồ sơ */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <h3 className="text-sm font-bold text-[#072348]">Mức độ hoàn thiện hồ sơ</h3>

            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - completion.pct / 100)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-base font-extrabold text-[#072348]">{completion.pct}%</span>
                </div>
              </div>

              <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                {completion.checks.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    {c.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    )}
                    <span className={clsx('truncate', c.done ? 'font-medium text-slate-700' : 'text-slate-400')}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Gợi ý hoàn thiện */}
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 shadow-2xs">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#072348]">
              <Sparkles className="h-4 w-4 text-[#E8872A]" />
              Gợi ý hoàn thiện
            </h3>
            <div className="mt-3 space-y-2">
              {completion.checks.filter((c) => !c.done).length === 0 ? (
                <p className="text-xs text-emerald-700">
                  Hồ sơ doanh nghiệp đã đầy đủ các hạng mục cơ bản! Bạn có thể bấm <strong>Xem trang công khai</strong> phía trên để kiểm tra hiển thị với ứng viên.
                </p>
              ) : (
                completion.checks
                  .filter((c) => !c.done)
                  .slice(0, 3)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveTab(c.tab)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-amber-200/60 bg-white px-3 py-2 text-left text-xs transition hover:border-[#E8872A]"
                    >
                      <span className="font-semibold text-[#072348]">Hoàn thiện: {c.label}</span>
                      <span className="shrink-0 font-bold text-[#E8872A]">→</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
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
    <Card className="border-slate-200/80">
      <h3 className="text-base font-bold text-[#072348]">Thành viên công ty</h3>
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

function CompanyVerificationCard() {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [taxCodeInput, setTaxCodeInput] = useState('');
  const [taxCodeTouched, setTaxCodeTouched] = useState(false);
  const [askVerified, setAskVerified] = useState(true);
  const [askTrusted, setAskTrusted] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [openingDoc, setOpeningDoc] = useState(false);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-company-verification'],
    queryFn: getMyCompanyVerification,
    retry: 1,
  });

  useEffect(() => {
    if (data && !taxCodeTouched) {
      setTaxCodeInput(data.taxCode ?? '');
    }
  }, [data, taxCodeTouched]);

  const uploadLicense = useMutation({
    mutationFn: (file: File) => uploadCompanyVerificationLicense(file),
    onSuccess: async () => {
      setMessage({
        tone: 'ok',
        text: 'Đã tải Giấy phép ĐKKD thành công (ảnh đã tự động tối ưu WebP và lưu riêng tư).',
      });
      await qc.invalidateQueries({ queryKey: ['my-company-verification'] });
    },
    onError: (err) => {
      setMessage({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không tải được Giấy phép ĐKKD.',
      });
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      submitCompanyVerification({
        note: note.trim(),
        askVerified,
        askTrusted,
        ...(!data?.verified ? { taxCode: taxCodeInput.trim() } : {}),
      }),
    onSuccess: async () => {
      setMessage({
        tone: 'ok',
        text: 'Đã gửi hồ sơ xác minh. SuperAdmin sẽ đối chiếu MST & Giấy phép ĐKKD và phản hồi sớm.',
      });
      setNote('');
      await qc.invalidateQueries({ queryKey: ['my-company-verification'] });
      await qc.invalidateQueries({ queryKey: ['my-company'] });
    },
    onError: (err) => {
      setMessage({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không gửi được đơn xác minh.',
      });
    },
  });

  async function onPreviewLicense() {
    setOpeningDoc(true);
    setMessage(null);
    try {
      const url = await fetchMyCompanyLicenseObjectUrl();
      if (!url) {
        setMessage({ tone: 'err', text: 'Không mở được tài liệu Giấy phép ĐKKD.' });
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setMessage({ tone: 'err', text: 'Không mở được tài liệu Giấy phép ĐKKD.' });
    } finally {
      setOpeningDoc(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="space-y-3 border-slate-200/80">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="space-y-3 border-rose-200 bg-rose-50/50">
        <div className="flex items-start gap-2.5 text-rose-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold">Không tải được trạng thái xác minh doanh nghiệp</h2>
            <p className="mt-1 text-xs text-rose-700">
              {error instanceof ApiError
                ? error.message
                : 'Vui lòng kiểm tra kết nối và thử tải lại.'}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Thử tải lại
        </Button>
      </Card>
    );
  }

  const pending = data.status === 'pending';
  const canAskVerified = !data.verified;
  const canAskTrusted = !data.trustedEmployer;
  const effectiveTax = (data.verified ? data.taxCode : taxCodeInput.trim()) || '';
  const hasValidTax = /^\d{10}(-\d{3})?$/.test(effectiveTax.replace(/\s+/g, ''));
  const hasLicense = Boolean(data.hasLicenseDoc);
  const licenseSizeLabel =
    data.licenseDocSize != null
      ? data.licenseDocSize >= 1024 * 1024
        ? `${(data.licenseDocSize / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.max(1, Math.round(data.licenseDocSize / 1024))} KB`
      : null;

  return (
    <Card className="space-y-5 border-slate-200/80">
      {/* Header + Trạng thái hiện tại */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-[#072348]">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <span>Xác minh doanh nghiệp</span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Xác minh bằng Mã số thuế duy nhất &amp; Giấy phép ĐKKD giúp bảo vệ thương hiệu công ty,
            chống giả mạo và cấp huy hiệu «Đã xác thực» trên toàn sàn inLink.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
              data.verified
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : pending
                  ? 'bg-amber-50 text-amber-800 ring-amber-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200',
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {data.verified
              ? 'Đã xác thực'
              : pending
                ? 'Đang chờ duyệt'
                : 'Chưa xác thực'}
          </span>
          {data.trustedEmployer ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              Nhà tuyển dụng uy tín
            </span>
          ) : null}
        </div>
      </div>

      {/* Trạng thái đơn gần nhất */}
      {data.status !== 'none' && (
        <div
          className={clsx(
            'rounded-xl border px-3.5 py-3 text-xs leading-relaxed',
            data.status === 'approved'
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
              : data.status === 'pending'
                ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                : 'border-rose-200 bg-rose-50/70 text-rose-900',
          )}
        >
          <p className="font-semibold">
            Đơn xác minh gần nhất:{' '}
            {data.status === 'pending'
              ? 'Đang chờ SuperAdmin đối chiếu'
              : data.status === 'approved'
                ? 'Đã được phê duyệt'
                : 'Bị từ chối — vui lòng cập nhật lại hồ sơ'}
          </p>
          {data.note ? <p className="mt-1 opacity-90">Nội dung đã gửi: {data.note}</p> : null}
          {data.reviewNote ? (
            <p className="mt-1 font-medium">Phản hồi từ SuperAdmin: {data.reviewNote}</p>
          ) : null}
        </div>
      )}

      {/* Checklist 2 điều kiện cốt lõi: MST + GPKD */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bước 1: Mã số thuế */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#072348]">
              1. Mã số thuế doanh nghiệp
            </span>
            {hasValidTax ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Hợp lệ
              </span>
            ) : (
              <span className="text-[11px] font-medium text-amber-700">Cần bổ sung</span>
            )}
          </div>
          <Input
            value={data.verified ? (data.taxCode ?? '') : taxCodeInput}
            disabled={data.verified || pending}
            onChange={(e) => {
              setTaxCodeTouched(true);
              setTaxCodeInput(e.target.value);
            }}
            placeholder="VD: 0101234567 hoặc 0101234567-001"
          />
          <p className="text-[11px] leading-relaxed text-slate-500">
            {data.verified ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Lock className="h-3 w-3 shrink-0" />
                MST đã được khóa cố định sau khi xác thực.
              </span>
            ) : data.taxRegistryVerified && data.taxRegistryBusinessName ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                Đã đối chiếu dữ liệu thuế: {data.taxRegistryBusinessName}
              </span>
            ) : (
              'Mỗi MST chỉ gắn với 01 tài khoản doanh nghiệp duy nhất trên inLink (10 số hoặc 10 số-3 số cho chi nhánh).'
            )}
          </p>
        </div>

        {/* Bước 2: Giấy phép ĐKKD */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#072348]">
              2. Giấy chứng nhận ĐKKD
            </span>
            {hasLicense ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Đã tải lên
              </span>
            ) : (
              <span className="text-[11px] font-medium text-amber-700">Bắt buộc</span>
            )}
          </div>

          <input
            ref={licenseInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setMessage(null);
              uploadLicense.mutate(file);
            }}
          />

          {hasLicense ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {data.licenseDocName || 'Giấy phép ĐKKD'}
                  </p>
                  {licenseSizeLabel ? (
                    <p className="text-[11px] text-slate-500">{licenseSizeLabel} · Lưu riêng tư</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={openingDoc}
                  onClick={() => void onPreviewLicense()}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-sky-100 disabled:opacity-50"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{openingDoc ? 'Đang mở…' : 'Xem'}</span>
                </button>
                {!pending ? (
                  <button
                    type="button"
                    disabled={uploadLicense.isPending}
                    onClick={() => licenseInputRef.current?.click()}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploadLicense.isPending ? 'Đang tải…' : 'Đổi tệp'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploadLicense.isPending || pending}
              onClick={() => licenseInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-[#072348] transition hover:border-brand-400 hover:bg-sky-50/40 disabled:opacity-50"
            >
              {uploadLicense.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 text-brand-600" />
              )}
              <span>
                {uploadLicense.isPending
                  ? 'Đang nén & tải lên…'
                  : 'Tải lên Giấy phép ĐKKD (JPG, PNG, WebP hoặc PDF)'}
              </span>
            </button>
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            Ảnh tự động nén sang WebP siêu nhẹ. Tài liệu lưu riêng tư, chỉ quản trị công ty và
            SuperAdmin đối chiếu khi duyệt.
          </p>
        </div>
      </div>

      {/* Form gửi đơn xác minh */}
      {pending ? (
        <p className="text-xs font-medium text-amber-800">
          Hồ sơ xác minh của bạn đang nằm trong hàng đợi xét duyệt của SuperAdmin.
        </p>
      ) : canAskVerified || canAskTrusted ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2">
            {canAskVerified && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600"
                  checked={askVerified}
                  onChange={(e) => setAskVerified(e.target.checked)}
                />
                Xin huy hiệu «Đã xác thực»
              </label>
            )}
            {canAskTrusted && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600"
                  checked={askTrusted}
                  onChange={(e) => setAskTrusted(e.target.checked)}
                />
                Xin huy hiệu «Nhà tuyển dụng uy tín»
              </label>
            )}
          </div>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Thông tin đối chiếu thêm: website công ty, người liên hệ, chức vụ… (ít nhất 10 ký tự)"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              {askVerified && (!hasValidTax || !hasLicense)
                ? 'Cần hoàn tất MST hợp lệ và tải lên Giấy phép ĐKKD trước khi gửi đơn.'
                : 'Đơn sẽ được SuperAdmin kiểm tra và duyệt trong giờ làm việc.'}
            </p>
            <Button
              disabled={
                submit.isPending ||
                note.trim().length < 10 ||
                (!askVerified && !askTrusted) ||
                (askVerified && (!hasValidTax || !hasLicense))
              }
              onClick={() => {
                setMessage(null);
                submit.mutate();
              }}
            >
              {submit.isPending ? 'Đang gửi…' : 'Gửi đơn xác minh'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium text-emerald-700">
          Doanh nghiệp của bạn đã hoàn tất xác minh và có đầy đủ huy hiệu.
        </p>
      )}

      {message && (
        <p
          className={clsx(
            'rounded-xl border px-3 py-2 text-xs font-medium',
            message.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
