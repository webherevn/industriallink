'use client';

import { VN_PROVINCES_2025, type CrmStaffGender, type CrmStaffProfileView } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmDateField, CrmSelect } from '@/components/crm/fields';
import { errorText } from '@/components/crm/format';
import { fetchCrmStaffAvatarObjectUrl, fetchCrmStaffProfile, saveCrmStaffProfile, uploadCrmStaffAvatar } from '@/lib/crm';

const GENDERS: { value: CrmStaffGender; label: string }[] = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

type Draft = {
  displayName: string;
  birthDate: string;
  gender: string;
  phone: string;
  address: string;
  province: string;
  postalCode: string;
};

function emptyDraft(): Draft {
  return { displayName: '', birthDate: '', gender: '', phone: '', address: '', province: '', postalCode: '' };
}

function draftFrom(profile: CrmStaffProfileView): Draft {
  return {
    displayName: profile.displayName,
    birthDate: profile.birthDate ?? '',
    gender: profile.gender ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    province: profile.province ?? '',
    postalCode: profile.postalCode ?? '',
  };
}

export function CrmStaffProfilePanel() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedId = params.get('user') ?? '';
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const page = useQuery({
    queryKey: ['crm-staff-profile', requestedId],
    queryFn: () => fetchCrmStaffProfile(requestedId || undefined),
  });
  const profile = page.data?.profile ?? null;
  const staff = page.data?.staff ?? null;
  const avatar = useQuery({
    queryKey: ['crm-staff-avatar', profile?.userId ?? ''],
    queryFn: () => fetchCrmStaffAvatarObjectUrl(profile!.userId),
    enabled: Boolean(profile?.hasAvatar && profile.userId),
  });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const loadedId = useRef('');

  useEffect(() => {
    if (!profile || loadedId.current === profile.userId) return;
    loadedId.current = profile.userId;
    setDraft(draftFrom(profile));
    setSaved(false);
    setError(null);
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      saveCrmStaffProfile({
        userId: profile?.userId,
        displayName: draft.displayName.trim(),
        birthDate: draft.birthDate || null,
        gender: draft.gender === 'male' || draft.gender === 'female' || draft.gender === 'other' ? draft.gender : null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
        province: draft.province || null,
        postalCode: draft.postalCode.trim() || null,
      }),
    onSuccess: (row) => {
      setError(null);
      setSaved(true);
      loadedId.current = row.userId;
      setDraft(draftFrom(row));
      qc.setQueryData(['crm-staff-profile', requestedId], (current: typeof page.data) =>
        current ? { ...current, profile: row } : current,
      );
    },
    onError: (err) => {
      setSaved(false);
      setError(errorText(err, 'Không lưu được hồ sơ'));
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadCrmStaffAvatar(file, profile?.userId),
    onSuccess: (row) => {
      setError(null);
      qc.setQueryData(['crm-staff-profile', requestedId], (current: typeof page.data) =>
        current ? { ...current, profile: row } : current,
      );
      void qc.invalidateQueries({ queryKey: ['crm-staff-avatar', row.userId] });
    },
    onError: (err) => setError(errorText(err, 'Không tải được ảnh')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.displayName.trim().length < 2) {
      setSaved(false);
      setError('Cần tên đầy đủ');
      return;
    }
    save.mutate();
  }

  function pickStaff(userId: string) {
    const query = userId ? `?user=${encodeURIComponent(userId)}` : '';
    router.replace(`/crm/settings/profile${query}`);
  }

  const canEdit = profile?.canEdit === true;

  return (
    <CrmFrame
      kicker="Cài đặt"
      title="Hồ sơ nhân sự"
      description="Nhân sự điền thông tin của chính mình. SuperAdmin sửa được hồ sơ từng người. Email đăng nhập không đổi ở đây."
    >
      {page.isLoading ? <CrmEmpty>Đang tải hồ sơ…</CrmEmpty> : null}
      {page.isError ? <CrmEmpty>{errorText(page.error, 'Không tải được hồ sơ.')}</CrmEmpty> : null}
      {staff && staff.length > 0 ? (
        <div className="mx-auto w-full max-w-3xl">
          <label className="mb-1.5 block text-sm font-medium text-slate-800" htmlFor="staff-profile-picker">
            Nhân sự
          </label>
          <CrmSelect
            value={profile?.userId ?? ''}
            options={staff.map((person) => ({ value: person.id, label: `${person.name} · ${person.code}` }))}
            onChange={pickStaff}
          />
        </div>
      ) : null}
      {page.data && !profile ? (
        <CrmEmpty>Chưa có nhân sự. Ở Người dùng, chọn Nhân viên kinh doanh hoặc Trưởng phòng kinh doanh.</CrmEmpty>
      ) : null}
      {profile ? (
        <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl space-y-5">
          <section className="rounded-[22px] bg-white px-5 py-2 crm-surface sm:px-6">
            <header className="flex items-center justify-between py-4">
              <h2 className="text-base font-semibold text-[#072348]">Thông tin cơ bản</h2>
              <span className="text-xs text-slate-400">{profile.code}</span>
            </header>
            <ProfileRow label="Ảnh đại diện">
              <div className="flex items-center gap-4">
                {avatar.data ? (
                  <img src={avatar.data} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-[#e4defc]" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#072348] text-sm font-bold text-white">
                    {initials(draft.displayName || profile.displayName)}
                  </span>
                )}
                {canEdit ? (
                  <>
                    <button type="button" className="text-sm font-semibold text-[#4c3ec9]" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
                      {upload.isPending ? 'Đang tải…' : 'Thay đổi'}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) upload.mutate(file);
                      }}
                    />
                  </>
                ) : null}
              </div>
            </ProfileRow>
            <p className="border-t border-slate-100 py-3 text-xs leading-relaxed text-slate-500">
              Ảnh đại diện giúp đồng nghiệp nhận ra bạn và giúp bạn biết mình đang đăng nhập đúng tài khoản.
            </p>
            <ProfileRow label="Tên đầy đủ">
              <input
                className={crmFieldClass}
                value={draft.displayName}
                disabled={!canEdit}
                required
                maxLength={160}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, displayName: event.target.value }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
            <ProfileRow label="Ngày tháng năm sinh">
              <CrmDateField
                value={draft.birthDate}
                placeholder="Chọn ngày sinh"
                onChange={(birthDate) => {
                  setDraft((current) => ({ ...current, birthDate }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
            <ProfileRow label="Giới tính">
              <CrmSelect
                value={draft.gender}
                placeholder="Chọn giới tính"
                disabled={!canEdit}
                options={GENDERS}
                onChange={(gender) => {
                  setDraft((current) => ({ ...current, gender }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
          </section>

          <section className="rounded-[22px] bg-white px-5 py-2 crm-surface sm:px-6">
            <header className="py-4">
              <h2 className="text-base font-semibold text-[#072348]">Thông tin liên lạc</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Dùng để đồng nghiệp liên hệ khi cần. Email là tài khoản đăng nhập.</p>
            </header>
            <ProfileRow label="Số điện thoại">
              <input
                className={crmFieldClass}
                inputMode="tel"
                value={draft.phone}
                disabled={!canEdit}
                placeholder="0986…"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, phone: event.target.value }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
            <ProfileRow label="Email">
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${crmFieldClass} max-w-md bg-slate-50 text-slate-500`} value={profile.email} disabled readOnly />
                {profile.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Đã xác thực
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">Chưa xác thực</span>
                )}
              </div>
            </ProfileRow>
            <ProfileRow label="Địa chỉ">
              <input
                className={crmFieldClass}
                value={draft.address}
                disabled={!canEdit}
                maxLength={300}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, address: event.target.value }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
            <ProfileRow label="Tỉnh, thành">
              <CrmSelect
                value={draft.province}
                placeholder="Chọn tỉnh, thành"
                disabled={!canEdit}
                options={VN_PROVINCES_2025.map((name) => ({ value: name, label: name }))}
                onChange={(province) => {
                  setDraft((current) => ({ ...current, province }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
            <ProfileRow label="Mã bưu chính">
              <input
                className={`${crmFieldClass} max-w-[160px]`}
                inputMode="numeric"
                value={draft.postalCode}
                disabled={!canEdit}
                maxLength={6}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, postalCode: event.target.value }));
                  setSaved(false);
                }}
              />
            </ProfileRow>
            <p className="border-t border-slate-100 py-3 text-xs text-rose-600">
              Lưu ý: Từ ngày 01 tháng 07 năm 2025 địa chỉ theo 34 tỉnh, thành. Không còn cấp huyện.
            </p>
          </section>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {saved ? <p className="text-sm text-emerald-600">Đã lưu hồ sơ.</p> : null}
          {canEdit ? (
            <div className="flex justify-end">
              <button type="submit" className={crmButtonClass} disabled={save.isPending}>
                {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </CrmFrame>
  );
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-slate-100 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IL';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
