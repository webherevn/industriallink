'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, Check, KeyRound, Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AiProviderKind,
  type AiSettingsView,
  type TestAiConnectionResponse,
  type UpdateAiSettingsRequest,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchAiSettings, testAiConnection, updateAiSettings } from '@/lib/admin-ai-settings';

const PROVIDER_LABEL: Record<AiProviderKind, string> = {
  [AiProviderKind.Mock]: 'Mock — không gọi AI thật (heuristic)',
  [AiProviderKind.OpenAi]: 'OpenAI',
  [AiProviderKind.Anthropic]: 'Anthropic (Claude)',
  [AiProviderKind.Gemini]: 'Google Gemini',
};

type ProviderKey = 'openai' | 'anthropic' | 'gemini';

interface FormState {
  provider: AiProviderKind;
  embeddingDim: string;
  openaiModel: string;
  openaiEmbeddingModel: string;
  anthropicModel: string;
  geminiModel: string;
  geminiEmbeddingModel: string;
}

function toForm(v: AiSettingsView): FormState {
  return {
    provider: v.provider,
    embeddingDim: String(v.embeddingDim),
    openaiModel: v.openai.model,
    openaiEmbeddingModel: v.openai.embeddingModel,
    anthropicModel: v.anthropic.model,
    geminiModel: v.gemini.model,
    geminiEmbeddingModel: v.gemini.embeddingModel,
  };
}

const emptyKeys = { openai: '', anthropic: '', gemini: '' };
const emptyClear = { openai: false, anthropic: false, gemini: false };

export function AdminAiSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-ai-settings'],
    queryFn: fetchAiSettings,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [keys, setKeys] = useState<Record<ProviderKey, string>>(emptyKeys);
  const [clear, setClear] = useState<Record<ProviderKey, boolean>>(emptyClear);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [test, setTest] = useState<TestAiConnectionResponse | null>(null);

  // Nạp form khi dữ liệu về (và sau mỗi lần lưu).
  useEffect(() => {
    if (data) {
      setForm(toForm(data));
      setKeys(emptyKeys);
      setClear(emptyClear);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: UpdateAiSettingsRequest) => updateAiSettings(body),
    onSuccess: (view) => {
      setBanner({ tone: 'ok', text: 'Đã lưu và áp dụng ngay (không cần restart).' });
      setTest(null);
      qc.setQueryData(['admin-ai-settings'], view);
    },
    onError: (err) => {
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' });
    },
  });

  const testMutation = useMutation({
    mutationFn: (provider: AiProviderKind) => testAiConnection({ provider }),
    onSuccess: (res) => setTest(res),
    onError: (err) => {
      setTest(null);
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Test thất bại' });
    },
  });

  if (isLoading || !form || !data) {
    return (
      <AdminShell>
        <p className="mt-6 text-sm text-slate-500">Đang tải cấu hình AI…</p>
      </AdminShell>
    );
  }

  function upd<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function onSave() {
    if (!form) return;
    const body: UpdateAiSettingsRequest = {
      provider: form.provider,
      embeddingDim: Number(form.embeddingDim) || undefined,
      openaiModel: form.openaiModel.trim() || undefined,
      openaiEmbeddingModel: form.openaiEmbeddingModel.trim() || undefined,
      anthropicModel: form.anthropicModel.trim() || undefined,
      geminiModel: form.geminiModel.trim() || undefined,
      geminiEmbeddingModel: form.geminiEmbeddingModel.trim() || undefined,
    };
    (['openai', 'anthropic', 'gemini'] as ProviderKey[]).forEach((p) => {
      const field = `${p}ApiKey` as 'openaiApiKey' | 'anthropicApiKey' | 'geminiApiKey';
      if (clear[p]) body[field] = null;
      else if (keys[p].trim()) body[field] = keys[p].trim();
    });
    setBanner(null);
    saveMutation.mutate(body);
  }

  const activeIsMockFallback = data.usingMockFallback;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" />
            Cấu hình AI
          </h1>
          <p className="cms-page-subtitle">
            Đổi nhà cung cấp AI (Gemini / OpenAI / Claude) và API key ngay tại đây —
            áp dụng tức thì, không cần SSH sửa <code>.env</code> hay restart.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-xs text-slate-500">Đang chạy</span>
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold ring-1',
              activeIsMockFallback
                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            )}
          >
            {PROVIDER_LABEL[data.activeProvider]}
          </span>
        </div>
      </div>

      {activeIsMockFallback ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Provider đã chọn (<b>{PROVIDER_LABEL[data.provider]}</b>) chưa có API key nên
            hệ thống đang tạm dùng <b>mock</b>. Nhập key bên dưới rồi Lưu để dùng AI thật.
          </span>
        </div>
      ) : null}

      {banner ? (
        <p
          className={clsx(
            'mt-4 rounded-lg border px-3 py-2 text-sm',
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {banner.text}
        </p>
      ) : null}

      {/* Provider + embedding */}
      <Card className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhà cung cấp (provider)" description="Áp dụng cho toàn bộ tính năng AI: duyệt tin, parse CV, tư vấn nghề, embedding.">
            <Select
              value={form.provider}
              onChange={(e) => upd('provider', e.target.value as AiProviderKind)}
            >
              {Object.values(AiProviderKind).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Số chiều embedding" description="Gemini text-embedding-004 = 768; OpenAI 3-small = 1536. Đổi cần re-embed dữ liệu cũ.">
            <Input
              type="number"
              min={1}
              value={form.embeddingDim}
              onChange={(e) => upd('embeddingDim', e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {/* Gemini */}
      <ProviderCard
        title="Google Gemini"
        selected={form.provider === AiProviderKind.Gemini}
        view={data.gemini}
        keyValue={keys.gemini}
        cleared={clear.gemini}
        onKey={(v) => setKeys((k) => ({ ...k, gemini: v }))}
        onClear={(c) => setClear((s) => ({ ...s, gemini: c }))}
      >
        <Field label="Model chat" description="Mặc định gemini-3.6-flash (miễn phí AI Studio).">
          <Input value={form.geminiModel} onChange={(e) => upd('geminiModel', e.target.value)} />
        </Field>
        <Field label="Model embedding">
          <Input
            value={form.geminiEmbeddingModel}
            onChange={(e) => upd('geminiEmbeddingModel', e.target.value)}
          />
        </Field>
      </ProviderCard>

      {/* OpenAI */}
      <ProviderCard
        title="OpenAI"
        selected={form.provider === AiProviderKind.OpenAi}
        view={data.openai}
        keyValue={keys.openai}
        cleared={clear.openai}
        onKey={(v) => setKeys((k) => ({ ...k, openai: v }))}
        onClear={(c) => setClear((s) => ({ ...s, openai: c }))}
      >
        <Field label="Model chat">
          <Input value={form.openaiModel} onChange={(e) => upd('openaiModel', e.target.value)} />
        </Field>
        <Field label="Model embedding">
          <Input
            value={form.openaiEmbeddingModel}
            onChange={(e) => upd('openaiEmbeddingModel', e.target.value)}
          />
        </Field>
      </ProviderCard>

      {/* Anthropic */}
      <ProviderCard
        title="Anthropic (Claude)"
        selected={form.provider === AiProviderKind.Anthropic}
        view={data.anthropic}
        keyValue={keys.anthropic}
        cleared={clear.anthropic}
        onKey={(v) => setKeys((k) => ({ ...k, anthropic: v }))}
        onClear={(c) => setClear((s) => ({ ...s, anthropic: c }))}
      >
        <Field label="Model chat">
          <Input
            value={form.anthropicModel}
            onChange={(e) => upd('anthropicModel', e.target.value)}
          />
        </Field>
      </ProviderCard>

      {/* Test result */}
      {test ? (
        <div
          className={clsx(
            'mt-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
            test.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {test.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <X className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            <b>{PROVIDER_LABEL[test.provider]}</b> · {test.model} · {test.latencyMs}ms — {test.message}
          </span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Button onClick={onSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lưu thay đổi
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setBanner(null);
            testMutation.mutate(form.provider);
          }}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Test kết nối “{PROVIDER_LABEL[form.provider]}”
        </Button>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {data.updatedAt
          ? `Cập nhật lần cuối: ${new Date(data.updatedAt).toLocaleString('vi-VN')}${
              data.updatedByEmail ? ` · ${data.updatedByEmail}` : ''
            }`
          : 'Chưa từng lưu từ giao diện — đang dùng biến môi trường.'}
      </p>
    </AdminShell>
  );
}

function ProviderCard({
  title,
  selected,
  view,
  keyValue,
  cleared,
  onKey,
  onClear,
  children,
}: {
  title: string;
  selected: boolean;
  view: { hasKey: boolean; keyPreview: string | null; keySource: 'db' | 'env' | null };
  keyValue: string;
  cleared: boolean;
  onKey: (v: string) => void;
  onClear: (c: boolean) => void;
  children: React.ReactNode;
}) {
  const placeholder = view.hasKey
    ? `•••••••• đã lưu ${view.keyPreview ?? ''} (${view.keySource === 'db' ? 'từ giao diện' : 'từ .env'})`
    : 'Chưa cấu hình — dán API key vào đây';

  return (
    <Card
      className={clsx(
        'mt-4',
        selected ? 'ring-2 ring-brand-200' : '',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {selected ? (
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            Đang chọn
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {children}
      </div>

      <div className="mt-4">
        <Field label="API key" description="Chỉ ghi, không hiển thị lại. Để trống = giữ key hiện tại.">
          <Input
            type="password"
            autoComplete="off"
            value={cleared ? '' : keyValue}
            disabled={cleared}
            placeholder={placeholder}
            onChange={(e) => onKey(e.target.value)}
          />
        </Field>
        {view.keySource === 'db' ? (
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={cleared}
              onChange={(e) => onClear(e.target.checked)}
            />
            Xoá key đã lưu (lùi về biến môi trường)
          </label>
        ) : null}
      </div>
    </Card>
  );
}
