'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CAREER_LADDERS,
  DEPARTMENTS,
  EmploymentType,
  ExperienceBand,
  INDUSTRY_GROUPS,
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobTrack,
} from '@industriallink/contracts';
import { joinLocationLabels, parseJoinedLocations } from '@industriallink/vn-admin';
import { AppShell } from '@/components/app-shell';
import { LocationPicker } from '@/components/location-picker';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { EMPLOYMENT_LABEL, EXPERIENCE_LABEL } from '@/lib/format';
import { getJob, updateJob } from '@/lib/jobs';

function trackFromLevel(level: string | null | undefined): JobTrack {
  if (level?.startsWith('sales.')) return JobTrack.Sales;
  return JobTrack.Technical;
}

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id),
    enabled: Boolean(id),
    retry: false,
  });

  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [jobTrack, setJobTrack] = useState<JobTrack>(JobTrack.Technical);
  const [jobLevel, setJobLevel] = useState<string>(JobLevelCode.TechStaff);
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FullTime);
  const [headcount, setHeadcount] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [experienceBand, setExperienceBand] = useState<ExperienceBand>(ExperienceBand.From1To3);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [benefits, setBenefits] = useState('');
  const [skills, setSkills] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!job || hydrated) return;
    setTitle(job.title);
    setIndustry(job.industry ?? '');
    setJobTrack(trackFromLevel(job.jobLevel));
    setJobLevel(job.jobLevel ?? JobLevelCode.TechStaff);
    setDepartment(job.department ?? '');
    setLocation(job.location ?? '');
    setEmploymentType(job.employmentType ?? EmploymentType.FullTime);
    setHeadcount(String(job.headcount ?? 1));
    setDeadline(job.deadline ?? '');
    setExperienceBand((job.experienceBand as ExperienceBand) || ExperienceBand.From1To3);
    setSalaryMin(job.salaryMin != null ? String(job.salaryMin) : '');
    setSalaryMax(job.salaryMax != null ? String(job.salaryMax) : '');
    setDescription(job.description ?? '');
    setRequirements(job.requirements ?? '');
    setBenefits(job.benefits ?? '');
    setSkills(job.skills.map((s) => s.name).join(', '));
    setHydrated(true);
  }, [job, hydrated]);

  const levelOptions = useMemo(() => CAREER_LADDERS[jobTrack], [jobTrack]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateJob(id, {
        title: title.trim(),
        description: description.trim() || '(Chưa có mô tả)',
        requirements: requirements.trim() || undefined,
        benefits: benefits.trim() || undefined,
        industry: industry || undefined,
        department: department || undefined,
        jobLevel: jobLevel || undefined,
        employmentType,
        location: location || undefined,
        headcount: headcount ? Number(headcount) : 1,
        deadline: deadline || undefined,
        experienceBand,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name, required: true })),
      }),
    onSuccess: () => router.push('/jobs/manage'),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/jobs/manage"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Sửa tin tuyển dụng</h1>
            {job && (
              <p className="mt-1 text-sm text-slate-500">
                {job.code} · {job.title}
              </p>
            )}
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hydrated || title.trim().length < 3}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu thay đổi
          </Button>
        </div>

        {isLoading && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tin…
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
            {error instanceof ApiError ? error.message : 'Không tải được tin tuyển dụng'}
          </div>
        )}

        {hydrated && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {saveMutation.isError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : 'Không lưu được thay đổi'}
              </p>
            )}

            <Field label="Tiêu đề *">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nhóm ngành">
                <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {INDUSTRY_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phòng ban">
                <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lộ trình">
                <Select
                  value={jobTrack}
                  onChange={(e) => {
                    const track = e.target.value as JobTrack;
                    setJobTrack(track);
                    setJobLevel(CAREER_LADDERS[track][0]);
                  }}
                >
                  {Object.values(JobTrack).map((t) => (
                    <option key={t} value={t}>
                      {JOB_TRACK_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cấp bậc">
                <Select value={jobLevel} onChange={(e) => setJobLevel(e.target.value)}>
                  {levelOptions.map((code) => (
                    <option key={code} value={code}>
                      {JOB_LEVEL_LABEL[code]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Địa điểm">
                <LocationPicker
                  variant="field"
                  multiple
                  placeholder="Chọn địa điểm"
                  value={parseJoinedLocations(location)}
                  onChange={(labels) => setLocation(joinLocationLabels(labels))}
                />
              </Field>
              <Field label="Hình thức">
                <Select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                >
                  {Object.values(EmploymentType).map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYMENT_LABEL[t] ?? t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kinh nghiệm">
                <Select
                  value={experienceBand}
                  onChange={(e) => setExperienceBand(e.target.value as ExperienceBand)}
                >
                  {Object.values(ExperienceBand).map((b) => (
                    <option key={b} value={b}>
                      {EXPERIENCE_LABEL[b] ?? b}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Số lượng">
                <Input
                  type="number"
                  min={1}
                  value={headcount}
                  onChange={(e) => setHeadcount(e.target.value)}
                />
              </Field>
              <Field label="Hạn nộp">
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
              <Field label="Lương tối thiểu (VND)">
                <Input
                  inputMode="numeric"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Field label="Lương tối đa (VND)">
                <Input
                  inputMode="numeric"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
            </div>

            <Field label="Mô tả công việc *">
              <Textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Yêu cầu">
              <Textarea
                rows={4}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </Field>
            <Field label="Quyền lợi">
              <Textarea
                rows={4}
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
              />
            </Field>
            <Field label="Kỹ năng (cách nhau bởi dấu phẩy)">
              <Input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="PLC, SCADA, Technical Sales"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Link href="/jobs/manage">
                <Button variant="outline">Huỷ</Button>
              </Link>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || title.trim().length < 3}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
