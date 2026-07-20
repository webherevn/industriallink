/**
 * Nhóm trường chung mà mọi entity nghiệp vụ đều có (chuẩn Chương 4.4.1).
 * Dùng làm tham chiếu type; ánh xạ DB do Prisma đảm nhiệm.
 */
export interface BaseEntityFields {
  id: string;
  code: string;
  status: string;
  tenantId: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  isDeleted: boolean;
  version: number;
}
