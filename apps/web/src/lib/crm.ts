import type {
  CreateCrmActivityRequest,
  CreateCrmDealRequest,
  CreateCrmLeadRequest,
  CrmActivityView,
  CrmBoard,
  CrmCompanyOption,
  CrmDealView,
  CrmLeadView,
  CrmPlanOption,
  CrmRenewalView,
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
