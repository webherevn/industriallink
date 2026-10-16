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
  CrmDealView,
  CrmLeadView,
  CrmPartnerView,
  CrmPaidInvoiceLedgerView,
  CrmPaidOrderInvoiceView,
  CrmPlanOption,
  CrmRenewalView,
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

export function fetchCrmCompanies(query: string): Promise<CrmCompanyOption[]> {
  return apiRequest<CrmCompanyOption[]>(`/crm/companies?q=${encodeURIComponent(query)}`);
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
