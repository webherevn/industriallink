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
  address: string | null;
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
  /** Ngày hẹn gọi lại. Null khi chưa hẹn. */
  nextFollowUpAt: string | null;
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
  lostReason: string | null;
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
  /** Số hóa đơn của đơn gắn với dòng thanh toán. Null khi chưa ghi hoặc không phải dòng thanh toán. */
  invoiceNumber: string | null;
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
  /** Đơn gói đã trả trong kỳ đang chạy. Null khi kỳ này chưa thấy đơn. Không đổi hạn gói. */
  cyclePaidAt: string | null;
  /** Credit còn của công ty. Không cộng thêm từ CRM. */
  creditBalance: number;
  /** Tin đang đăng. 0 nghĩa là đã trả gói nhưng chưa tuyển trên inlink. */
  openJobCount: number;
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
  address?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  industry?: string | null;
  companyId?: string | null;
  source: Exclude<CrmLeadSource, 'unknown'>;
  /** Bắt buộc khi source là partner. */
  partnerId?: string | null;
}

export interface UpdateCrmLeadRequest {
  companyName: string;
  taxCode?: string | null;
  address?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  industry?: string | null;
  source: Exclude<CrmLeadSource, 'unknown'>;
  partnerId?: string | null;
  /** Chỉ SuperAdmin đổi. Sale gửi khác chủ hiện tại thì bị từ chối. */
  ownerUserId?: string | null;
  /** Null để bỏ hẹn. Bỏ qua field này thì giữ ngày cũ. */
  nextFollowUpAt?: string | null;
}

export interface CrmOwnerOption {
  id: string;
  name: string;
}

/** Công ty đã thanh toán gói trên web và chưa có lead. */
export interface CrmUnclaimedCustomerView {
  companyId: string;
  companyName: string;
  taxCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lastPaidAt: string;
  lastPlanName: string | null;
  lastPaidAmountVnd: string;
}

export interface CrmCompanyPlanSnapshot {
  kind: CrmPlanKind;
  code: string;
  name: string;
  endsAt: string | null;
  active: boolean;
}

export interface CrmCompanyProfileView {
  id: string;
  name: string;
  taxCode: string | null;
  industry: string | null;
  platformPlan: CrmCompanyPlanSnapshot | null;
  sourcingPlan: CrmCompanyPlanSnapshot | null;
  creditBalance: number;
  openJobCount: number;
  partnerName: string | null;
  partnerCode: string | null;
  orders: CrmPaidOrderInvoiceView[];
  leads: CrmLeadView[];
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
  /** Tổng chờ đối soát người xem được thấy. Chưa gồm kỳ đã chốt. */
  pendingCommissionVnd: string;
  pendingCount: number;
  /** Số dư ví hoa hồng trên inlink. Kỳ đã chốt vẫn nằm ở đây. */
  walletBalanceVnd: string;
  createdAt: string;
  /** Đăng ký qua mã, chưa thanh toán gói. Không gồm email. */
  signups: CrmReferralSignupView[];
  claims: CrmPartnerClaimView[];
}

export interface CrmReferralSignupView {
  id: string;
  partnerId: string;
  companyName: string;
  registeredAt: string;
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
  /** Ngày trong tháng kế toán ghi đã chi. Không tự trừ ví. */
  payoutDay: number;
  /** Sao kê ví: cộng khi khách trả, trừ khi đã chi, kèm số dư sau dòng. */
  walletTxns: CrmWalletTxnView[];
  /** Khoản đã ghi sau thanh toán online. Chỉ chờ đối soát. */
  commissions: CrmCommissionEntryView[];
}

export type CrmWalletTxnKind = 'credit' | 'debit';

export interface CrmWalletTxnView {
  id: string;
  kind: CrmWalletTxnKind;
  amountVnd: string;
  balanceAfterVnd: string;
  createdAt: string;
  label: string;
}

export interface CrmPayoutDayView {
  day: number;
  canEdit: boolean;
}

export interface UpdateCrmPayoutDayRequest {
  day: number;
}

export interface CrmVatView {
  /** Null khi chưa đặt. Không mặc định 8% hay 10%. */
  percent: number | null;
  canEdit: boolean;
}

export interface UpdateCrmVatRequest {
  percent: number;
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
  /** YYYY-MM khi khoản đã vào kỳ chốt. Null khi còn chờ đối soát. */
  periodMonth: string | null;
  /** Trạng thái kỳ. Null khi khoản chưa chốt. paid nghĩa là ví đã trừ kỳ này. */
  periodStatus: CrmCommissionPeriodStatus | null;
}

export interface CrmCommissionLedgerView {
  entries: CrmCommissionEntryView[];
  pendingTotalVnd: string;
}

export type CrmCommissionPeriodStatus = 'closed' | 'payable' | 'paid';

export interface CrmCommissionPeriodView {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  /** YYYY-MM, giờ Việt Nam. */
  periodMonth: string;
  paidAmountVnd: string;
  commissionVnd: string;
  entryCount: number;
  status: CrmCommissionPeriodStatus;
  closedAt: string;
  /** True khi hệ thống tự chốt sau khi tháng đã kết thúc. */
  autoClosed: boolean;
  /** Có khi kỳ đã được phép chi và chuyển kế toán. */
  approvedAt: string | null;
  /** Có khi kế toán đã ghi chi và ví đã trừ. */
  paidAt: string | null;
}

export interface CrmCommissionPeriodListView {
  periods: CrmCommissionPeriodView[];
  canClose: boolean;
}

export interface CloseCrmCommissionMonthRequest {
  periodMonth: string;
}

export interface CloseCrmCommissionMonthResult extends CrmCommissionPeriodListView {
  closedCount: number;
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
  /** Mức VAT lúc ghi số. Null khi chưa ghi hoặc lúc ghi chưa đặt. Không cộng vào số đã trả. */
  vatPercent: number | null;
}

export interface CrmPaidInvoiceLedgerView {
  orders: CrmPaidOrderInvoiceView[];
}

/** active = gói còn hạn. lapsed = từng có gói hoặc đã trả nhưng hết. prospect = chưa mua. */
export type CrmCustomerStanding = 'active' | 'lapsed' | 'prospect';

export interface CrmCustomerView {
  companyId: string;
  companyName: string;
  taxCode: string | null;
  standing: CrmCustomerStanding;
  platformPlanName: string | null;
  sourcingPlanName: string | null;
  ownerName: string | null;
}

export interface CrmCompanyOption {
  id: string;
  name: string;
  taxCode: string | null;
  address: string | null;
}

/** Gợi ý khi nhập mã số thuế. inlink là công ty đã có. registry là sổ thuế, chưa tạo lead. */
export interface CrmTaxSuggestion {
  taxCode: string;
  companyName: string;
  address: string | null;
  companyId: string | null;
  source: 'inlink' | 'registry';
}

/** Một nhóm trên báo cáo phễu. Tiền là đơn gói đã trả, chưa VAT. */
export interface CrmFunnelBucket {
  key: string;
  label: string;
  leads: number;
  paidOrders: number;
  /** Tổng đơn đã trả trong tháng. Chưa VAT. */
  paidAmountVnd: string;
  platformPaidVnd: string;
  sourcingPaidVnd: string;
}

export interface CrmFunnelReport {
  /** YYYY-MM giờ Việt Nam. */
  periodMonth: string;
  byOwner: CrmFunnelBucket[];
  bySource: CrmFunnelBucket[];
  byPartner: CrmFunnelBucket[];
}

export interface CreateCrmQuoteRequest {
  companyName: string;
  taxCode?: string | null;
  contactName: string;
  leadId?: string | null;
  companyId?: string | null;
  option1Kind: CrmPlanKind;
  option1Code: string;
  option2Kind?: CrmPlanKind | null;
  option2Code?: string | null;
  note?: string | null;
}

/** Tờ chào giá. Giá là niêm yết chưa VAT. Không phải đơn thanh toán. */
export interface CrmQuoteView {
  id: string;
  quoteCode: string;
  companyName: string;
  taxCode: string | null;
  contactName: string;
  companyId: string | null;
  ownerName: string;
  option1Kind: CrmPlanKind;
  option1Code: string;
  option1Name: string;
  option1PriceVnd: string;
  option2Kind: CrmPlanKind | null;
  option2Code: string | null;
  option2Name: string | null;
  option2PriceVnd: string | null;
  note: string | null;
  vatPercent: number | null;
  createdAt: string;
}

/** Kết quả khi nhà tuyển dụng bấm tư vấn Enterprise. Không bật gói. */
export interface CrmEnterpriseRequestView {
  leadCode: string;
  dealCode: string;
  ownerName: string;
  alreadyOpen: boolean;
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
  /** YYYY-MM-DD. Null để bỏ hẹn. Không gửi thì giữ ngày cũ. */
  nextFollowUpAt?: string | null;
}
