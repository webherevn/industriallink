'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { getOutreachEmail, setOutreachEmail } from '@/lib/candidate';

const HIRED_HINT =
  'Bật/Tắt thông báo email công việc mới phù hợp nhất. Nếu bạn đã tìm được việc phù hợp thì Bấm Tắt để không bị làm phiền.';

/** Bật: nhận email gợi ý và kết nối. Tắt: ngừng gửi các email đó. */
export function HiredNoticeSwitch({ wide = false }: { wide?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['outreach-email'],
    queryFn: getOutreachEmail,
    staleTime: 30_000,
    retry: false,
  });
  const enabled = data?.enabled !== false;
  const mutation = useMutation({
    mutationFn: (next: boolean) => setOutreachEmail(next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['outreach-email'] });
      const prev = qc.getQueryData<{ enabled: boolean }>(['outreach-email']);
      qc.setQueryData(['outreach-email'], { enabled: next });
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(['outreach-email'], ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['outreach-email'] });
    },
  });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`Đã nhận việc. ${HIRED_HINT}`}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(!enabled)}
      className={clsx(
        'group relative inline-flex shrink-0 items-center gap-2.5 self-center rounded-full border border-slate-200/90 bg-white py-1 pl-3 pr-1 text-left shadow-[0_1px_2px_rgba(7,35,72,0.05)] transition hover:border-slate-300',
        wide && 'w-full justify-between gap-3 rounded-2xl px-3.5 py-3',
        mutation.isPending && 'opacity-80',
      )}
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold leading-none tracking-tight text-brand-600">
          Đã nhận việc
        </span>
        {wide ? (
          <span className="mt-1 block text-[11px] leading-snug text-slate-500">{HIRED_HINT}</span>
        ) : (
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden w-72 rounded-xl bg-brand-600 px-3 py-2 text-left text-[12px] font-medium leading-snug text-white shadow-lg group-hover:block"
          >
            {HIRED_HINT}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={clsx(
          'relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors duration-300 ease-out',
          enabled ? 'bg-brand-600' : 'bg-slate-200',
        )}
      >
        <span
          className={clsx(
            'absolute top-[2px] h-[23px] w-[23px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.16),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            enabled ? 'translate-x-[21px]' : 'translate-x-[2px]',
          )}
        />
      </span>
    </button>
  );
}
