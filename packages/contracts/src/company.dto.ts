import { CompanyRole, CompanySize } from './enums';

export interface CreateCompanyRequest {
  name: string;
  taxCode?: string;
  industry?: string;
  size?: CompanySize;
  address?: string;
  website?: string;
  description?: string;
}

export type UpdateCompanyRequest = CreateCompanyRequest;

export interface CompanyView {
  id: string;
  code: string;
  name: string;
  taxCode: string | null;
  industry: string | null;
  size: CompanySize | string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  status: string;
  memberCount: number;
  /** Quyền của người dùng hiện tại trong công ty này. */
  myRole: CompanyRole;
  /** Đã có logo tải lên (stream qua GET /companies/me/logo hoặc /companies/:id/logo). */
  hasLogo: boolean;
}

export interface UploadCompanyLogoResponse {
  hasLogo: boolean;
  message: string;
}

/** Ảnh văn hóa công ty. */
export interface CompanyCultureItem {
  url: string;
  title: string;
  caption?: string;
}

export interface CompanyAwardItem {
  name: string;
  imageUrl?: string;
}

export interface CompanyReviewItem {
  name: string;
  role: string;
  rating: number;
  comment: string;
  postedAt: string;
  avatarUrl?: string;
}

export interface CompanyStats {
  yearsActive?: number | null;
  employees?: number | null;
  customers?: number | null;
  projects?: number | null;
  locations?: number | null;
}

/** Dữ liệu thương hiệu lưu trong Company.profile (JSON). */
export interface CompanyBrandProfile {
  logoUrl?: string | null;
  bannerUrl?: string | null;
  bannerCaption?: string | null;
  internationalName?: string | null;
  email?: string | null;
  phone?: string | null;
  foundedYear?: number | null;
  verified?: boolean;
  trustedEmployer?: boolean;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  coreActivities?: string[];
  whyChooseUs?: string[];
  benefits?: string[];
  stats?: CompanyStats;
  cultureGallery?: CompanyCultureItem[];
  awards?: CompanyAwardItem[];
  reviews?: CompanyReviewItem[];
  ratingAvg?: number | null;
  ratingCount?: number | null;
}

/** Tin tuyển dụng rút gọn trên trang công ty. */
export interface CompanyJobCard {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  publishedAt: string | null;
  isNew: boolean;
}

/** Hồ sơ công khai đầy đủ (ứng viên / NTD xem trang công ty). */
export interface CompanyPublicProfileView extends CompanyView {
  brand: CompanyBrandProfile;
  openJobs: CompanyJobCard[];
  openJobCount: number;
  /** true nếu user hiện tại là owner/admin của công ty này. */
  canEdit: boolean;
}

export interface CompanyMemberView {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  roleInCompany: CompanyRole;
  createdAt: string;
}

export interface InviteCompanyMemberRequest {
  email: string;
  roleInCompany: CompanyRole.Admin | CompanyRole.Member;
}

/** Nhãn quy mô hiển thị. */
export function formatCompanySize(size: string | null | undefined): string {
  if (!size) return 'Chưa cập nhật';
  switch (size) {
    case CompanySize.Micro:
      return 'Dưới 10 nhân viên';
    case CompanySize.Small:
      return '10 – 50 nhân viên';
    case CompanySize.Medium:
      return '50 – 200 nhân viên';
    case CompanySize.Large:
      return '200 – 500 nhân viên';
    case CompanySize.Enterprise:
      return 'Trên 1.000 nhân viên';
    default:
      return size.includes('nhân viên') ? size : `Quy mô: ${size}`;
  }
}
