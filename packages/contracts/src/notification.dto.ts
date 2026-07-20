/** Thông báo in-app nhìn từ phía người nhận. */
export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Kết quả danh sách thông báo kèm số chưa đọc. */
export interface NotificationListResponse {
  items: NotificationView[];
  unreadCount: number;
}
