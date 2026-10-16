/** CRM: lead, phễu, nhật ký, hóa đơn đã xuất. Không gán gói, không công nợ, không hoa hồng. */

export type CrmLeadStatus = 'open' | 'converted' | 'unqualified';
/** unknown chỉ còn trên lead tạo trước khi ghi nguồn. */
export type CrmLeadSource = 'web' | 'zalo' | 'event' | 'partner' | 'unknown';
export type CrmInvoiceStatus = 'none' | 'issued';
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
  source: CrmLeadSource;
  ownerUserId: string;
  ownerName: string;
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
  invoiceStatus: CrmInvoiceStatus;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
  provisionState: CrmProvisionState;
  ownerUserId: string;
  ownerName: string;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
}

export type CrmActivityType = 'note' | 'call' | 'zalo' | 'visit' | 'stage';

export interface CrmActivityView {
  id: string;
  leadId: string | null;
  dealId: string | null;
  companyName: string | null;
  activityType: CrmActivityType;
  summary: string;
  createdByName: string;
  createdAt: string;
}

export interface CrmRenewalView {
  companyId: string;
  companyName: string;
  kind: CrmPlanKind;
  planCode: string;
  planName: string;
  endsAt: string;
  daysLeft: number;
  /** Lead đang mở của công ty, nếu có. Dùng để tạo deal gia hạn, không gán gói. */
  leadId: string | null;
}

export interface CrmBoard {
  pipelineCode: string;
  pipelineName: string;
  stages: CrmStageView[];
  leads: CrmLeadView[];
  deals: CrmDealView[];
  activities: CrmActivityView[];
}

export interface CreateCrmLeadRequest {
  companyName: string;
  taxCode?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  industry?: string | null;
  companyId?: string | null;
  source: Exclude<CrmLeadSource, 'unknown'>;
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

export interface IssueCrmInvoiceRequest {
  invoiceNumber: string;
}

export interface CrmCompanyOption {
  id: string;
  name: string;
  taxCode: string | null;
}

export interface CrmPlanOption {
  kind: CrmPlanKind;
  code: string;
  name: string;
  priceVnd: string;
}

export interface CreateCrmActivityRequest {
  leadId?: string | null;
  dealId?: string | null;
  activityType: Exclude<CrmActivityType, 'stage'>;
  summary: string;
}
