/** Đợt 1: lead và phễu bán gói. Không gồm hoa hồng, VAT, VietQR. */

export type CrmLeadStatus = 'open' | 'converted' | 'unqualified';
export type CrmPlanKind = 'platform' | 'sourcing';
export type CrmProvisionState = 'not_provisioned';

export interface CrmLeadView {
  id: string;
  leadCode: string;
  companyName: string;
  taxCode: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  industry: string | null;
  companyId: string | null;
  status: CrmLeadStatus;
  ownerUserId: string;
  createdAt: string;
}

export interface CrmStageView {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  winProbability: number;
}

export interface CrmDealView {
  id: string;
  dealCode: string;
  title: string;
  leadId: string;
  companyName: string;
  companyId: string | null;
  stageId: string;
  stageCode: string;
  planKind: CrmPlanKind | null;
  planCode: string | null;
  /** Giá niêm yết chưa VAT. Không dùng để gán gói. */
  listPriceVnd: string | null;
  billingOrderId: string | null;
  provisionState: CrmProvisionState;
  ownerUserId: string;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
}

export interface CrmBoard {
  pipelineCode: string;
  pipelineName: string;
  stages: CrmStageView[];
  leads: CrmLeadView[];
  deals: CrmDealView[];
}

export interface CreateCrmLeadRequest {
  companyName: string;
  taxCode?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  industry?: string | null;
  companyId?: string | null;
}

export interface CreateCrmDealRequest {
  leadId: string;
  title: string;
  planKind?: CrmPlanKind | null;
  planCode?: string | null;
}

export interface MoveCrmDealRequest {
  stageCode: string;
  lostReason?: string | null;
}
