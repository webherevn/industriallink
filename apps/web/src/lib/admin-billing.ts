/**
 * Client gọi API billing (superadmin).
 * Tất cả endpoint /admin/billing yêu cầu JWT + role SuperAdmin.
 */
import type {
  AdminCreatePlatformPlanRequest,
  AdminUpdatePlatformPlanRequest,
  AdminCreateSourcingPlanRequest,
  AdminUpdateSourcingPlanRequest,
  AdminCreateCreditTopupRequest,
  AdminUpdateCreditTopupRequest,
  AdminUpdateCreditPolicyRequest,
  AdminUpdateCurrencyConfigRequest,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  BillingCreditTopupView,
  BillingCreditPolicyView,
  BillingCurrencyDisplay,
  BillingAuditListResponse,
  BillingPublicConfig,
  BillingCreditLedgerListResponse,
  BillingCreditSummary,
  BillingCreditAccountView,
  AdminCreditAdjustRequest,
  BillingPaymentSettingView,
  UpdatePaymentSettingsRequest,
  AdminUpdatePlanActionCostsRequest,
  AdminAssignCompanyPlanRequest,
  BillingPlanActionCostView,
  BillingCompanyPlanView,
  AdminUpdatePageContentRequest,
  BillingPageContentView,
} from '@industriallink/contracts';
import { apiRequest } from './api';

// =========================================================================
// PUBLIC (no auth)
// =========================================================================
export async function fetchPublicBillingConfig(): Promise<BillingPublicConfig> {
  return apiRequest<BillingPublicConfig>('/billing/public-config');
}

// =========================================================================
// ADMIN — Platform Plans
// =========================================================================
export async function fetchAdminPlatformPlans(includeInactive = true): Promise<BillingPlatformPlanView[]> {
  return apiRequest<BillingPlatformPlanView[]>(
    `/admin/billing/platform-plans?includeInactive=${includeInactive}`
  );
}

export async function createAdminPlatformPlan(
  body: AdminCreatePlatformPlanRequest
): Promise<BillingPlatformPlanView> {
  return apiRequest<BillingPlatformPlanView>('/admin/billing/platform-plans', { method: 'POST', body });
}

export async function updateAdminPlatformPlan(
  id: string,
  body: AdminUpdatePlatformPlanRequest
): Promise<BillingPlatformPlanView> {
  return apiRequest<BillingPlatformPlanView>(`/admin/billing/platform-plans/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteAdminPlatformPlan(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/billing/platform-plans/${id}`, { method: 'DELETE' });
}

export async function fetchAdminPlanActionCosts(planId: string): Promise<BillingPlanActionCostView[]> {
  return apiRequest<BillingPlanActionCostView[]>(`/admin/billing/platform-plans/${planId}/costs`);
}

export async function updateAdminPlanActionCosts(
  planId: string,
  body: AdminUpdatePlanActionCostsRequest,
): Promise<BillingPlanActionCostView[]> {
  return apiRequest<BillingPlanActionCostView[]>(`/admin/billing/platform-plans/${planId}/costs`, {
    method: 'PATCH',
    body,
  });
}

export async function fetchAdminCompanyPlan(companyId: string): Promise<BillingCompanyPlanView | null> {
  return apiRequest<BillingCompanyPlanView | null>(`/admin/billing/company-plans/${companyId}`);
}

export async function assignAdminCompanyPlan(
  body: AdminAssignCompanyPlanRequest,
): Promise<BillingCompanyPlanView> {
  return apiRequest<BillingCompanyPlanView>('/admin/billing/company-plans', { method: 'PUT', body });
}

export async function unassignAdminCompanyPlan(companyId: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/billing/company-plans/${companyId}`, { method: 'DELETE' });
}

// =========================================================================
// ADMIN — Sourcing Plans
// =========================================================================
export async function fetchAdminSourcingPlans(includeInactive = true): Promise<BillingSourcingPlanView[]> {
  return apiRequest<BillingSourcingPlanView[]>(
    `/admin/billing/sourcing-plans?includeInactive=${includeInactive}`
  );
}

export async function createAdminSourcingPlan(
  body: AdminCreateSourcingPlanRequest
): Promise<BillingSourcingPlanView> {
  return apiRequest<BillingSourcingPlanView>('/admin/billing/sourcing-plans', { method: 'POST', body });
}

export async function updateAdminSourcingPlan(
  id: string,
  body: AdminUpdateSourcingPlanRequest
): Promise<BillingSourcingPlanView> {
  return apiRequest<BillingSourcingPlanView>(`/admin/billing/sourcing-plans/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteAdminSourcingPlan(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/billing/sourcing-plans/${id}`, { method: 'DELETE' });
}

// =========================================================================
// ADMIN — Credit Top-up
// =========================================================================
export async function fetchAdminCreditTopups(includeInactive = true): Promise<BillingCreditTopupView[]> {
  return apiRequest<BillingCreditTopupView[]>(
    `/admin/billing/credit-topups?includeInactive=${includeInactive}`
  );
}

export async function createAdminCreditTopup(
  body: AdminCreateCreditTopupRequest
): Promise<BillingCreditTopupView> {
  return apiRequest<BillingCreditTopupView>('/admin/billing/credit-topups', { method: 'POST', body });
}

export async function updateAdminCreditTopup(
  id: string,
  body: AdminUpdateCreditTopupRequest
): Promise<BillingCreditTopupView> {
  return apiRequest<BillingCreditTopupView>(`/admin/billing/credit-topups/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteAdminCreditTopup(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/admin/billing/credit-topups/${id}`, { method: 'DELETE' });
}

// =========================================================================
// ADMIN — Credit Policy
// =========================================================================
export async function fetchAdminCreditPolicy(): Promise<BillingCreditPolicyView> {
  return apiRequest<BillingCreditPolicyView>('/admin/billing/credit-policy');
}

export async function updateAdminCreditPolicy(
  body: AdminUpdateCreditPolicyRequest
): Promise<BillingCreditPolicyView> {
  return apiRequest<BillingCreditPolicyView>('/admin/billing/credit-policy', { method: 'PATCH', body });
}

// =========================================================================
// ADMIN — Currency
// =========================================================================
export async function fetchAdminCurrency(): Promise<BillingCurrencyDisplay> {
  return apiRequest<BillingCurrencyDisplay>('/admin/billing/currency');
}

export async function updateAdminCurrency(
  body: AdminUpdateCurrencyConfigRequest
): Promise<BillingCurrencyDisplay> {
  return apiRequest<BillingCurrencyDisplay>('/admin/billing/currency', { method: 'PATCH', body });
}

// =========================================================================
// ADMIN — Page content (/bang-gia)
// =========================================================================
export async function fetchAdminPageContent(): Promise<BillingPageContentView> {
  return apiRequest<BillingPageContentView>('/admin/billing/page-content');
}

export async function updateAdminPageContent(
  body: AdminUpdatePageContentRequest,
): Promise<BillingPageContentView> {
  return apiRequest<BillingPageContentView>('/admin/billing/page-content', { method: 'PATCH', body });
}

// =========================================================================
// ADMIN — Audit log
// =========================================================================
export interface AuditLogFilters {
  entity?: string;
  limit?: number;
  offset?: number;
}

/** @deprecated dùng `fetchAdminAuditLogs` — alias giữ tương thích. */
export const fetchAdminBillingAudit = fetchAdminAuditLogs;

export async function fetchAdminAuditLogs(
  opts: AuditLogFilters = {},
): Promise<BillingAuditListResponse> {
  const params = new URLSearchParams();
  if (opts.entity) params.set('entity', opts.entity);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiRequest<BillingAuditListResponse>(
    `/admin/billing/audit-log${qs ? `?${qs}` : ''}`,
  );
}

// =========================================================================
// ADMIN — Credit Ledger
// =========================================================================
export interface CreditLedgerFilters {
  companyId?: string;
  type?: string;
  action?: string;
  candidateId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAdminCreditLedger(
  opts: CreditLedgerFilters = {},
): Promise<BillingCreditLedgerListResponse> {
  const params = new URLSearchParams();
  if (opts.companyId) params.set('companyId', opts.companyId);
  if (opts.type) params.set('type', opts.type);
  if (opts.action) params.set('action', opts.action);
  if (opts.candidateId) params.set('candidateId', opts.candidateId);
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return apiRequest<BillingCreditLedgerListResponse>(
    `/admin/billing/credit-ledger${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchAdminCreditSummary(): Promise<BillingCreditSummary> {
  return apiRequest<BillingCreditSummary>('/admin/billing/credit-ledger/summary');
}

export async function fetchAdminCreditAccounts(
  companyId?: string,
): Promise<{ items: BillingCreditAccountView[]; total: number }> {
  const qs = companyId ? `?companyId=${companyId}` : '';
  return apiRequest(`/admin/billing/credit-ledger/accounts${qs}`);
}

export async function adjustAdminCredit(
  body: AdminCreditAdjustRequest,
): Promise<{ ok: boolean; message: string }> {
  return apiRequest<{ ok: boolean; message: string }>('/admin/billing/credit-ledger/adjust', {
    method: 'POST',
    body,
  });
}

// =========================================================================
// PAYMENT SETTINGS (Bước 7)
// =========================================================================

export async function fetchAdminPaymentSettings(): Promise<BillingPaymentSettingView> {
  return apiRequest<BillingPaymentSettingView>('/admin/billing/payment-settings');
}

export async function updateAdminPaymentSettings(
  body: UpdatePaymentSettingsRequest,
): Promise<BillingPaymentSettingView> {
  return apiRequest<BillingPaymentSettingView>('/admin/billing/payment-settings', {
    method: 'PATCH',
    body,
  });
}
