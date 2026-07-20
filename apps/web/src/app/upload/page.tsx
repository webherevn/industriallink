'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { uploadResume } from '@/lib/candidate';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onUpload() {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const res = await uploadResume(file);
      router.push(`/analyze/${res.resumeId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tải lên thất bại');
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-slate-900">Tải lên CV của bạn</h1>
        <p className="mt-1 text-slate-500">
          AI sẽ đọc và phân tích CV để tạo hồ sơ ứng viên tự động. Hỗ trợ PDF, DOC, DOCX, TXT.
        </p>
        <Card className="mt-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 py-12 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <UploadCloud className="h-10 w-10 text-brand-500" />
            <span className="text-sm font-medium text-slate-700">
              {file ? file.name : 'Nhấn để chọn file CV'}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <Button className="mt-6 w-full" onClick={onUpload} disabled={!file || loading}>
            {loading ? 'Đang tải lên...' : 'Tải lên & phân tích với AI'}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
