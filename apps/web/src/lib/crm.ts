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
  CrmQuoteView,
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
import { apiRequest } from './api';

export function fetchCrmBoard(): Promise<CrmBoard> {
  return apiRequest<CrmBoard>('/crm/board');
}

export function createCrmLead(body: CreateCrmLeadRequest): Promise<CrmLeadView> {
  return apiRequest<CrmLeadView>('/crm/leads', { method: 'POST', body });
}

export function updateCrmLead(id: string, body: UpdateCrmLeadRequest): Promise<CrmLeadView> {
  return apiRequest<CrmLeadView>(`/crm/leads/${id}`, { method: 'PATCH', body });
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

export function fetchCrmQuotes(): Promise<CrmQuoteView[]> {
  return apiRequest<CrmQuoteView[]>('/crm/quotes');
}

export function fetchCrmQuote(id: string): Promise<CrmQuoteView> {
  return apiRequest<CrmQuoteView>(`/crm/quotes/${id}`);
}

export function createCrmQuote(body: CreateCrmQuoteRequest): Promise<CrmQuoteView> {
  return apiRequest<CrmQuoteView>('/crm/quotes', { method: 'POST', body });
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
