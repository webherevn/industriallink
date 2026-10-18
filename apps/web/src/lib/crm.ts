import type {
  CreateCrmActivityRequest,
  CreateCrmDealRequest,
  CreateCrmLeadRequest,
  CreateCrmPartnerClaimRequest,
  CreateCrmPartnerRequest,
  CrmCommissionLedgerView,
  CrmCommissionPeriodListView,
  CrmCommissionPeriodView,
  CrmCommissionView,
  CrmPayoutDayView,
  CrmVatView,
  UpdateCrmVatRequest,
  UpdateCrmPayoutDayRequest,
  CloseCrmCommissionMonthRequest,
  CloseCrmCommissionMonthResult,
  CrmPartnerClaimView,
  CrmPartnerSelfView,
  RegisterCrmPartnerRequest,
  UpdateCrmCommissionRequest,
  CrmActivityView,
  CrmBoard,
  CrmCompanyOption,
  CrmCustomerView,
  CrmTaxSuggestion,
  CrmCompanyProfileView,
  CrmUnclaimedCustomerView,
  CrmOwnerOption,
  UpdateCrmLeadRequest,
  CrmDealView,
  CrmLeadView,
  CrmPartnerView,
  CrmPaidInvoiceLedgerView,
  CrmPaidOrderInvoiceView,
  CrmPlanOption,
  CrmRenewalView,
  CrmFunnelReport,
  CrmPipelineReport,
  CrmLeadSourceReport,
  CrmQuoteReport,
  CrmRenewalReport,
  CrmPartnerPaidReport,
  CrmWorkspaceReport,
  CrmReceivableLedger,
  CrmQuoteView,
  CrmQuoteFormView,
  UpdateCrmQuoteFormRequest,
  CrmStaffProfilePage,
  CrmStaffProfileView,
  UpdateCrmStaffProfileRequest,
  CreateCrmQuoteRequest,
  CrmMarketingOverview,
  CreateCrmCampaignRequest,
  UpdateCrmCampaignRequest,
  CreateCrmMarketingChannelRequest,
  UpdateCrmMarketingChannelRequest,
  CreateCrmMarketingCostRequest,
  CrmEnterpriseRequestView,
  IssueCrmInvoiceRequest,
  MoveCrmDealRequest,
} from '@industriallink/contracts';
import { apiRequest, getApiBase, tokenStore } from './api';

export function fetchCrmBoard(): Promise<CrmBoard> {
  return apiRequest<CrmBoard>('/crm/board');
}

export function createCrmLead(body: CreateCrmLeadRequest): Promise<CrmLeadView> {
  return apiRequest<CrmLeadView>('/crm/leads', { method: 'POST', body });
}

export function updateCrmLead(id: string, body: UpdateCrmLeadRequest): Promise<CrmLeadView> {
  return apiRequest<CrmLeadView>(`/crm/leads/${id}`, { method: 'PATCH', body });
}

export function deleteCrmLead(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/crm/leads/${id}`, { method: 'DELETE' });
}

export function deleteCrmDeal(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/crm/deals/${id}`, { method: 'DELETE' });
}

export function deleteCrmQuote(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/crm/quotes/${id}`, { method: 'DELETE' });
}

export function fetchCrmUnclaimed(): Promise<CrmUnclaimedCustomerView[]> {
  return apiRequest<CrmUnclaimedCustomerView[]>('/crm/unclaimed-customers');
}

export function claimCrmCustomer(companyId: string): Promise<CrmLeadView> {
  return apiRequest<CrmLeadView>(`/crm/companies/${companyId}/claim`, { method: 'POST' });
}

export function fetchCrmCompany(id: string): Promise<CrmCompanyProfileView> {
  return apiRequest<CrmCompanyProfileView>(`/crm/companies/${id}`);
}

export function fetchCrmFollowUps(): Promise<CrmLeadView[]> {
  return apiRequest<CrmLeadView[]>('/crm/follow-ups');
}

export function fetchCrmOwners(): Promise<CrmOwnerOption[]> {
  return apiRequest<CrmOwnerOption[]>('/crm/owners');
}

export function createCrmDeal(body: CreateCrmDealRequest): Promise<CrmDealView> {
  return apiRequest<CrmDealView>('/crm/deals', { method: 'POST', body });
}

export function moveCrmDeal(id: string, body: MoveCrmDealRequest): Promise<CrmDealView> {
  return apiRequest<CrmDealView>(`/crm/deals/${id}/stage`, { method: 'PATCH', body });
}

export function fetchCrmInvoices(): Promise<CrmPaidInvoiceLedgerView> {
  return apiRequest<CrmPaidInvoiceLedgerView>('/crm/invoices');
}

export function issueCrmOrderInvoice(orderId: string, body: IssueCrmInvoiceRequest): Promise<CrmPaidOrderInvoiceView> {
  return apiRequest<CrmPaidOrderInvoiceView>(`/crm/orders/${orderId}/invoice`, { method: 'PATCH', body });
}

export function createCrmActivity(body: CreateCrmActivityRequest): Promise<CrmActivityView> {
  return apiRequest<CrmActivityView>('/crm/activities', { method: 'POST', body });
}

export function fetchCrmRenewals(): Promise<CrmRenewalView[]> {
  return apiRequest<CrmRenewalView[]>('/crm/renewals');
}

export function fetchCrmFunnelReport(month: string): Promise<CrmFunnelReport> {
  return apiRequest<CrmFunnelReport>(`/crm/reports/funnel?month=${encodeURIComponent(month)}`);
}

export function fetchCrmPipelineReport(month: string): Promise<CrmPipelineReport> {
  return apiRequest<CrmPipelineReport>(`/crm/reports/pipeline?month=${encodeURIComponent(month)}`);
}

export function fetchCrmLeadSourceReport(month: string): Promise<CrmLeadSourceReport> {
  return apiRequest<CrmLeadSourceReport>(`/crm/reports/leads?month=${encodeURIComponent(month)}`);
}

export function fetchCrmQuoteReport(month: string): Promise<CrmQuoteReport> {
  return apiRequest<CrmQuoteReport>(`/crm/reports/quotes?month=${encodeURIComponent(month)}`);
}

export function fetchCrmRenewalReport(month: string): Promise<CrmRenewalReport> {
  return apiRequest<CrmRenewalReport>(`/crm/reports/renewals?month=${encodeURIComponent(month)}`);
}

export function fetchCrmPartnerPaidReport(month: string): Promise<CrmPartnerPaidReport> {
  return apiRequest<CrmPartnerPaidReport>(`/crm/reports/partners?month=${encodeURIComponent(month)}`);
}

export function fetchCrmWorkspace(month: string): Promise<CrmWorkspaceReport> {
  return apiRequest<CrmWorkspaceReport>(`/crm/workspace?month=${encodeURIComponent(month)}`);
}

export function fetchCrmQuoteForm(): Promise<CrmQuoteFormView> {
  return apiRequest<CrmQuoteFormView>('/crm/quote-form');
}

export function saveCrmQuoteForm(body: UpdateCrmQuoteFormRequest): Promise<CrmQuoteFormView> {
  return apiRequest<CrmQuoteFormView>('/crm/quote-form', { method: 'PATCH', body });
}

export function uploadCrmQuoteFormLogo(file: File): Promise<CrmQuoteFormView> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<CrmQuoteFormView>('/crm/quote-form/logo', { method: 'POST', body: form, isForm: true });
}

export function fetchCrmStaffProfile(userId?: string): Promise<CrmStaffProfilePage> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiRequest<CrmStaffProfilePage>(`/crm/staff-profile${query}`);
}

export function saveCrmStaffProfile(body: UpdateCrmStaffProfileRequest): Promise<CrmStaffProfileView> {
  return apiRequest<CrmStaffProfileView>('/crm/staff-profile', { method: 'PATCH', body });
}

export function uploadCrmStaffAvatar(file: File, userId?: string): Promise<CrmStaffProfileView> {
  const form = new FormData();
  form.append('file', file);
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiRequest<CrmStaffProfileView>(`/crm/staff-profile/avatar${query}`, { method: 'POST', body: form, isForm: true });
}

export async function fetchCrmStaffAvatarObjectUrl(userId: string): Promise<string | null> {
  const token = tokenStore.get();
  if (!token) return null;
  const res = await fetch(`${getApiBase()}/crm/staff-profile/avatar?userId=${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchCrmQuoteFormLogoObjectUrl(): Promise<string | null> {
  const token = tokenStore.get();
  if (!token) return null;
  const res = await fetch(`${getApiBase()}/crm/quote-form/logo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function fetchCrmQuotes(): Promise<CrmQuoteView[]> {
  return apiRequest<CrmQuoteView[]>('/crm/quotes');
}

export function fetchCrmQuote(id: string): Promise<CrmQuoteView> {
  return apiRequest<CrmQuoteView>(`/crm/quotes/${id}`);
}

export function createCrmQuote(body: CreateCrmQuoteRequest): Promise<CrmQuoteView> {
  return apiRequest<CrmQuoteView>('/crm/quotes', { method: 'POST', body });
}

export function acceptCrmQuote(id: string): Promise<CrmQuoteView> {
  return apiRequest<CrmQuoteView>(`/crm/quotes/${id}/accept`, { method: 'POST' });
}

export function collectCrmInstallment(quoteId: string, installmentId: string): Promise<CrmQuoteView> {
  return apiRequest<CrmQuoteView>(`/crm/quotes/${quoteId}/installments/${installmentId}/collect`, { method: 'POST' });
}

export function fetchCrmReceivables(): Promise<CrmReceivableLedger> {
  return apiRequest<CrmReceivableLedger>('/crm/receivables');
}

export function requestEnterpriseConsult(): Promise<CrmEnterpriseRequestView> {
  return apiRequest<CrmEnterpriseRequestView>('/recruiter/enterprise-requests', { method: 'POST' });
}

export function fetchCrmCustomers(query: string): Promise<CrmCustomerView[]> {
  const q = query.trim();
  return apiRequest<CrmCustomerView[]>(`/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}

export function fetchCrmCompanies(query: string): Promise<CrmCompanyOption[]> {
  return apiRequest<CrmCompanyOption[]>(`/crm/companies?q=${encodeURIComponent(query)}`);
}

export function fetchCrmTaxSuggestions(query: string): Promise<CrmTaxSuggestion[]> {
  return apiRequest<CrmTaxSuggestion[]>(`/crm/tax-suggestions?q=${encodeURIComponent(query)}`);
}

export function fetchCrmPlans(): Promise<CrmPlanOption[]> {
  return apiRequest<CrmPlanOption[]>('/crm/plans');
}

export function fetchCrmCommission(): Promise<CrmCommissionView> {
  return apiRequest<CrmCommissionView>('/crm/commission');
}

export function updateCrmCommission(body: UpdateCrmCommissionRequest): Promise<CrmCommissionView> {
  return apiRequest<CrmCommissionView>('/crm/commission', { method: 'PATCH', body });
}

export function fetchCrmPayoutDay(): Promise<CrmPayoutDayView> {
  return apiRequest<CrmPayoutDayView>('/crm/payout-day');
}

export function updateCrmPayoutDay(body: UpdateCrmPayoutDayRequest): Promise<CrmPayoutDayView> {
  return apiRequest<CrmPayoutDayView>('/crm/payout-day', { method: 'PATCH', body });
}

export function fetchCrmVat(): Promise<CrmVatView> {
  return apiRequest<CrmVatView>('/crm/vat');
}

export function updateCrmVat(body: UpdateCrmVatRequest): Promise<CrmVatView> {
  return apiRequest<CrmVatView>('/crm/vat', { method: 'PATCH', body });
}

export function fetchCrmCommissionLedger(): Promise<CrmCommissionLedgerView> {
  return apiRequest<CrmCommissionLedgerView>('/crm/commissions');
}

export function fetchCrmCommissionPeriods(): Promise<CrmCommissionPeriodListView> {
  return apiRequest<CrmCommissionPeriodListView>('/crm/commission-periods');
}

export function closeCrmCommissionMonth(body: CloseCrmCommissionMonthRequest): Promise<CloseCrmCommissionMonthResult> {
  return apiRequest<CloseCrmCommissionMonthResult>('/crm/commission-periods', { method: 'POST', body });
}

export function allowCrmCommissionPayout(periodId: string): Promise<CrmCommissionPeriodView> {
  return apiRequest<CrmCommissionPeriodView>(`/crm/commission-periods/${periodId}/approve`, { method: 'POST' });
}

export function markCrmCommissionPaid(periodId: string): Promise<CrmCommissionPeriodView> {
  return apiRequest<CrmCommissionPeriodView>(`/crm/commission-periods/${periodId}/pay`, { method: 'POST' });
}

export function fetchCrmPartners(): Promise<CrmPartnerView[]> {
  return apiRequest<CrmPartnerView[]>('/crm/partners');
}

export function createCrmPartner(body: CreateCrmPartnerRequest): Promise<CrmPartnerView> {
  return apiRequest<CrmPartnerView>('/crm/partners', { method: 'POST', body });
}

export function fetchMyPartner(): Promise<CrmPartnerSelfView> {
  return apiRequest<CrmPartnerSelfView>('/recruiter/partner');
}

export function registerMyPartner(body: RegisterCrmPartnerRequest): Promise<CrmPartnerView> {
  return apiRequest<CrmPartnerView>('/recruiter/partner', { method: 'POST', body });
}

export function createCrmPartnerClaim(id: string, body: CreateCrmPartnerClaimRequest): Promise<CrmPartnerClaimView> {
  return apiRequest<CrmPartnerClaimView>(`/crm/partners/${id}/claims`, { method: 'POST', body });
}

export function createMyPartnerClaim(body: CreateCrmPartnerClaimRequest): Promise<CrmPartnerClaimView> {
  return apiRequest<CrmPartnerClaimView>('/recruiter/partner/claims', { method: 'POST', body });
}

export function fetchCrmMarketing(): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>('/crm/marketing');
}

export function createCrmCampaign(body: CreateCrmCampaignRequest): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>('/crm/marketing/campaigns', { method: 'POST', body });
}

export function updateCrmCampaign(id: string, body: UpdateCrmCampaignRequest): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>(`/crm/marketing/campaigns/${id}`, { method: 'PATCH', body });
}

export function createCrmMarketingChannel(body: CreateCrmMarketingChannelRequest): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>('/crm/marketing/channels', { method: 'POST', body });
}

export function updateCrmMarketingChannel(id: string, body: UpdateCrmMarketingChannelRequest): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>(`/crm/marketing/channels/${id}`, { method: 'PATCH', body });
}

export function createCrmMarketingCost(body: CreateCrmMarketingCostRequest): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>('/crm/marketing/costs', { method: 'POST', body });
}

export function deleteCrmMarketingCost(id: string): Promise<CrmMarketingOverview> {
  return apiRequest<CrmMarketingOverview>(`/crm/marketing/costs/${id}`, { method: 'DELETE' });
}
