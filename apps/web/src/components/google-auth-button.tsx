'use client';

import type { LoginResponse, UserRole } from '@industriallink/contracts';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchGoogleAuthConfig, loginWithGoogle } from '@/lib/auth';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google script load failed')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script load failed'));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

export function GoogleAuthButton({
  mode,
  role,
  disabled,
  onSuccess,
  onError,
}: {
  mode: 'login' | 'register';
  role?: UserRole.Candidate | UserRole.Recruiter;
  disabled?: boolean;
  onSuccess: (res: LoginResponse) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef(role);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  roleRef.current = role;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [clientId, setClientId] = useState<string | null>(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (clientId) return;
    let cancelled = false;
    void fetchGoogleAuthConfig().then((cfg) => {
      if (!cancelled && cfg.enabled && cfg.clientId) {
        setClientId(cfg.clientId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
        const gsi = window.google.accounts.id;
        gsi.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response) => {
            if (!response?.credential) {
              onErrorRef.current('Không nhận được xác thực từ Google.');
              return;
            }
            setSubmitting(true);
            try {
              const res = await loginWithGoogle(response.credential, roleRef.current);
              onSuccessRef.current(res);
            } catch (err) {
              onErrorRef.current(
                err instanceof ApiError
                  ? err.message
                  : 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.',
              );
            } finally {
              setSubmitting(false);
            }
          },
        });

        const width = Math.min(380, Math.max(240, Math.floor(containerRef.current.clientWidth || 340)));
        containerRef.current.innerHTML = '';
        gsi.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
          locale: 'vi',
        });
      })
      .catch(() => {
        // Bỏ qua nếu trình duyệt chặn script Google bên thứ 3
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, mode]);

  if (!clientId) return null;

  return (
    <div className="mt-5">
      <div className="relative flex items-center justify-center">
        <span className="w-full border-t border-slate-200" aria-hidden />
        <span className="shrink-0 bg-white px-3 text-xs font-medium text-slate-400">hoặc</span>
        <span className="w-full border-t border-slate-200" aria-hidden />
      </div>

      <div
        className={
          disabled || submitting
            ? 'pointer-events-none mt-4 flex justify-center opacity-60'
            : 'mt-4 flex justify-center'
        }
      >
        <div ref={containerRef} className="flex w-full justify-center" />
      </div>

      {submitting ? (
        <p className="mt-2 text-center text-xs text-slate-500">Đang xác thực với Google…</p>
      ) : null}
    </div>
  );
}
