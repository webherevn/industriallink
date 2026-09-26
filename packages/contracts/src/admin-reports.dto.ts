/** KPI vận hành SuperAdmin (/admin/reports). */
export interface AdminReportsView {
  generatedAt: string;
  /** Hàng đợi kiểm duyệt đang chờ. */
  queue: {
    pending: number;
    needsManualReview: number;
    /** pending + cần duyệt tay. */
    depth: number;
  };
  /** Kết quả kiểm duyệt (không tính nháp / đang chờ). */
  moderation: {
    approvedAuto: number;
    approvedManual: number;
    rejectedAuto: number;
    rejectedManual: number;
    approved: number;
    rejected: number;
    decided: number;
    /** 0–100, null nếu chưa có tin đã quyết. */
    approvalRate: number | null;
    rejectionRate: number | null;
  };
  companies: {
    total: number;
    active: number;
    suspended: number;
    banned: number;
  };
  users: {
    total: number;
    locked: number;
  };
  jobs: {
    /** Đang published lúc này. */
    publishedLive: number;
    publishedToday: number;
    publishedLast7Days: number;
    /** 14 ngày gần nhất (giờ Việt Nam), kể cả ngày 0 tin. */
    byDay: Array<{ date: string; count: number }>;
  };
}
