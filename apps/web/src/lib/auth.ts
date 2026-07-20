import type {
  AuthUserView,
  LoginResponse,
  RegisterRequest,
  TotpSetupResponse,
  UserRole,
} from '@industriallink/contracts';
import { isLoginMfaChallenge } from '@industriallink/contracts';
import { apiRequest, tokenStore } from './api';

export async function register(input: RegisterRequest): Promise<{ message: string; devOtp?: string }> {
  return apiRequest('/auth/register', { method: 'POST', body: input });
}

export async function verifyOtp(email: string, otp: string): Promise<{ message: string }> {
  return apiRequest('/auth/verify-otp', { method: 'POST', body: { email, otp } });
}

export async function resendOtp(email: string): Promise<{ message: string; devOtp?: string }> {
  return apiRequest('/auth/resend-otp', { method: 'POST', body: { email } });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!isLoginMfaChallenge(res)) {
    tokenStore.set(res.accessToken);
  }
  return res;
}

export async function verifyLoginOtp(mfaToken: string, otp: string): Promise<LoginResponse> {
  const res = await apiRequest<LoginResponse>('/auth/verify-login-otp', {
    method: 'POST',
    body: { mfaToken, otp },
  });
  if (!isLoginMfaChallenge(res)) {
    tokenStore.set(res.accessToken);
  }
  return res;
}

export async function resendLoginOtp(mfaToken: string): Promise<{ message: string; devOtp?: string }> {
  return apiRequest('/auth/resend-login-otp', {
    method: 'POST',
    body: { mfaToken },
  });
}

export async function fetchMe(): Promise<AuthUserView> {
  return apiRequest('/auth/me');
}

export async function updateMfa(enabled: boolean): Promise<AuthUserView> {
  return apiRequest('/auth/me/mfa', {
    method: 'PATCH',
    body: { enabled },
  });
}

export async function setupTotp(): Promise<TotpSetupResponse> {
  return apiRequest('/auth/me/totp/setup', { method: 'POST' });
}

export async function confirmTotp(code: string): Promise<AuthUserView> {
  return apiRequest('/auth/me/totp/verify', { method: 'POST', body: { code } });
}

export async function disableTotp(): Promise<AuthUserView> {
  return apiRequest('/auth/me/totp/disable', { method: 'POST' });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST', retryOnUnauthorized: false });
  } finally {
    tokenStore.clear();
  }
}

export type { UserRole };
export { isLoginMfaChallenge };
