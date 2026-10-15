'use client';

import { AlertTriangle, Coins, X } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';

interface CreditAlertState {
  visible: boolean;
  required?: number;
  balance?: number;
  missing?: number;
  action?: string;
  message?: string;
}

interface CreditAlertContextValue {
  alert: CreditAlertState;
  showAlert: (state: Omit<CreditAlertState, 'visible'>) => void;
  dismiss: () => void;
}

const CreditAlertContext = createContext<CreditAlertContextValue | null>(null);

const AUTO_DISMISS_MS = 12_000;

export function CreditAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<CreditAlertState>({ visible: false });

  const showAlert = useCallback((s: Omit<CreditAlertState, 'visible'>) => {
    setAlert({ ...s, visible: true });
  }, []);

  const dismiss = useCallback(() => setAlert((a) => ({ ...a, visible: false })), []);

  useEffect(() => {
    if (!alert.visible) return;
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [alert, dismiss]);

  return (
    <CreditAlertContext.Provider value={{ alert, showAlert, dismiss }}>
      {children}
      {alert.visible && <CreditAlertToast alert={alert} onDismiss={dismiss} />}
    </CreditAlertContext.Provider>
  );
}

function CreditAlertToast({
  alert,
  onDismiss,
}: {
  alert: CreditAlertState;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-[100] w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl shadow-red-900/10 ring-1 ring-red-100"
    >
      <div className="flex items-start gap-3 bg-gradient-to-br from-red-50 to-amber-50 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-red-900">Hết credit</p>
          <p className="mt-1 text-[13px] text-slate-700">
            {alert.message ?? 'Số dư credit không đủ để thực hiện thao tác này.'}
          </p>
          {alert.action && (
            <p className="mt-1 text-[12px] text-slate-500">
              Hành động: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">{alert.action}</code>
            </p>
          )}
          {alert.required != null && alert.balance != null && (
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[12px]">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-slate-500">Cần:</span>
                <span className="font-semibold text-slate-900">{alert.required}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Có:</span>
                <span className="font-semibold text-red-600">{alert.balance}</span>
              </div>
              {alert.missing != null && alert.missing > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Thiếu:</span>
                  <span className="font-semibold text-red-600">{alert.missing}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex border-t border-red-100 bg-white">
        <Link
          href="/recruiter/billing/topup"
          onClick={onDismiss}
          className="flex-1 px-4 py-2.5 text-center text-[13px] font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 transition hover:from-red-700 hover:to-amber-700"
        >
          Mua thêm credit ngay
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="border-l border-slate-100 px-4 py-2.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}

export function useCreditAlert(): CreditAlertContextValue {
  const ctx = useContext(CreditAlertContext);
  if (!ctx) {
    // Provider chưa mount → fallback an toàn (no-op)
    return {
      alert: { visible: false },
      showAlert: () => undefined,
      dismiss: () => undefined,
    };
  }
  return ctx;
}

/**
 * Helper: kiểm tra error có phải INSUFFICIENT_CREDIT không và gọi showAlert.
 * Dùng trong catch block của các call site tiêu credit.
 */
export function handleCreditError(err: unknown, showAlert: (s: Omit<CreditAlertState, 'visible'>) => void): void {
  if (!(err instanceof ApiError)) return;
  if (err.code === 'INSUFFICIENT_CREDIT' || err.code === 'PLAN_ACTION_FORBIDDEN') {
    const d = err.details ?? {};
    showAlert({
      message: typeof d.message === 'string' ? d.message : err.message,
      required: typeof d.required === 'number' ? d.required : undefined,
      balance: typeof d.balance === 'number' ? d.balance : undefined,
      missing: typeof d.missing === 'number' ? d.missing : undefined,
      action: typeof d.action === 'string' ? d.action : undefined,
    });
  }
}
