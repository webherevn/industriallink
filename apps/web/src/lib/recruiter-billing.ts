/**
 * Client gọi API billing cho recruiter (JWT + role Recruiter/SuperAdmin).
 * Endpoint /billing/credits* và /billing/topup*, /billing/orders, /billing/topup/mock/*.
 */
import type {
  RecruiterCreditBalanceResponse,
  RecruiterCreditSummaryResponse,
  BillingCreditLedgerListResponse,
  BillingOrderView,
  PaymentCheckoutResponse,
  RecruiterCreateCheckoutRequest,
  RecruiterOrderListResponse,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchRecruiterCreditBalance(): Promise<RecruiterCreditBalanceResponse> {
  return apiRequest<RecruiterCreditBalanceResponse>('/billing/credits/balance');
}

export async function fetchRecruiterCreditTransactions(opts: {
  limit?: number;
  offset?: number;
} = {}): Promise<BillingCreditLedgerListResponse> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiRequest<BillingCreditLedgerListResponse>(
    `/billing/credits/transactions${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchRecruiterCreditSummary(): Promise<RecruiterCreditSummaryResponse> {
  return apiRequest<RecruiterCreditSummaryResponse>('/billing/credits/summary');
}

// =========================================================================
// TOP-UP PAYMENT (Bước 7)
// =========================================================================

export async function createTopupCheckout(
  topupId: string,
): Promise<PaymentCheckoutResponse> {
  return apiRequest<PaymentCheckoutResponse>('/billing/topup/checkout', {
    method: 'POST',
    body: { topupId } as RecruiterCreateCheckoutRequest,
  });
}

export async function fetchRecruiterOrders(): Promise<RecruiterOrderListResponse> {
  return apiRequest<RecruiterOrderListResponse>('/billing/orders');
}

/** Mock-only: báo cho backend đánh dấu order thành công. */
export async function mockTopupSuccess(orderId: string): Promise<BillingOrderView> {
  return apiRequest<BillingOrderView>(`/billing/topup/mock/${orderId}/success`, { method: 'POST' });
}

/** Mock-only: báo cho backend đánh dấu order thất bại. */
export async function mockTopupFailure(orderId: string, reason?: string): Promise<BillingOrderView> {
  return apiRequest<BillingOrderView>(`/billing/topup/mock/${orderId}/fail`, {
    method: 'POST',
    body: { reason },
  });
}
