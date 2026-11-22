/**
 * Client gọi API billing cho recruiter (JWT + role Recruiter/SuperAdmin).
 * Endpoint /billing/credits* và /billing/topup*, /billing/orders, /billing/topup/mock/*.
 */
import type {
  RecruiterCreditBalanceResponse,
  RecruiterCreditSummaryResponse,
  BillingCreditLedgerListResponse,
  BillingCompanyPlanView,
  BillingOrderView,
  PaymentCheckoutResponse,
  RecruiterCreateCheckoutRequest,
  RecruiterCreatePlanCheckoutRequest,
  RecruiterOrderListResponse,
  RecruiterBillingEntitlements,
  RecruiterCreateSourcingCheckoutRequest,
  RecruiterConsumeSourcingRequest,
  RecruiterSourcingWorkspace,
  BillingCompanySourcingPlanView,
  RecruiterJobPackageListResponse,
  RecruiterApplyJobPackageRequest,
  RecruiterApplyJobPackageResponse,
  RecruiterApplicableJobView,
  RecruiterBillingOverview,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchRecruiterCompanyPlan(): Promise<BillingCompanyPlanView | null> {
  return apiRequest<BillingCompanyPlanView | null>('/billing/company-plan');
}

export async function fetchRecruiterEntitlements(): Promise<RecruiterBillingEntitlements> {
  return apiRequest<RecruiterBillingEntitlements>('/billing/entitlements');
}

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

export async function activateRecruiterPlan(planCode: string): Promise<BillingCompanyPlanView> {
  return apiRequest<BillingCompanyPlanView>('/billing/plan/activate', {
    method: 'POST',
    body: { planCode } as RecruiterCreatePlanCheckoutRequest,
  });
}

export async function activateRecruiterSourcingPlan(
  planCode: string,
): Promise<BillingCompanySourcingPlanView> {
  return apiRequest<BillingCompanySourcingPlanView>('/billing/sourcing/activate', {
    method: 'POST',
    body: { planCode } as RecruiterCreateSourcingCheckoutRequest,
  });
}

export async function fetchRecruiterSourcing(): Promise<RecruiterSourcingWorkspace> {
  return apiRequest<RecruiterSourcingWorkspace>('/billing/sourcing');
}

/** Danh sách gói tin đăng đã mua của công ty (mã TD-xxxxxx). */
export async function fetchRecruiterJobPackages(): Promise<RecruiterJobPackageListResponse> {
  return apiRequest<RecruiterJobPackageListResponse>('/billing/job-packages');
}

/**
 * Tổng quan Gói dịch vụ & Ví Credit — đọc trực tiếp `BillingJobPackage` +
 * `BillingHuntPackage` + Ví Credit dùng chung (KHÔNG đọc số cộng dồn legacy).
 */
export async function fetchRecruiterBillingOverview(): Promise<RecruiterBillingOverview> {
  return apiRequest<RecruiterBillingOverview>('/billing/overview');
}

/**
 * Gắn gói tin đăng vào 1 tin tuyển dụng có sẵn.
 *
 * Nếu gói đang `UNUSED` → kích hoạt gói + cộng Credit + đăng tin, tất cả trong
 * 1 transaction. Nếu gói đã `ACTIVE` → chỉ trừ 1 lượt đăng (KHÔNG cộng lại Credit).
 */
export async function applyJobPackageToJob(
  packageId: string,
  jobId: string,
): Promise<RecruiterApplyJobPackageResponse> {
  return apiRequest<RecruiterApplyJobPackageResponse>(
    `/billing/job-packages/${packageId}/apply-job`,
    {
      method: 'POST',
      body: { jobId } as RecruiterApplyJobPackageRequest,
    },
  );
}

/** Danh sách tin tuyển dụng có thể áp dụng gói (nháp / đã đóng / hết hạn / gói khám phá). */
export async function fetchApplicableJobs(): Promise<RecruiterApplicableJobView[]> {
  return apiRequest<RecruiterApplicableJobView[]>('/billing/job-packages/applicable-jobs');
}

export async function consumeRecruiterSourcing(
  body: RecruiterConsumeSourcingRequest,
): Promise<RecruiterSourcingWorkspace> {
  return apiRequest<RecruiterSourcingWorkspace>('/billing/sourcing/consume', {
    method: 'POST',
    body,
  });
}

export async function closeRecruiterSourcingCampaign(
  campaignId: string,
): Promise<RecruiterSourcingWorkspace> {
  return apiRequest<RecruiterSourcingWorkspace>(
    `/billing/sourcing/campaigns/${encodeURIComponent(campaignId)}/close`,
    { method: 'POST' },
  );
}

export async function createTopupCheckout(
  topupId: string,
): Promise<PaymentCheckoutResponse> {
  return apiRequest<PaymentCheckoutResponse>('/billing/topup/checkout', {
    method: 'POST',
    body: { topupId } as RecruiterCreateCheckoutRequest,
  });
}

export async function createPlanCheckout(planCode: string): Promise<PaymentCheckoutResponse> {
  return apiRequest<PaymentCheckoutResponse>('/billing/plan/checkout', {
    method: 'POST',
    body: { planCode } as RecruiterCreatePlanCheckoutRequest,
  });
}

export async function createSourcingCheckout(planCode: string): Promise<PaymentCheckoutResponse> {
  return apiRequest<PaymentCheckoutResponse>('/billing/sourcing/checkout', {
    method: 'POST',
    body: { planCode } as RecruiterCreateSourcingCheckoutRequest,
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
