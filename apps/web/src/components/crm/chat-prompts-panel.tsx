'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import {
  addCrmSupportPrompt,
  deleteCrmSupportPrompt,
  fetchCrmSupportPrompts,
  updateCrmSupportPrompt,
} from '@/lib/support-chat';

export function ChatPromptsPanel() {
  const qc = useQueryClient();
  const prompts = useQuery({ queryKey: ['crm-support-prompts'], queryFn: fetchCrmSupportPrompts });
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function refresh(rows: Awaited<ReturnType<typeof fetchCrmSupportPrompts>>) {
    qc.setQueryData(['crm-support-prompts'], rows);
    void qc.invalidateQueries({ queryKey: ['support-chat-prompts'] });
  }

  const add = useMutation({
    mutationFn: () => addCrmSupportPrompt(draft),
    onSuccess: (rows) => {
      setDraft('');
      setError(null);
      refresh(rows);
    },
    onError: (err) => setError(errorText(err, 'Không thêm được câu chào')),
  });

  const save = useMutation({
    mutationFn: () => updateCrmSupportPrompt(editing!, editText),
    onSuccess: (rows) => {
      setEditing(null);
      setEditText('');
      setError(null);
      refresh(rows);
    },
    onError: (err) => setError(errorText(err, 'Không sửa được câu chào')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCrmSupportPrompt(id),
    onSuccess: (rows) => {
      setError(null);
      refresh(rows);
    },
    onError: (err) => setError(errorText(err, 'Không xóa được câu chào')),
  });

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || add.isPending) return;
    add.mutate();
  }

  const rows = prompts.data ?? [];

  return (
    <CrmFrame
      kicker="Robot góc phải"
      title="Câu chào chat"
      description="Các câu hiện cạnh robot, đổi lần lượt. Viết {ten} để chèn tên người đang xem."
      footnote="Xóa hết thì robot không hiện câu chào. Bấm robot vẫn mở khung góp ý."
    >
      <form onSubmit={onAdd} className="crm-surface flex flex-col gap-3 rounded-[22px] bg-white p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm text-slate-600">
          Câu mới
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Hi, {ten}, cần tôi giúp gì cho bạn?"
            className={`${crmFieldClass} mt-1 resize-none`}
          />
        </label>
        <button type="submit" disabled={add.isPending || draft.trim().length === 0} className={crmButtonClass}>
          Thêm
        </button>
      </form>

      {error && <p className="text-center text-sm text-rose-600">{error}</p>}

      {prompts.isLoading ? (
        <p className="text-center text-sm text-slate-400">Đang tải câu chào…</p>
      ) : rows.length === 0 ? (
        <CrmEmpty>Chưa có câu nào. Robot chỉ hiện icon.</CrmEmpty>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="crm-surface rounded-[22px] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Câu {index + 1}</p>
              {editing === row.id ? (
                <form
                  className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!editText.trim() || save.isPending) return;
                    save.mutate();
                  }}
                >
                  <textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    maxLength={300}
                    rows={2}
                    className={`${crmFieldClass} min-w-0 flex-1 resize-none`}
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={save.isPending} className={crmButtonClass}>
                      Lưu
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className={crmActionClass}>
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm leading-relaxed text-slate-800">{row.body}</p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(row.id);
                        setEditText(row.body);
                      }}
                      className={crmActionClass}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(row.id)}
                      disabled={remove.isPending}
                      className={crmActionClass}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </CrmFrame>
  );
}
