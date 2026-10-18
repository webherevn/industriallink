/** CRM: lead, phễu, nhật ký, hóa đơn đã xuất, hoa hồng chờ đối soát. Không gán gói và không lệnh chi. Công nợ chỉ có khi chốt báo giá Enterprise theo đợt. */

export const CRM_LEAD_JOB_TITLES = ['Giám đốc', 'Phó giám đốc', 'HR', 'HCNS', 'Trưởng phòng nhân sự', 'Tuyển dụng', 'Kế toán', 'Hành chính'] as const;
export const CRM_LEAD_ORG_TYPES = ['Công ty TNHH', 'Công ty cổ phần', 'Doanh nghiệp tư nhân', 'Hộ kinh doanh', 'Hợp tác xã', 'Doanh nghiệp nhà nước', 'Công ty hợp danh'] as const;
export const CRM_LEAD_ORG_FIELDS = ['Sản xuất', 'Thương mại', 'Dịch vụ', 'Xây dựng', 'Logistics', 'Nông nghiệp', 'Giáo dục', 'Y tế', 'Công nghệ'] as const;
export const CRM_LEAD_REVENUE_BANDS = ['Dưới 3 tỷ', '3–10 tỷ', '10–50 tỷ', '50–200 tỷ', 'Trên 200 tỷ'] as const;

export type CrmLeadStatus = 'open' | 'converted' | 'unqualified';
/** Mã kênh marketing. unknown chỉ còn trên lead tạo trước khi ghi nguồn. */
export type CrmLeadSource = string;
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
  zalo: string | null;
  jobTitle: string | null;
  department: string | null;
  industry: string | null;
  bankAccount: string | null;
  bankName: string | null;
  /** YYYY-MM-DD. Null khi chưa ghi. */
  foundedOn: string | null;
  orgType: string | null;
  orgField: string | null;
  revenueBand: string | null;
  country: string | null;
  province: string | null;
  ward: string | null;
  street: string | null;
  areaCode: string | null;
  companyId: string | null;
  status: CrmLeadStatus;
  source: CrmLeadSource;
  partnerId: string | null;
  partnerName: string | null;
  partnerCode: string | null;
  campaignId: string | null;
  campaignName: string | null;
  campaignCode: string | null;
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
  /** YYYY-MM-DD. Null khi chưa hẹn. */
  expectedCloseOn: string | null;
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
  contactPhone?: string | null;
  contactEmail?: string | null;
  zalo?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  industry?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  foundedOn?: string | null;
  orgType?: string | null;
  orgField?: string | null;
  revenueBand?: string | null;
  country?: string | null;
  province?: string | null;
  ward?: string | null;
  street?: string | null;
  areaCode?: string | null;
  companyId?: string | null;
  /** Mã kênh đang bật. */
  source: string;
  /** Bắt buộc khi source là partner. */
  partnerId?: string | null;
  /** Chiến dịch marketing. Null khi không gắn. */
  campaignId?: string | null;
}

export interface UpdateCrmLeadRequest {
  companyName: string;
  taxCode?: string | null;
  address?: string | null;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  zalo?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  industry?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  foundedOn?: string | null;
  orgType?: string | null;
  orgField?: string | null;
  revenueBand?: string | null;
  country?: string | null;
  province?: string | null;
  ward?: string | null;
  street?: string | null;
  areaCode?: string | null;
  /** Mã kênh đang bật. Giữ mã cũ nếu kênh đã tắt sau khi ghi. */
  source: string;
  partnerId?: string | null;
  /** Chỉ SuperAdmin đổi. Sale gửi khác chủ hiện tại thì bị từ chối. */
  ownerUserId?: string | null;
  /** Null để bỏ hẹn. Bỏ qua field này thì giữ ngày cũ. */
  nextFollowUpAt?: string | null;
  /** Null để bỏ gắn. Bỏ qua field này thì giữ chiến dịch cũ. */
  campaignId?: string | null;
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
  address: string | null;
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
  /** Lead còn hiệu lực gắn mã này, trong phạm vi người xem. */
  leadCount: number;
  /** Tiền khách đã trả trong tháng đang xem. Gói tin và gói Săn, giá lớn hơn 0, chưa VAT. Không phải hoa hồng. */
  monthPaidVnd: string;
  monthPlatformPaidVnd: string;
  monthSourcingPaidVnd: string;
  monthOrderCount: number;
  monthCompanyCount: number;
  /** Đăng ký qua mã, chưa thanh toán gói. Không gồm email. */
  signups: CrmReferralSignupView[];
  claims: CrmPartnerClaimView[];
}

/** Hồ sơ một cộng tác viên. Doanh số trên partner là tháng periodMonth. */
export interface CrmPartnerProfileView {
  periodMonth: string;
  partner: CrmPartnerView;
  orders: CrmPartnerPaidOrderView[];
}

/** Một đơn đã trả gắn mã cộng tác viên. Số tiền là khách đã trả, không phải hoa hồng. */
export interface CrmPartnerPaidOrderView {
  id: string;
  companyId: string;
  companyName: string;
  orderKind: 'platform' | 'sourcing';
  planName: string;
  paidAmountVnd: string;
  paidAt: string;
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
  /** Bước phễu lúc tạo. Bỏ trống thì vào bước đầu. Không bật gói. */
  stageCode?: string | null;
  /** Bắt buộc khi bước là không chốt. */
  lostReason?: string | null;
  /** YYYY-MM-DD. Bỏ trống khi chưa hẹn. */
  expectedCloseOn?: string | null;
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
  /** Người liên hệ trên lead gắn công ty. Null khi chưa có lead. */
  contactName: string | null;
  department: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** Lĩnh vực trên lead, hoặc ngành của công ty khi lead chưa ghi. */
  orgField: string | null;
  address: string | null;
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

/** Một giai đoạn trên phễu. Giá là niêm yết chưa VAT, không phải tiền đã thu. */
export interface CrmStageMoneyRow {
  code: string;
  label: string;
  deals: number;
  listPriceVnd: string;
}

export interface CrmPipelineReport {
  periodMonth: string;
  stages: CrmStageMoneyRow[];
  /** Cơ hội có ngày kỳ vọng nằm trong tháng. Không cộng vào doanh số. */
  expected: CrmStageMoneyRow[];
}

/** Lead tạo trong tháng. paidCompanies là công ty đã trả gói sau khi lead được tạo. */
export interface CrmLeadSourceRow {
  key: string;
  label: string;
  leads: number;
  companies: number;
  paidCompanies: number;
}

export interface CrmLeadSourceReport {
  periodMonth: string;
  bySource: CrmLeadSourceRow[];
  byOwner: CrmLeadSourceRow[];
}

/** Tờ lập trong tháng. Hai phương án để riêng, không cộng thành một tổng. */
export interface CrmQuoteReportRow {
  status: CrmQuoteStatus;
  label: string;
  quotes: number;
  option1Vnd: string;
  option2Quotes: number;
  option2Vnd: string;
  paidQuotes: number;
}

export interface CrmQuoteReport {
  periodMonth: string;
  rows: CrmQuoteReportRow[];
  enterprise: {
    quotes: number;
    contractVnd: string;
    accepted: number;
    receivableVnd: string;
    collectedVnd: string;
  };
}

export type CrmRenewalReportStatus = 'ending' | 'expired' | 'renewed';

export interface CrmRenewalReportRow {
  companyId: string;
  companyName: string;
  kind: CrmPlanKind;
  planName: string;
  /** ISO. Null khi chỉ thấy đơn gia hạn, chưa đọc được hạn hiện tại. */
  endsAt: string | null;
  status: CrmRenewalReportStatus;
  /** Tiền gói đã trả trong tháng. 0 khi chưa có đơn mới. Không phải hoa hồng. */
  paidAmountVnd: string;
}

export interface CrmRenewalReport {
  periodMonth: string;
  ending: number;
  expired: number;
  renewed: number;
  rows: CrmRenewalReportRow[];
}

/** Đơn đã trả gắn mã giới thiệu. Tiền là khách đã trả, không phải hoa hồng. */
export interface CrmPartnerPaidRow {
  partnerId: string;
  label: string;
  orders: number;
  companies: number;
  platformPaidVnd: string;
  sourcingPaidVnd: string;
  paidAmountVnd: string;
}

export interface CrmPartnerPaidReport {
  periodMonth: string;
  rows: CrmPartnerPaidRow[];
}

export interface CrmWorkspaceMonthPoint {
  /** YYYY-MM. */
  month: string;
  label: string;
  orders: number;
  paidAmountVnd: string;
}

export interface CrmWorkspaceSlice {
  key: string;
  label: string;
  orders: number;
  paidAmountVnd: string;
}

export interface CrmWorkspacePerson {
  key: string;
  label: string;
  leads: number;
  quotes: number;
  deals: number;
  orders: number;
  /** Đơn gói tin và gói Săn đã trả. */
  paidAmountVnd: string;
  /** Đợt Enterprise đã ghi thu trong tháng. */
  enterpriseCollectedVnd: string;
}

/** Bàn làm việc một tháng. Tiền là đơn gói đã trả, chưa VAT. Giá niêm yết không cộng vào doanh số. */
export interface CrmWorkspaceReport {
  periodMonth: string;
  orders: number;
  paidAmountVnd: string;
  platformPaidVnd: string;
  sourcingPaidVnd: string;
  newLeads: number;
  quotes: number;
  openDeals: number;
  openListPriceVnd: string;
  months: CrmWorkspaceMonthPoint[];
  bySource: CrmWorkspaceSlice[];
  plans: CrmWorkspaceSlice[];
  people: CrmWorkspacePerson[];
  /** Xếp theo tiền đã thu trong tháng: đơn gói và đợt Enterprise đã ghi thu. */
  staff: CrmWorkspaceStaff[];
  enterpriseCollectedVnd: string;
  /** Công nợ Enterprise đang mở. Không gồm tờ chưa chốt. */
  receivableVnd: string;
  receivableDueVnd: string;
}

export interface CrmWorkspaceStaff {
  key: string;
  label: string;
  orders: number;
  enterpriseCollectedVnd: string;
  paidAmountVnd: string;
}

export type CrmQuoteStatus = 'draft' | 'sent' | 'accepted';
export type CrmQuoteKind = 'catalog' | 'enterprise';
export type CrmInstallmentStatus = 'scheduled' | 'open' | 'collected';

export interface CrmQuoteInstallmentInput {
  label: string;
  /** Số nguyên 1–99. Các đợt cộng đủ 100. */
  percent: number;
  /** YYYY-MM-DD. */
  dueOn: string;
}

export interface CrmQuoteInstallmentView {
  id: string;
  label: string;
  percent: number;
  amountVnd: string;
  dueOn: string;
  status: CrmInstallmentStatus;
  collectedAt: string | null;
}

export interface CreateCrmQuoteRequest {
  companyName: string;
  taxCode?: string | null;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  /** YYYY-MM-DD. */
  quotedOn: string;
  /** YYYY-MM-DD. Null khi chưa hẹn hạn. */
  validUntil?: string | null;
  status?: CrmQuoteStatus;
  leadId?: string | null;
  companyId?: string | null;
  /** Cơ hội đang bán. Null khi không gắn. Không đổi bước. */
  dealId?: string | null;
  /** catalog là gói niêm yết. enterprise là hợp đồng theo đợt, không lấy giá SuperAdmin. */
  quoteKind?: CrmQuoteKind;
  packageName?: string | null;
  /** Giá trị hợp đồng Enterprise, số nguyên VND, chưa VAT. */
  contractVnd?: string | null;
  installments?: CrmQuoteInstallmentInput[] | null;
  option1Kind?: CrmPlanKind;
  option1Code?: string;
  option2Kind?: CrmPlanKind | null;
  option2Code?: string | null;
  note?: string | null;
}

export interface CrmReceivableRow {
  id: string;
  quoteId: string;
  quoteCode: string;
  companyName: string;
  ownerName: string;
  label: string;
  percent: number;
  amountVnd: string;
  dueOn: string;
}

export interface CrmReceivableLedger {
  receivableVnd: string;
  rows: CrmReceivableRow[];
}

/** Tờ chào giá. Giá catalog là niêm yết chưa VAT. Enterprise là giá trị hợp đồng. Không phải đơn thanh toán. */
export interface CrmQuoteView {
  id: string;
  quoteCode: string;
  companyName: string;
  taxCode: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  /** YYYY-MM-DD. */
  quotedOn: string;
  validUntil: string | null;
  status: CrmQuoteStatus;
  companyId: string | null;
  dealId: string | null;
  dealTitle: string | null;
  dealCode: string | null;
  ownerUserId: string;
  ownerName: string;
  quoteKind: CrmQuoteKind;
  installments: CrmQuoteInstallmentView[];
  receivableVnd: string;
  collectedVnd: string;
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

/** Phần cố định trên mọi tờ. Không chứa giá gói và không chứa các đợt. */
export interface CrmQuoteFormView {
  legalName: string | null;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  transferNote: string | null;
  terms: string | null;
  signerTitle: string | null;
  hasLogo: boolean;
  canEdit: boolean;
}

export type CrmStaffGender = 'male' | 'female' | 'other';

/** Hồ sơ cá nhân của một nhân sự inlink. */
export interface CrmStaffProfileView {
  userId: string;
  code: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  department: string | null;
  /** YYYY-MM-DD. */
  birthDate: string | null;
  gender: CrmStaffGender | null;
  phone: string | null;
  address: string | null;
  province: string | null;
  postalCode: string | null;
  hasAvatar: boolean;
  canEdit: boolean;
}

export interface CrmStaffOption {
  id: string;
  name: string;
  code: string;
}

export interface CrmStaffProfilePage {
  profile: CrmStaffProfileView | null;
  /** SuperAdmin chọn người để sửa. Nhân sự không nhận danh sách này. */
  staff: CrmStaffOption[] | null;
}

export interface UpdateCrmStaffProfileRequest {
  userId?: string | null;
  displayName: string;
  birthDate?: string | null;
  gender?: CrmStaffGender | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

/** Một dòng trong bảng nhân sự CRM. Cùng bản ghi với Người dùng ở Admin. */
export interface CrmStaffAccountView {
  id: string;
  code: string;
  email: string;
  displayName: string;
  role: 'sales' | 'sales_manager';
  department: string | null;
  status: string;
}

export interface CrmStaffDirectory {
  rows: CrmStaffAccountView[];
  /** SuperAdmin sửa và xóa. Trưởng phòng chỉ xem. */
  canEdit: boolean;
  /** SuperAdmin thêm cả hai vai trò. Trưởng phòng chỉ thêm nhân viên kinh doanh. */
  canAdd: boolean;
}

export interface CreateCrmStaffAccountRequest {
  email: string;
  password: string;
  displayName: string;
  department?: string | null;
  /** SuperAdmin chọn. Trưởng phòng bỏ trống và luôn tạo nhân viên kinh doanh. */
  role?: 'sales' | 'sales_manager';
}

export interface UpdateCrmStaffAccountRequest {
  displayName?: string;
  role?: 'sales' | 'sales_manager';
  status?: string;
  password?: string;
  department?: string | null;
}

export interface UpdateCrmQuoteFormRequest {
  legalName?: string | null;
  taxCode?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankHolder?: string | null;
  transferNote?: string | null;
  terms?: string | null;
  signerTitle?: string | null;
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

export type CrmMarketingChannelGroup = 'owned' | 'social';
export type CrmCampaignStatus = 'draft' | 'active' | 'ended' | 'cancelled';

export interface CrmMarketingChannelView {
  id: string;
  code: string;
  name: string;
  group: CrmMarketingChannelGroup;
  isActive: boolean;
  sortOrder: number;
}

export interface CrmCampaignView {
  id: string;
  campaignCode: string;
  name: string;
  channelId: string;
  channelName: string;
  channelGroup: CrmMarketingChannelGroup;
  status: CrmCampaignStatus;
  startsOn: string | null;
  endsOn: string | null;
  /** Ngân sách dự chi. Null khi chưa đặt. */
  budgetVnd: string | null;
  /** Đã chi, không gồm hoa hồng. */
  spentVnd: string;
  ownerUserId: string;
  ownerName: string;
  note: string | null;
  createdAt: string;
}

export interface CrmMarketingCostView {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  channelId: string;
  channelName: string;
  spentOn: string;
  amountVnd: string;
  note: string | null;
  createdAt: string;
}

export interface CrmMarketingOverview {
  /** SuperAdmin đặt ngân sách và ghi chi phí. */
  canManageSpend: boolean;
  budgetVnd: string;
  spentVnd: string;
  activeCount: number;
  campaignCount: number;
  channels: CrmMarketingChannelView[];
  campaigns: CrmCampaignView[];
  costs: CrmMarketingCostView[];
}

export interface CreateCrmMarketingChannelRequest {
  name: string;
  group: CrmMarketingChannelGroup;
}

export interface UpdateCrmMarketingChannelRequest {
  isActive: boolean;
}

export interface CreateCrmCampaignRequest {
  name: string;
  channelId: string;
  status?: CrmCampaignStatus;
  startsOn?: string | null;
  endsOn?: string | null;
  /** Chỉ SuperAdmin. Sale gửi số khác thì bị từ chối. */
  budgetVnd?: string | null;
  note?: string | null;
  ownerUserId?: string | null;
}

export interface UpdateCrmCampaignRequest extends CreateCrmCampaignRequest {
  status: CrmCampaignStatus;
}

export interface CreateCrmMarketingCostRequest {
  campaignId: string;
  channelId?: string | null;
  spentOn: string;
  amountVnd: string;
  note?: string | null;
}

export interface CreateCrmActivityRequest {
  leadId?: string | null;
  dealId?: string | null;
  activityType: Exclude<CrmActivityType, 'stage'>;
  summary: string;
  /** YYYY-MM-DD. Null để bỏ hẹn. Không gửi thì giữ ngày cũ. */
  nextFollowUpAt?: string | null;
}
