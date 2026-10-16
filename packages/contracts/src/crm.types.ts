/** CRM: lead, phễu, nhật ký, hóa đơn đã xuất, hoa hồng chờ đối soát. Không gán gói, không công nợ, không lệnh chi. */

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
  partnerId: string | null;
  partnerName: string | null;
  partnerCode: string | null;
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
  /** Đơn đã thanh toán của deal này. Deal tạo sau lần trả không nhận đơn cũ. Không đổi bước phễu. */
  paidAmountVnd: string | null;
  paidAt: string | null;
  /** Số đã ghi cho đơn thanh toán đó. Null khi đã trả tiền nhưng chưa ghi số. */
  paidInvoiceNumber: string | null;
  /** Tên công ty trên đơn, để mở đúng sổ hóa đơn. */
  paidCompanyName: string | null;
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

export type CrmActivityType = 'note' | 'call' | 'zalo' | 'visit' | 'stage' | 'payment';

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
  /** Bắt buộc khi source là partner. */
  partnerId?: string | null;
}

export interface CrmPartnerView {
  id: string;
  name: string;
  phone: string;
  code: string;
  /** Link bảng giá gắn mã. Chưa tính hoa hồng. */
  referralUrl: string;
  /** true khi nhà tuyển dụng tự đăng ký. false khi CRM tạo hộ. */
  fromAccount: boolean;
  createdAt: string;
  claims: CrmPartnerClaimView[];
}

export interface CrmPartnerClaimView {
  id: string;
  partnerId: string;
  companyName: string;
  taxCode: string;
  contactPhone: string;
  createdAt: string;
}

export interface CreateCrmPartnerClaimRequest {
  companyName: string;
  taxCode: string;
  contactPhone: string;
}

export interface CrmPartnerSelfView {
  partner: CrmPartnerView | null;
  /** Null khi SuperAdmin chưa đặt. Chưa phải số tiền phải chi. */
  commissionPercent: number | null;
  /** Khoản đã ghi sau thanh toán online. Chỉ chờ đối soát. */
  commissions: CrmCommissionEntryView[];
}

export interface CrmCommissionView {
  percent: number | null;
  canEdit: boolean;
}

export interface UpdateCrmCommissionRequest {
  percent: number;
}

export type CrmCommissionEntryStatus = 'pending_reconcile';

export interface CrmCommissionEntryView {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  companyId: string;
  companyName: string;
  billingOrderId: string;
  orderKind: CrmPlanKind;
  planCode: string | null;
  planName: string | null;
  paidAmountVnd: string;
  percent: number;
  commissionVnd: string;
  status: CrmCommissionEntryStatus;
  paidAt: string;
  /** Số hóa đơn của đơn đã thanh toán. Null khi chưa ghi. Không phải lệnh chi. */
  invoiceNumber: string | null;
}

export interface CrmCommissionLedgerView {
  entries: CrmCommissionEntryView[];
  pendingTotalVnd: string;
}

export interface CreateCrmPartnerRequest {
  name: string;
  phone: string;
}

export interface RegisterCrmPartnerRequest {
  phone: string;
}

export interface CaptureCrmReferralRequest {
  code: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  taxCode?: string | null;
  /** Bẫy bot. Người dùng để trống. */
  website?: string | null;
}

export interface CaptureCrmReferralResponse {
  ok: true;
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

/** Đơn gói đã thanh toán và số hóa đơn đã xuất, nếu có. Giá là số đã trả, chưa VAT. */
export interface CrmPaidOrderInvoiceView {
  billingOrderId: string;
  companyId: string;
  companyName: string;
  orderKind: CrmPlanKind;
  planCode: string | null;
  planName: string | null;
  paidAmountVnd: string;
  paidAt: string;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
}

export interface CrmPaidInvoiceLedgerView {
  orders: CrmPaidOrderInvoiceView[];
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
