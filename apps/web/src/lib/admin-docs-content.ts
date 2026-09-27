import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Code2,
  FileText,
  FolderTree,
  Gauge,
  Home,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  Link2,
  Menu,
  PanelBottom,
  ScanSearch,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Nội dung trang /admin/docs. Mô tả hành vi THỰC TẾ của code — khi đổi logic
 * ở API/web, cập nhật lại mục tương ứng ở đây.
 */

export type DocTone = 'slate' | 'blue' | 'amber' | 'green' | 'red' | 'navy';

export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'steps'; title?: string; items: { title: string; text: string; actor?: string }[] }
  | {
      type: 'statuses';
      title?: string;
      items: { label: string; tone: DocTone; code?: string; text: string }[];
    }
  | { type: 'callout'; tone: 'info' | 'warn' | 'tip'; title?: string; text: string }
  | { type: 'table'; title?: string; head: string[]; rows: string[][] };

export type DocSection = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  summary: string;
  href?: string;
  superAdminOnly?: boolean;
  keywords?: string[];
  blocks: DocBlock[];
};

export type DocGroup = {
  id: string;
  title: string;
  description: string;
  /** Chuỗi bước tổng quát hiển thị dạng pill → pill. */
  flow?: string[];
  sections: DocSection[];
};

export const ADMIN_DOC_GROUPS: DocGroup[] = [
  // ───────────────────────────── Vai trò ─────────────────────────────
  {
    id: 'nen-tang',
    title: 'Nền tảng & phân quyền',
    description: 'Ai được vào admin, mỗi vai trò làm được gì, và phiên đăng nhập hoạt động ra sao.',
    sections: [
      {
        id: 'vai-tro',
        title: 'Vai trò & quyền truy cập',
        icon: KeyRound,
        summary: 'Hệ thống có 6 vai trò. Chỉ Superadmin và Biên tập viên vào được khu admin.',
        keywords: ['role', 'editor', 'superadmin', 'phân quyền', 'biên tập viên'],
        blocks: [
          {
            type: 'statuses',
            title: 'Các vai trò',
            items: [
              { label: 'Superadmin', tone: 'navy', code: 'super_admin', text: 'Toàn quyền: CMS, SEO, cấu hình, người dùng, công ty, tin tuyển dụng, kiểm duyệt, AI, nhật ký, báo cáo.' },
              { label: 'Biên tập viên', tone: 'blue', code: 'editor', text: 'Chỉ làm nội dung & SEO: bài viết, trang, danh mục, media, redirect, SEO trang chủ, xem báo cáo SEO, quét PageSpeed, hồ sơ tác giả của chính mình.' },
              { label: 'Nhà tuyển dụng', tone: 'slate', code: 'recruiter', text: 'Đăng ký tự do. Tạo/tham gia công ty, đăng tin, quản lý ứng viên. Không vào được admin.' },
              { label: 'Hiring manager / Company admin', tone: 'slate', code: 'hiring_manager · company_admin', text: 'Chỉ Superadmin gán được. Quyền giống Nhà tuyển dụng — quyền trong công ty do vai trò thành viên (owner/admin/member) quyết định, không phải vai trò hệ thống này.' },
              { label: 'Ứng viên', tone: 'slate', code: 'candidate', text: 'Đăng ký tự do. Hồ sơ, CV, ứng tuyển, việc làm phù hợp.' },
            ],
          },
          {
            type: 'list',
            title: 'Cơ chế chặn quyền',
            items: [
              'Menu admin tự ẩn các mục chỉ dành cho Superadmin khi Biên tập viên đăng nhập.',
              'Quyền thực sự được kiểm ở API: gọi endpoint không đủ quyền sẽ trả 403, kể cả khi gõ thẳng URL.',
              'Tài khoản không phải Superadmin/Biên tập viên đăng nhập ở host admin sẽ bị từ chối và đẩy về trang công khai.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Phiên đăng nhập',
            text: 'Access token sống 15 phút, refresh token 14 ngày. Đổi vai trò có hiệu lực ở lần làm mới token kế tiếp (≤ 15 phút). Khoá tài khoản có hiệu lực cả với phiên đang mở: mọi refresh token bị thu hồi ngay, và access token còn hạn cũng bị từ chối trong tối đa ~30 giây.',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Công ty ─────────────────────────────
  {
    id: 'cong-ty',
    title: 'Công ty & xác minh nhà tuyển dụng',
    description: 'Vòng đời công ty, trạng thái vận hành, huy hiệu xác minh và điểm tín nhiệm.',
    flow: ['NTD tạo công ty', 'Hoạt động ngay', 'Gửi đơn xác minh', 'Superadmin xét', 'Gắn huy hiệu'],
    sections: [
      {
        id: 'cong-ty-vong-doi',
        title: 'Công ty hoạt động thế nào',
        icon: Building2,
        href: '/admin/companies',
        superAdminOnly: true,
        summary: 'Công ty được tạo bởi nhà tuyển dụng và hoạt động ngay, không cần Superadmin duyệt trước.',
        keywords: ['company', 'tạo công ty', 'thành viên', 'owner', 'member', 'mời'],
        blocks: [
          {
            type: 'steps',
            title: 'Tạo & tham gia công ty',
            items: [
              { actor: 'Nhà tuyển dụng', title: 'Tạo hồ sơ công ty', text: 'Ở trang /company, NTD chưa thuộc công ty nào điền tên (≥ 2 ký tự), MST, ngành, quy mô, địa chỉ, website. Hệ thống sinh mã COM…, slug /cong-ty/{slug} (trùng tên thì thêm -1, -2).' },
              { actor: 'Hệ thống', title: 'Kích hoạt ngay', text: 'Công ty nhận trạng thái «Hoạt động» và điểm tín nhiệm 50. Người tạo là chủ sở hữu (owner). Ghi nhật ký company.create.' },
              { actor: 'Owner / Admin công ty', title: 'Thêm thành viên', text: 'Nhập email của người đã có tài khoản → thêm thẳng vào công ty với vai trò admin hoặc member (không có email mời / bước chấp nhận). Mỗi người chỉ thuộc một công ty.' },
              { actor: 'Thành viên', title: 'Làm việc chung', text: 'Mọi thành viên đều quản lý được TẤT CẢ tin và ứng viên của công ty. Chỉ owner/admin sửa hồ sơ, logo, thành viên và gửi đơn xác minh.' },
            ],
          },
          {
            type: 'table',
            title: 'Quyền trong công ty',
            head: ['Việc', 'Owner', 'Admin', 'Member'],
            rows: [
              ['Sửa hồ sơ, logo', 'Có', 'Có', 'Không'],
              ['Gửi đơn xác minh', 'Có', 'Có', 'Không'],
              ['Thêm / gỡ thành viên', 'Có', 'Có (không gỡ được owner & chính mình)', 'Không'],
              ['Đăng tin, quản lý ứng viên', 'Có', 'Có', 'Có'],
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Điều kiện để được đăng tin',
            text: 'Chỉ cần: tài khoản vai trò nhà tuyển dụng + thuộc một công ty + công ty ở trạng thái «Hoạt động». Xác minh, huy hiệu hay điểm tín nhiệm KHÔNG ảnh hưởng quyền đăng tin. Công ty bị treo/cấm vẫn lưu được bản nháp nhưng không gửi đăng được.',
          },
          {
            type: 'list',
            title: 'Chưa có trong hệ thống',
            items: [
              'Tự rời công ty, chuyển quyền owner, đổi vai trò thành viên.',
              'Superadmin sửa thông tin (tên, MST…) hoặc xoá công ty từ admin.',
              'Kiểm tra MST với cơ quan thuế — MST chỉ là văn bản tự khai.',
            ],
          },
        ],
      },
      {
        id: 'cong-ty-trang-thai',
        title: 'Trạng thái công ty & tác động lên tin',
        icon: Building2,
        href: '/admin/companies',
        superAdminOnly: true,
        summary: 'Superadmin đổi trạng thái ở danh sách hoặc trang chi tiết công ty. Tác động lên tin xảy ra ngay trong thao tác.',
        keywords: ['treo', 'cấm', 'suspended', 'banned', 'active', 'kích hoạt'],
        blocks: [
          {
            type: 'statuses',
            items: [
              { label: 'Hoạt động', tone: 'green', code: 'active', text: 'Bình thường: đăng tin được, tin hiện ở /viec-lam và trang công ty.' },
              { label: 'Đang treo', tone: 'amber', code: 'suspended', text: 'Mọi tin đang tuyển chuyển sang «Tạm dừng» và gửi URL_DELETED cho Google. Không gửi đăng tin mới được.' },
              { label: 'Đã cấm', tone: 'red', code: 'banned', text: 'Mọi tin đang tuyển chuyển sang «Đã đóng» và gửi URL_DELETED. Không gửi đăng tin mới được.' },
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Kích hoạt lại không tự mở tin cũ',
            text: 'Đưa công ty về «Hoạt động» không làm tin đã tạm dừng/đóng hiện lại. Mở lại từng tin ở Tin tuyển dụng (nút Hiện) hoặc để NTD tự mở. Lưu ý: treo → cấm chỉ đóng tin đang tuyển, tin đã tạm dừng giữ nguyên.',
          },
          {
            type: 'list',
            title: 'Khi công ty không còn «Hoạt động»',
            items: [
              'Tin của công ty biến khỏi danh sách /viec-lam, sitemap và báo cáo SEO.',
              'Trang /cong-ty/{slug} vẫn truy cập được nhưng ẩn toàn bộ tin đang mở; không có banner báo treo/cấm.',
              'Tài khoản thành viên KHÔNG bị khoá — muốn chặn người dùng, khoá ở mục Người dùng.',
              'Không có email/thông báo gửi cho công ty; mọi thay đổi được ghi nhật ký company.admin.update.',
            ],
          },
        ],
      },
      {
        id: 'xac-minh',
        title: 'Xác minh nhà tuyển dụng (huy hiệu)',
        icon: BadgeCheck,
        href: '/admin/verification',
        superAdminOnly: true,
        summary: 'Xác minh chỉ quyết định 2 huy hiệu trên trang công ty công khai — không ảnh hưởng quyền đăng tin hay kiểm duyệt.',
        keywords: ['verification', 'verified', 'trusted', 'uy tín', 'đã xác thực', 'huy hiệu', 'đơn'],
        blocks: [
          {
            type: 'steps',
            title: 'Luồng xét duyệt',
            items: [
              { actor: 'Owner / Admin công ty', title: 'Gửi đơn', text: 'Ở thẻ «Xác minh nhà tuyển dụng» trên /company: viết ghi chú 10–2000 ký tự (MST, website, người liên hệ…) và chọn xin huy hiệu «Đã xác thực» và/hoặc «Nhà tuyển dụng uy tín». Không có upload giấy phép — chỉ có ghi chú.' },
              { actor: 'Hệ thống', title: 'Vào hàng chờ', text: 'Đơn lưu ở trạng thái «Đang chờ». Mỗi công ty chỉ có 1 đơn chờ; đơn mới ghi đè đơn cũ (lịch sử chỉ còn trong Nhật ký). Huy hiệu đã có thì không xin lại.' },
              { actor: 'Superadmin', title: 'Xét đơn', text: 'Ở Xác minh NTD (tab Đang chờ): đọc ghi chú, tick huy hiệu muốn cấp, ghi chú phản hồi, bấm Duyệt hoặc Từ chối.' },
              { actor: 'Hệ thống', title: 'Áp kết quả', text: 'Duyệt: gắn huy hiệu theo đúng ô đã tick. Từ chối: giữ nguyên huy hiệu. Công ty thấy kết quả + ghi chú phản hồi trên trang /company. Bị từ chối có thể gửi lại ngay.' },
            ],
          },
          {
            type: 'statuses',
            title: 'Trạng thái đơn',
            items: [
              { label: 'Chưa gửi', tone: 'slate', code: 'none', text: 'Công ty chưa từng gửi đơn.' },
              { label: 'Đang chờ', tone: 'amber', code: 'pending', text: 'Chờ Superadmin xét.' },
              { label: 'Đã duyệt', tone: 'green', code: 'approved', text: 'Đã cấp huy hiệu theo các ô được tick khi duyệt.' },
              { label: 'Từ chối', tone: 'red', code: 'rejected', text: 'Không đổi huy hiệu. Công ty xem được lý do (ghi chú phản hồi).' },
            ],
          },
          {
            type: 'statuses',
            title: 'Hai huy hiệu',
            items: [
              { label: 'Đã xác thực', tone: 'blue', code: 'verified', text: 'Dấu tick cạnh tên + nhãn «Doanh nghiệp đã xác thực» trên trang /cong-ty.' },
              { label: 'Nhà tuyển dụng uy tín', tone: 'green', code: 'trustedEmployer', text: 'Nhãn «Nhà tuyển dụng uy tín» trên trang /cong-ty.' },
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Cẩn thận khi bấm Duyệt',
            text: 'Hệ thống lấy đúng trạng thái 2 ô tick lúc duyệt. Bỏ tick một huy hiệu công ty ĐANG có rồi bấm Duyệt sẽ gỡ huy hiệu đó. Superadmin cũng có thể bật/tắt huy hiệu trực tiếp ở trang chi tiết công ty mà không cần đơn.',
          },
          {
            type: 'list',
            title: 'Hiện trạng',
            items: [
              'Huy hiệu chỉ hiện trên trang công ty công khai và trong admin — chưa hiện trên thẻ tin / trang chi tiết tin.',
              'Không có bước «yêu cầu bổ sung», không gửi email/thông báo, không hết hạn tự động.',
            ],
          },
        ],
      },
      {
        id: 'diem-tin-nhiem',
        title: 'Điểm tín nhiệm (trust score)',
        icon: ShieldCheck,
        href: '/admin/companies',
        superAdminOnly: true,
        summary: 'Thang 0–100, mặc định 50. Tự thay đổi theo kết quả kiểm duyệt tin; Superadmin có thể đặt tay.',
        keywords: ['trust', 'tín nhiệm', 'điểm'],
        blocks: [
          {
            type: 'table',
            head: ['Sự kiện', 'Thay đổi'],
            rows: [
              ['AI tự duyệt một tin (approved_auto)', '+1'],
              ['Superadmin duyệt tay một tin', '+1'],
              ['Superadmin chọn «Khoá TK» khi duyệt tin', '−10'],
              ['Tin bị từ chối (bộ lọc, AI hoặc tay)', 'Không đổi'],
              ['Superadmin sửa ở trang chi tiết công ty', 'Đặt giá trị bất kỳ 0–100'],
            ],
          },
          {
            type: 'p',
            text: 'Màu hiển thị: ≥ 70 xanh, 40–69 cam, < 40 đỏ. Danh sách công ty sắp xếp điểm thấp lên đầu để ưu tiên rà soát.',
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'Hiện điểm tín nhiệm chỉ để hiển thị và sắp xếp trong admin — chưa dùng để tự duyệt tin, xếp hạng công khai hay cấp huy hiệu. Chưa có tính năng ứng viên báo cáo tin.',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Tin tuyển dụng ─────────────────────────────
  {
    id: 'tin-tuyen-dung',
    title: 'Tin tuyển dụng & kiểm duyệt',
    description: 'Mọi tin «Đăng» đều đi qua hàng đợi kiểm duyệt 2 lớp trước khi công khai.',
    flow: ['NTD bấm Đăng tin', 'Hàng đợi', 'Lớp 1: bộ lọc tĩnh', 'Lớp 2: AI', 'Tự duyệt / Duyệt tay / Chặn', 'Công khai'],
    sections: [
      {
        id: 'tin-hai-trang-thai',
        title: 'Hai loại trạng thái của một tin',
        icon: Briefcase,
        href: '/admin/jobs',
        superAdminOnly: true,
        summary: 'Mỗi tin có trạng thái đăng (status) và trạng thái kiểm duyệt (moderation) — hai trường độc lập.',
        keywords: ['status', 'draft', 'published', 'paused', 'closed', 'moderation', 'pending'],
        blocks: [
          {
            type: 'statuses',
            title: 'Trạng thái đăng (status)',
            items: [
              { label: 'Nháp', tone: 'slate', code: 'draft', text: 'Chưa công khai. Tin mới tạo và tin đang/đã bị kiểm duyệt từ chối đều ở đây.' },
              { label: 'Đang tuyển', tone: 'green', code: 'published', text: 'Công khai trên /viec-lam (nếu công ty Hoạt động), nhận ứng tuyển. Chỉ vào được trạng thái này qua kiểm duyệt hoặc Superadmin.' },
              { label: 'Tạm dừng', tone: 'amber', code: 'paused', text: 'Ẩn khỏi danh sách, không nhận hồ sơ. NTD tự dừng, Superadmin «Ẩn», hoặc công ty bị treo.' },
              { label: 'Đã đóng', tone: 'red', code: 'closed', text: 'Kết thúc. NTD đóng/xoá, Superadmin «Đóng», «Khoá TK», công ty bị cấm, hoặc cron tự đóng khi quá hạn nộp.' },
            ],
          },
          {
            type: 'statuses',
            title: 'Trạng thái kiểm duyệt (moderation)',
            items: [
              { label: 'Chưa gửi', tone: 'slate', code: 'draft', text: 'Tin lưu nháp, chưa bấm Đăng.' },
              { label: 'Đang kiểm duyệt', tone: 'amber', code: 'pending', text: 'Đang trong hàng đợi, thường xử lý xong sau vài giây.' },
              { label: 'AI đã duyệt', tone: 'green', code: 'approved_auto', text: 'AI đánh giá an toàn → tin tự chuyển Đang tuyển.' },
              { label: 'Chờ duyệt tay', tone: 'amber', code: 'needs_manual_review', text: 'AI nghi ngờ, hoặc AI lỗi/không phản hồi → chờ Superadmin quyết định. Tin vẫn là Nháp.' },
              { label: 'AI đã chặn', tone: 'red', code: 'rejected_auto', text: 'Bộ lọc tĩnh hoặc AI chặn. Tin về Nháp.' },
              { label: 'Duyệt tay', tone: 'green', code: 'approved_manual', text: 'Superadmin duyệt → tin Đang tuyển.' },
              { label: 'Từ chối tay', tone: 'red', code: 'rejected_manual', text: 'Superadmin từ chối (hoặc Khoá TK).' },
            ],
          },
          {
            type: 'table',
            title: 'NTD nhìn thấy gì ở trang Tin tuyển dụng',
            head: ['Nhãn', 'Điều kiện'],
            rows: [
              ['Đang kiểm duyệt', 'Nháp + pending — trang tự làm mới mỗi 3 giây tới khi có kết quả'],
              ['Chờ Admin duyệt', 'Nháp + needs_manual_review'],
              ['Bị từ chối', 'Nháp + rejected_auto / rejected_manual (lý do chưa hiện cho NTD)'],
              ['Nháp / Đang tuyển / Tạm dừng / Đã đóng', 'Theo trạng thái đăng'],
            ],
          },
        ],
      },
      {
        id: 'kiem-duyet-pipeline',
        title: 'Cơ chế kiểm duyệt tự động',
        icon: Workflow,
        href: '/admin/moderation',
        superAdminOnly: true,
        summary: 'Hàng đợi BullMQ + worker xử lý tuần tự: bộ lọc từ khoá trước, AI sau. NTD nhận email khi tin được duyệt hoặc bị từ chối.',
        keywords: ['moderation', 'kiểm duyệt', 'gemini', 'bộ lọc', 'risk', 'worker', 'hàng đợi', 'queue'],
        blocks: [
          {
            type: 'steps',
            items: [
              { actor: 'Nhà tuyển dụng', title: 'Bấm «Đăng tin»', text: 'Tin được lưu ở trạng thái Nháp + moderation «pending», đẩy vào hàng đợi job-moderation. Điều kiện: công ty đang Hoạt động. Hạn nộp mặc định +30 ngày nếu NTD không nhập.' },
              { actor: 'Worker', title: 'Lớp 1 — Bộ lọc tĩnh (không dùng AI)', text: 'Bỏ dấu, chữ thường rồi dò ~90 từ khoá cấm (đa cấp, đặt cọc/thu phí, việc nhẹ lương cao, forex/cờ bạc, phỏng vấn qua Telegram/Zalo…) và mô tả < 100 ký tự → CHẶN ngay (risk 100, AI đã chặn). Link/handle Telegram/Zalo chỉ gắn cờ «Cần xoá link» rồi chuyển tiếp cho AI.' },
              { actor: 'Worker', title: 'Lớp 2 — AI', text: 'Gọi AI (nhà cung cấp ở Cấu hình AI) chấm risk 0–100, có phải tin B2B không, lý do và đề xuất PUBLISH / MANUAL_REVIEW / REJECT. Kết quả quyết định theo ĐỀ XUẤT của AI; chỉ khi AI không trả đề xuất hợp lệ mới dùng ngưỡng risk ≥ 70 chặn, ≥ 40 duyệt tay, còn lại duyệt.' },
              { actor: 'Hệ thống', title: 'Áp kết quả', text: 'PUBLISH → Đang tuyển, +1 tín nhiệm, tạo embedding cho matching, báo Google Indexing (URL_UPDATED). MANUAL_REVIEW → chờ Superadmin. REJECT → về Nháp.' },
            ],
          },
          {
            type: 'table',
            title: 'Thông số vận hành',
            head: ['Thông số', 'Giá trị'],
            rows: [
              ['Tốc độ worker', '1 tin mỗi lượt, tối đa 10 tin/phút (an toàn hạn mức Gemini free 15 RPM)'],
              ['AI lỗi / quá tải', 'Gemini thử lại 3 lần rồi đổi sang model dự phòng; vẫn lỗi → «Chờ duyệt tay» (không bao giờ tự đăng khi AI lỗi)'],
              ['Khởi động lại API', 'Tự đẩy lại mọi tin còn «Đang kiểm duyệt» vào hàng đợi (tối đa 500)'],
              ['Xử lý trùng', 'Worker chỉ xử lý tin còn pending → gửi trùng không gây duyệt 2 lần'],
              ['Không có nhà cung cấp AI / thiếu khoá', 'Dùng bộ chấm mô phỏng (mock) theo từ khoá — nên cấu hình khoá thật ở Cấu hình AI'],
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Sửa tin đang tuyển → kiểm duyệt lại',
            text: 'NTD sửa một tin đang công khai thì tin được gỡ khỏi trang công khai (về Nháp + «pending») và đi lại toàn bộ hàng đợi kiểm duyệt. Chỉ khi được duyệt, nội dung mới mới hiển thị, cập nhật embedding và báo Google.',
          },
          {
            type: 'list',
            title: 'Hiện trạng cần biết',
            items: [
              'Tự đóng tin hết hạn: cron chạy mỗi giờ (phút thứ 5, giờ Việt Nam) chuyển tin Đang tuyển đã qua ngày hạn nộp sang «Đã đóng» và báo Google xoá URL. Ngày hạn nộp vẫn được nhận hồ sơ.',
              'Email kết quả cho người đăng tin: được duyệt (tự động hoặc tay, kèm link tin), bị từ chối (AI, bộ lọc hoặc Superadmin, kèm lý do), bị khoá do vi phạm. Không gửi email khi tin chuyển sang «Chờ duyệt tay».',
              'Điểm risk và lý do AI không trả ra API công khai; chỉ Superadmin và thành viên công ty đăng tin mới xem được.',
              'Worker không ghi Nhật ký; chỉ thao tác tay của Superadmin mới được ghi.',
            ],
          },
        ],
      },
      {
        id: 'duyet-tin-tay',
        title: 'Duyệt tin tuyển dụng (duyệt tay)',
        icon: ShieldCheck,
        href: '/admin/moderation',
        superAdminOnly: true,
        summary: 'Nơi Superadmin xử lý các tin AI nghi ngờ và rà soát tin AI đã chặn/duyệt.',
        keywords: ['duyệt tay', 'manual', 'khoá tài khoản', 'ban', 'từ chối'],
        blocks: [
          {
            type: 'table',
            title: 'Các tab',
            head: ['Tab', 'Nội dung'],
            rows: [
              ['Cần duyệt tay', 'Tin needs_manual_review — việc chính cần xử lý hằng ngày'],
              ['Đang trong hàng đợi', 'Tin pending chưa được worker xử lý'],
              ['AI đã chặn', 'Tin rejected_auto — rà soát để cứu tin bị chặn nhầm'],
              ['AI đã duyệt', 'Tin approved_auto — hậu kiểm'],
            ],
          },
          {
            type: 'p',
            text: 'Sắp xếp risk cao nhất lên đầu, tự làm mới 20 giây/lần. Mỗi thẻ hiện điểm risk (≥ 70 Nguy hiểm, ≥ 40 Cần soát, < 40 An toàn), cờ «Không giống B2B», điểm tín nhiệm công ty, email người đăng, lý do của AI và mô tả tin.',
          },
          {
            type: 'statuses',
            title: 'Ba quyết định',
            items: [
              { label: 'Duyệt', tone: 'green', code: 'approve', text: 'Tin → Đang tuyển (duyệt tay), +1 tín nhiệm, tạo embedding, báo Google. Dùng được ở tab Cần duyệt tay và AI đã chặn.' },
              { label: 'Từ chối', tone: 'amber', code: 'reject', text: 'Tin → Nháp (từ chối tay). NTD có thể sửa và gửi lại.' },
              { label: 'Khoá TK', tone: 'red', code: 'ban_user', text: 'Tin → Đã đóng, KHOÁ tài khoản người đăng (đăng xuất mọi phiên đang mở), −10 tín nhiệm công ty. Dùng cho lừa đảo rõ ràng.' },
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'Mọi quyết định được ghi Nhật ký (job.moderation.approve / reject / ban_user). Giao diện hiện chưa có ô nhập ghi chú lý do.',
          },
        ],
      },
      {
        id: 'quan-ly-tin',
        title: 'Tin tuyển dụng (bảng điều khiển toàn sàn)',
        icon: Briefcase,
        href: '/admin/jobs',
        superAdminOnly: true,
        summary: 'Xem mọi tin của mọi công ty, lọc theo trạng thái, kiểm duyệt, công ty; can thiệp khi cần.',
        keywords: ['ẩn', 'hiện', 'đóng', 'đẩy duyệt', 'requeue', 'hide', 'unhide'],
        blocks: [
          {
            type: 'statuses',
            title: 'Thao tác',
            items: [
              { label: 'Ẩn', tone: 'amber', code: 'hide', text: 'Tin → Tạm dừng, gửi URL_DELETED nếu đang công khai.' },
              { label: 'Hiện', tone: 'green', code: 'unhide', text: 'Chỉ cho tin Tạm dừng đã từng được duyệt → Đang tuyển lại (tạo embedding, báo Google).' },
              { label: 'Đóng', tone: 'red', code: 'close', text: 'Tin → Đã đóng, gửi URL_DELETED nếu đang công khai.' },
              { label: 'Đẩy duyệt', tone: 'blue', code: 'requeue', text: 'Tin → Nháp + Đang kiểm duyệt, đưa lại vào hàng đợi (gỡ khỏi Google nếu đang công khai). Dùng khi nghi ngờ tin đã sửa hoặc cần AI chấm lại.' },
            ],
          },
          {
            type: 'p',
            text: 'Tự làm mới 30 giây/lần, 50 tin/trang, mới nhất lên đầu. Không có nút Xoá hay Đăng thẳng — muốn đăng hãy duyệt qua mục Duyệt tin. Mọi thao tác ghi Nhật ký job.admin.<thao tác>.',
          },
          {
            type: 'list',
            title: 'Khi nào tin xuất hiện công khai',
            items: [
              'Danh sách /viec-lam: tin Đang tuyển, chưa xoá, công ty chưa xoá và đang Hoạt động (không xét hạn nộp).',
              'Trang chi tiết tin mở được bằng URL với mọi tin chưa xoá; tin không Đang tuyển bị noindex, hiện «chưa mở nhận hồ sơ» và không cho ứng tuyển.',
              'Lưu tin & ứng tuyển chỉ cho tin Đang tuyển.',
            ],
          },
        ],
      },
      {
        id: 'matching',
        title: 'Matching ứng viên ↔ tin',
        icon: Target,
        superAdminOnly: true,
        summary: 'Điểm phù hợp tính bằng engine quy tắc cố định (Sales B2B / Kỹ thuật) — không gọi AI lúc chấm.',
        keywords: ['matching', 'phù hợp', 'engine', 'sales', 'kỹ thuật', 'embedding'],
        blocks: [
          {
            type: 'steps',
            items: [
              { actor: 'Hệ thống', title: 'Chọn engine', text: 'Cấp bậc tin bắt đầu bằng technical.* → engine Kỹ thuật (19 tiêu chí); sales.* → engine Sales B2B (16 tiêu chí). Tin không có cấp chuẩn dùng công thức B2B cũ.' },
              { actor: 'Hệ thống', title: 'Gom ứng viên', text: 'NTD bấm Tìm ứng viên: lấy tối đa 80 người (đã nộp vào tin + gần nghĩa theo embedding + hồ sơ mới cập nhật), chấm từng người, trả top 20.' },
              { actor: 'Hệ thống', title: 'Chấm điểm', text: 'Điểm = phần kinh nghiệm công ty (Sales 83% / Kỹ thuật 70%) + phần hồ sơ chung. Chỉ tính các tiêu chí JD có điền; ngành chiếm trọng số lớn nhất. Tiêu chí «lọc cứng» trượt → loại.' },
            ],
          },
          {
            type: 'callout',
            tone: 'tip',
            title: 'JD càng đủ tiêu chí, điểm càng chính xác',
            text: 'Tin chỉ có tiêu đề + ngành sẽ cho điểm gần như chỉ dựa trên ngành. Khuyến khích NTD điền đủ 22 trường (sản phẩm, tệp khách hàng, khu vực…) khi đăng.',
          },
        ],
      },
      {
        id: 'cau-hinh-ai',
        title: 'Cấu hình AI',
        icon: Sparkles,
        href: '/admin/ai-settings',
        superAdminOnly: true,
        summary: 'Chọn một nhà cung cấp AI dùng chung cho toàn hệ thống và lưu khoá API (mã hoá).',
        keywords: ['ai', 'gemini', 'openai', 'anthropic', 'mock', 'api key', 'khoá'],
        blocks: [
          {
            type: 'list',
            title: 'Tính năng dùng AI chính',
            items: [
              'Kiểm duyệt tin (Lớp 2).',
              'Đọc JD từ văn bản/file và «AI điền 22 trường», AI viết JD.',
              'Đọc CV ứng viên.',
              'Embedding cho tin, ứng viên, tìm kiếm & matching.',
              'Copilot chat.',
            ],
          },
          {
            type: 'list',
            title: 'Cơ chế',
            items: [
              'Một nhà cung cấp dùng chung: Gemini, OpenAI, Anthropic hoặc mock. Mỗi nhà cung cấp chọn model chat/embedding riêng.',
              'Khoá API mã hoá AES-256-GCM trong database, giao diện chỉ hiện 4 ký tự cuối. Để trống = giữ khoá cũ. Giá trị trong DB ưu tiên hơn biến môi trường.',
              'Lưu xong có hiệu lực ngay, không cần khởi động lại.',
              'Nút «Test kết nối» chạy thử kiểm duyệt một tin mẫu.',
              'Khoá «Gemini SEO» là khoá riêng, chỉ dùng cho trợ lý SEO khi viết bài (AI Overviews).',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Thiếu khoá = âm thầm dùng mock',
            text: 'Nếu nhà cung cấp đã chọn không có khoá hợp lệ, hệ thống tự dùng bộ mô phỏng (có cảnh báo màu cam). Khi đó kiểm duyệt, đọc JD/CV kém chính xác. Ước lượng lương và tư vấn nghề nghiệp luôn chạy theo quy tắc, không gọi AI.',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Vận hành ─────────────────────────────
  {
    id: 'van-hanh',
    title: 'Người dùng, nhật ký & số liệu',
    description: 'Quản lý tài khoản, truy vết thao tác và theo dõi số liệu vận hành.',
    sections: [
      {
        id: 'nguoi-dung',
        title: 'Người dùng',
        icon: Users,
        href: '/admin/users',
        superAdminOnly: true,
        summary: 'Tạo tài khoản, đổi vai trò, khoá/mở, đặt lại mật khẩu.',
        keywords: ['user', 'khoá', 'mật khẩu', 'mfa', 'vai trò'],
        blocks: [
          {
            type: 'list',
            items: [
              'Tạo tài khoản: email, mật khẩu ≥ 8 ký tự, tên, vai trò — tài khoản kích hoạt & xác minh sẵn.',
              'Đổi vai trò / trạng thái có hiệu lực ngay khi chọn trong dropdown (không hỏi lại).',
              'Không thể hạ quyền hoặc khoá Superadmin đang hoạt động cuối cùng; Superadmin không tự hạ quyền mình.',
              'MFA do người dùng tự bật ở /account (OTP email hoặc ứng dụng TOTP); admin chỉ thấy nhãn MFA, không ép/đặt lại được.',
              'Không có nút xoá người dùng.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            text: 'Khoá tài khoản đăng xuất luôn các phiên đang mở (refresh token bị thu hồi, access token bị từ chối trong tối đa ~30 giây). Thao tác quản lý người dùng hiện chưa ghi Nhật ký.',
          },
        ],
      },
      {
        id: 'nhat-ky',
        title: 'Nhật ký (audit log)',
        icon: ScrollText,
        href: '/admin/audit',
        superAdminOnly: true,
        summary: 'Truy vết ai làm gì, lúc nào, dữ liệu trước/sau thay đổi.',
        keywords: ['audit', 'nhật ký', 'log'],
        blocks: [
          {
            type: 'list',
            title: 'Được ghi',
            items: [
              'Tin tuyển dụng: tạo/sửa, thao tác Superadmin, quyết định duyệt tay.',
              'Công ty: tạo, sửa, thành viên, đơn xác minh, quyết định xác minh, Superadmin đổi trạng thái/tín nhiệm/huy hiệu.',
              'Tuyển dụng: ứng tuyển, phỏng vấn, offer, onboarding.',
              'Bảo mật: đăng ký, OTP, MFA.',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'Chưa ghi: CMS, cấu hình SEO, redirect, media, quản lý người dùng và đăng nhập thường. Lọc theo loại dùng khớp chính xác; tìm kiếm tự do theo thao tác, ID, email người làm.',
          },
        ],
      },
      {
        id: 'bao-cao',
        title: 'Báo cáo nền tảng',
        icon: BarChart3,
        href: '/admin/reports',
        superAdminOnly: true,
        summary: 'Ảnh chụp KPI trực tiếp, tự làm mới mỗi 60 giây.',
        keywords: ['report', 'kpi', 'báo cáo'],
        blocks: [
          {
            type: 'list',
            items: [
              'Hàng đợi kiểm duyệt: đang chờ + cần duyệt tay.',
              'Tỷ lệ duyệt/từ chối tự động và thủ công.',
              'Công ty theo trạng thái; tổng người dùng và số bị khoá.',
              'Tin đang tuyển, đăng hôm nay, 7 ngày và biểu đồ 14 ngày (giờ Việt Nam).',
            ],
          },
        ],
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        icon: LayoutDashboard,
        href: '/admin',
        summary: 'Trang đầu admin: điểm SEO, tiến độ nội dung, việc cần chú ý.',
        keywords: ['dashboard', 'tổng quan'],
        blocks: [
          {
            type: 'p',
            text: 'Tính trực tiếp mỗi lần mở (không cache): vòng SEO Health, số bài Live/Nháp/Lưu trữ, lối tắt tạo bài/trang, kho nội dung, 5 vấn đề SEO nặng nhất và các bài vừa đăng.',
          },
        ],
      },
      {
        id: 'analytics',
        title: 'Analytics',
        icon: Activity,
        href: '/admin/analytics',
        superAdminOnly: true,
        summary: 'Đo lượt truy cập nội bộ, không dùng Google Analytics.',
        keywords: ['analytics', 'lượt xem', 'realtime', 'phiên', 'visitor'],
        blocks: [
          {
            type: 'list',
            title: 'Cơ chế thu thập',
            items: [
              'Mỗi trang công khai gửi một «beacon» về máy chủ (không chạy ở /admin). Bỏ qua bot, prefetch, và lượt lặp cùng phiên + cùng trang trong 15 giây.',
              'Khách truy cập nhận diện bằng localStorage; phiên tính theo từng tab trình duyệt, hết hạn sau 30 phút không hoạt động.',
              'Nguồn truy cập: utm_source → domain giới thiệu → «Trực tiếp».',
            ],
          },
          {
            type: 'list',
            title: 'Số liệu',
            items: [
              'Hôm nay / 7 / 30 ngày so với kỳ trước: khách, phiên, lượt xem, tỷ lệ thoát, tương tác (≥ 2 trang hoặc ≥ 10 giây), thời lượng, khách mới/quay lại.',
              'Realtime: khách trong 5 phút gần nhất, cập nhật 5 giây/lần.',
              'Danh sách phiên với IP, trình duyệt và hành trình trang.',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            text: 'Dữ liệu lượt xem giữ 180 ngày, mẫu Web Vitals giữ 90 ngày (dọn tự động 03:00 hằng ngày). IP được lưu và hiển thị — lưu ý khi chia sẻ màn hình.',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── SEO ─────────────────────────────
  {
    id: 'seo',
    title: 'SEO & hiển thị trên Google',
    description: 'Các báo cáo SEO tính trực tiếp từ database; thao tác gửi Google chỉ Superadmin.',
    sections: [
      {
        id: 'seo-overview',
        title: 'SEO overview & điểm SEO Health',
        icon: Search,
        href: '/admin/seo',
        summary: 'Điểm 0–100 đo độ đầy đủ tín hiệu SEO của bài viết, trang, danh mục và tác giả.',
        keywords: ['health', 'điểm seo', 'meta', 'title'],
        blocks: [
          {
            type: 'table',
            title: 'Cách tính',
            head: ['Tín hiệu (tỉ lệ nội dung có)', 'Trọng số'],
            rows: [
              ['SEO title', '22%'],
              ['Meta description (excerpt làm dự phòng)', '22%'],
              ['Indexable', '18%'],
              ['Focus keyword', '14%'],
              ['Ảnh OG (ảnh bìa làm dự phòng)', '14%'],
              ['Có danh mục (chỉ bài viết)', '10%'],
            ],
          },
          {
            type: 'p',
            text: 'Trừ điểm phạt tối đa 25: 2 điểm cho mỗi nội dung thiếu title/meta + 1 điểm cho mỗi nội dung đã đăng nhưng noindex. Xếp loại: ≥ 85 Rất tốt, ≥ 70 Tốt, ≥ 50 Cần cải thiện, thấp hơn là Yếu.',
          },
          {
            type: 'list',
            title: 'Nhóm vấn đề',
            items: [
              'Nghiêm trọng: thiếu SEO title, thiếu meta description.',
              'Cảnh báo: thiếu focus keyword, thiếu ảnh OG, đã đăng nhưng noindex, bài không danh mục, nội dung mỏng (< 300 từ).',
              'Thông tin: danh mục thiếu SEO, hồ sơ tác giả chưa đủ, trùng focus keyword.',
            ],
          },
        ],
      },
      {
        id: 'crawl-index',
        title: 'Crawl & index · Google Indexing API',
        icon: ScanSearch,
        href: '/admin/seo/crawl',
        summary: 'Theo dõi hạn mức Indexing API, sitemap, trang mồ côi, chuỗi redirect; cấu hình tự gửi URL tin tuyển dụng cho Google.',
        keywords: ['indexing', 'google', 'sitemap', 'quota', 'service account', 'mồ côi'],
        blocks: [
          {
            type: 'steps',
            title: 'Kết nối Google Indexing (Superadmin)',
            items: [
              { title: 'Dán khoá service account', text: 'Dán nội dung file JSON của service account → hệ thống kiểm tra định dạng và lưu mã hoá. Khoá trong admin ưu tiên hơn biến môi trường.' },
              { title: 'Thêm làm Owner trong Search Console', text: 'Email service account phải là Owner của inlink.vn, và Indexing API phải được bật trong Google Cloud.' },
              { title: 'Kiểm tra kết nối', text: 'Hệ thống lấy token và đọc thử trạng thái trang chủ: 404/200 là OK, 403 nghĩa là chưa phải Owner hoặc API chưa bật.' },
            ],
          },
          {
            type: 'list',
            title: 'Tự động gửi',
            items: [
              'Tin được duyệt / sửa khi đang công khai → URL_UPDATED.',
              'Tin tạm dừng, đóng, xoá, bị Superadmin ẩn/đóng, công ty bị treo/cấm → URL_DELETED.',
              'Bài viết/trang đã đăng và cho index khi tạo, sửa, đổi trạng thái, xoá, khôi phục.',
              'Bỏ qua khi chưa có khoá, tắt «Tự gửi», hoặc site đang là localhost.',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Hạn mức 200 URL/ngày',
            text: 'Đếm theo ngày giờ Việt Nam, gồm cả request lỗi và tự động. Gửi thủ công («Gửi tất cả tin» — 200 tin cập nhật gần nhất, hoặc danh sách URL) chỉ gửi trong phần hạn mức còn lại, 4 URL song song, dừng khi gặp 429. Google chính thức hỗ trợ Indexing API cho trang JobPosting.',
          },
          {
            type: 'callout',
            tone: 'warn',
            text: 'Bài hẹn giờ khi tới giờ đăng không được tự gửi Google (không có cron). Sitemap health đếm từ database, không đọc file XML.',
          },
        ],
      },
      {
        id: 'eeat',
        title: 'E-E-A-T & schema',
        icon: BadgeCheck,
        href: '/admin/seo/trust',
        summary: 'Chấm độ tin cậy hồ sơ tác giả (100 điểm) và kiểm tra schema JobPosting của tin đang tuyển.',
        keywords: ['eeat', 'schema', 'jobposting', 'tác giả'],
        blocks: [
          {
            type: 'table',
            title: 'Điểm tác giả',
            head: ['Tiêu chí', 'Điểm'],
            rows: [
              ['Bio ≥ 80 ký tự', '18'],
              ['LinkedIn', '16'],
              ['Trang tác giả công khai', '12'],
              ['Chức danh / worksFor / có bài đã đăng', '10 mỗi mục'],
              ['Tên hiển thị / ảnh đại diện / sameAs khác', '8 mỗi mục'],
            ],
          },
          {
            type: 'list',
            title: 'Schema JobPosting',
            items: [
              'Nghiêm trọng: thiếu tiêu đề, mô tả < 80 ký tự, đã quá hạn nộp.',
              'Cảnh báo: không có hạn nộp (tự đặt validThrough +30 ngày), thiếu lương, thiếu địa điểm, thiếu hình thức làm việc.',
            ],
          },
        ],
      },
      {
        id: 'link-noi-bo',
        title: 'Link nội bộ',
        icon: Link2,
        href: '/admin/seo/links',
        summary: 'Tìm link hỏng trong nội dung và đường dẫn khách truy cập bị 404; tạo 301 một chạm.',
        keywords: ['broken', 'link hỏng', '404', 'redirect'],
        blocks: [
          {
            type: 'list',
            items: [
              'Link hỏng: link nội bộ trong nội dung đã đăng trỏ tới đường dẫn không tồn tại (không tải HTTP, so với database).',
              'Đường dẫn lạ: trang khách đã mở trong 14 ngày qua mà không tồn tại (lấy từ Analytics).',
              'Mỗi dòng gợi ý trang cha và có nút tạo redirect 301.',
              'Trong trình soạn bài: gợi ý 5 bài/danh mục liên quan để chèn link.',
            ],
          },
        ],
      },
      {
        id: 'ai-overviews',
        title: 'AI Overviews',
        icon: Sparkles,
        href: '/admin/seo/semantic',
        summary: 'Đánh giá nội dung có đủ «chất» cho AI Overviews: tỉ lệ chữ/HTML và độ phủ thực thể.',
        keywords: ['semantic', 'entity', 'thực thể', 'gemini seo'],
        blocks: [
          {
            type: 'list',
            items: [
              'Gắn cờ: nội dung mỏng (< 200 ký tự chữ), tỉ lệ chữ/HTML thấp, ít thực thể.',
              'Tải trực tiếp tối đa 40 trang danh mục từ site thật → báo cáo chậm và lỗi nếu site không truy cập được.',
              'Trợ lý trong trình soạn bài dùng khoá «Gemini SEO» (Cấu hình AI): gợi ý thực thể, checklist B2B, FAQ. Cần ≥ 80 ký tự nội dung.',
            ],
          },
        ],
      },
      {
        id: 'core-web-vitals',
        title: 'Core Web Vitals',
        icon: Gauge,
        href: '/admin/seo/vitals',
        summary: 'Đo tốc độ trang theo 3 nguồn: dữ liệu thật của Google (CrUX), người dùng thật trên site (RUM) và Lighthouse (lab).',
        keywords: ['cwv', 'lcp', 'inp', 'cls', 'pagespeed', 'crux', 'rum'],
        blocks: [
          {
            type: 'statuses',
            title: 'Nguồn số liệu (ưu tiên từ trên xuống)',
            items: [
              { label: 'CrUX', tone: 'green', text: 'Dữ liệu người dùng Chrome thật 28 ngày từ Google — đáng tin nhất, chỉ có khi trang đủ lưu lượng.' },
              { label: 'RUM', tone: 'blue', text: 'Beacon đo LCP/INP/CLS/FCP/TTFB từ khách truy cập inlink (p75, 28 ngày). Chỉ tin cậy khi ≥ 5 mẫu.' },
              { label: 'Lab', tone: 'slate', text: 'Lighthouse mô phỏng qua PageSpeed Insights khi bấm quét — dùng khi chưa có dữ liệu thật.' },
            ],
          },
          {
            type: 'list',
            title: 'Cảnh báo & quét',
            items: [
              'Cảnh báo INP > 200 ms chỉ khi số liệu tin cậy (CrUX hoặc RUM ≥ 5 mẫu); «Nguy cơ INP» khi chỉ có lab TBT > 200 ms. LCP chậm khi > 2,5 s.',
              'Quét: trang chủ, trang hub, 10 danh mục, 15 bài, 8 trang (tối đa 40) hoặc 1 URL tuỳ chọn; tự quét mobile 02:30 hằng ngày nếu bật.',
              'Khoá PageSpeed chỉ Superadmin nhập ở giao diện (mã hoá); Biên tập viên xem báo cáo và bấm quét được.',
            ],
          },
        ],
      },
      {
        id: 'seo-trang-chu',
        title: 'SEO trang chủ',
        icon: Home,
        href: '/admin/homepage',
        summary: 'H1, tiêu đề, mô tả, canonical, OG, robots và JSON-LD tuỳ chỉnh của trang chủ.',
        keywords: ['homepage', 'trang chủ', 'h1', 'json-ld'],
        blocks: [
          {
            type: 'p',
            text: 'Lưu một bản ghi duy nhất; chưa có thì dùng mặc định dựng sẵn. Cụm từ tô màu phải nằm trong H1. Site công khai cache 60 giây nên thay đổi có thể trễ tới 1 phút. Biên tập viên cũng sửa được mục này.',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── CMS ─────────────────────────────
  {
    id: 'cms',
    title: 'Nội dung (CMS)',
    description: 'Cẩm nang, trang tĩnh, tác giả và thư viện ảnh.',
    sections: [
      {
        id: 'bai-viet-trang',
        title: 'Bài viết & Trang',
        icon: FileText,
        href: '/admin/posts',
        summary: 'Bài viết ở /cam-nang/{slug}, trang tĩnh ở /trang/{slug}; dùng chung trình soạn thảo.',
        keywords: ['post', 'page', 'bài viết', 'hẹn giờ', 'thùng rác', 'nháp'],
        blocks: [
          {
            type: 'statuses',
            title: 'Trạng thái',
            items: [
              { label: 'Nháp', tone: 'slate', code: 'draft', text: 'Chưa công khai.' },
              { label: 'Đã đăng', tone: 'green', code: 'published', text: 'Công khai ngay khi ngày đăng ≤ hiện tại.' },
              { label: 'Hẹn giờ', tone: 'blue', text: 'Là «Đã đăng» với ngày đăng trong tương lai — tự hiện khi tới giờ (kiểm tra lúc có người truy cập, không có cron).' },
              { label: 'Thùng rác', tone: 'red', text: 'Xoá mềm, khôi phục được; không xoá vĩnh viễn, không tự dọn.' },
            ],
          },
          {
            type: 'list',
            title: 'Khi lưu',
            items: [
              'HTML được làm sạch: giữ đoạn, H2–H4, danh sách, link, ảnh, trích dẫn, code; bỏ H1, H5–H6, bảng, div, script, iframe.',
              'Đổi slug → tự tạo redirect 301 từ URL cũ.',
              'Tác giả là người tạo bài, không đổi được; tên/chức danh lấy từ hồ sơ tác giả.',
              'Xem trước (/admin/preview) hiển thị bản ĐÃ LƯU, không phải nội dung đang gõ.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            text: 'Bấm «Lưu nháp» trên bài đang đăng sẽ gỡ bài khỏi site và báo Google xoá URL. Chưa có lịch sử phiên bản; danh sách admin hiện 100 nội dung cập nhật gần nhất. Mọi link trong bài đều được gắn nofollow.',
          },
        ],
      },
      {
        id: 'danh-muc',
        title: 'Danh mục',
        icon: FolderTree,
        href: '/admin/categories',
        summary: 'Nhóm bài cẩm nang ở /cam-nang/{slug}, có mô tả, SEO/OG, robots và tối đa 30 FAQ.',
        keywords: ['category', 'danh mục', 'faq'],
        blocks: [
          {
            type: 'callout',
            tone: 'warn',
            text: 'Đổi slug danh mục KHÔNG tự tạo 301 (khác bài viết). Danh mục và bài viết dùng chung /cam-nang/{slug} — danh mục được ưu tiên, nên bài trùng slug với danh mục sẽ không truy cập được. Xoá danh mục là xoá mềm, bài bên trong không bị gỡ danh mục.',
          },
        ],
      },
      {
        id: 'tac-gia',
        title: 'Tác giả',
        icon: UserRound,
        href: '/admin/author',
        summary: 'Hồ sơ tác giả cho E-E-A-T, trang công khai /tac-gia/{slug}.',
        keywords: ['author', 'tác giả'],
        blocks: [
          {
            type: 'list',
            items: [
              'Superadmin: xem mọi hồ sơ, gán hồ sơ cho tài khoản chưa có, sửa mọi hồ sơ.',
              'Biên tập viên: chỉ sửa hồ sơ của mình (tự tạo ở chế độ ẩn lần đầu), có thể bật công khai và đặt slug.',
              'Lưu hồ sơ sẽ cập nhật tên/chức danh/bio trên toàn bộ bài của người đó.',
            ],
          },
        ],
      },
      {
        id: 'media',
        title: 'Thư viện media',
        icon: ImageIcon,
        href: '/admin/media',
        summary: 'Ảnh lưu trên object storage (MinIO/S3), tự chuyển WebP.',
        keywords: ['media', 'ảnh', 'upload', 'webp'],
        blocks: [
          {
            type: 'list',
            items: [
              'Nhận JPEG/PNG/WebP/GIF ≤ 5 MB; tự chuyển WebP chất lượng 80, cạnh dài tối đa 2048 px (GIF động giữ chuyển động).',
              'Phục vụ công khai tại /api/v1/cms/media/{file}, cache 1 ngày. Danh sách hiện 500 ảnh mới nhất.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            text: 'Xoá ảnh là vĩnh viễn và không kiểm tra ảnh có đang được bài nào dùng hay không.',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── Cấu hình ─────────────────────────────
  {
    id: 'cau-hinh',
    title: 'Cấu hình giao diện & kỹ thuật',
    description: 'Menu, chân trang, robots.txt, mã chèn và redirect.',
    sections: [
      {
        id: 'menu',
        title: 'Menu trang chủ',
        icon: Menu,
        href: '/admin/menus',
        superAdminOnly: true,
        summary: 'Menu chính của header công khai, tối đa 40 mục, hỗ trợ 1 cấp con.',
        keywords: ['menu', 'header'],
        blocks: [
          {
            type: 'p',
            text: 'Mục có thể là link tự nhập, trang hoặc bài viết. Lưu là thay toàn bộ menu. Menu trống thì header dùng danh sách mặc định. Vị trí «footer» của menu hiện chưa được hiển thị ở site — chân trang dùng mục Chân trang.',
          },
        ],
      },
      {
        id: 'chan-trang',
        title: 'Chân trang',
        icon: PanelBottom,
        href: '/admin/footer',
        superAdminOnly: true,
        summary: 'Footer 1 và Footer 2, mỗi footer 4 cột nội dung + dòng bản quyền.',
        keywords: ['footer', 'chân trang'],
        blocks: [
          {
            type: 'p',
            text: 'Mỗi footer bật/tắt riêng; cột trống tự ẩn. Nội dung đi qua bộ làm sạch HTML như bài viết (link được gắn nofollow).',
          },
        ],
      },
      {
        id: 'robots',
        title: 'Robots.txt',
        icon: Bot,
        href: '/admin/robots',
        superAdminOnly: true,
        summary: 'Nội dung /robots.txt; «Reset mặc định» trả về bản dựng sẵn có 4 dòng sitemap.',
        keywords: ['robots'],
        blocks: [
          {
            type: 'callout',
            tone: 'warn',
            text: 'Không kiểm tra cú pháp — một dòng «Disallow: /» sai có thể chặn Google khỏi toàn site. CDN cache 60 giây.',
          },
        ],
      },
      {
        id: 'site-code',
        title: 'Header & Footer code',
        icon: Code2,
        href: '/admin/site-code',
        superAdminOnly: true,
        summary: 'Chèn mã theo dõi / xác minh (GA, pixel, meta verify…) vào <head> và cuối <body>.',
        keywords: ['script', 'tracking', 'pixel', 'head'],
        blocks: [
          {
            type: 'list',
            items: [
              'Mỗi khối bật/tắt riêng, tối đa 200 KB, render trên server ở mọi trang công khai (không chạy ở /admin, /recruiter).',
              'Chỉ giữ thẻ <script>, <style>, <meta>, <link>, <noscript>; thẻ khác bị bỏ qua âm thầm.',
              'Mã KHÔNG được làm sạch — chỉ dán mã từ nguồn tin cậy.',
            ],
          },
        ],
      },
      {
        id: 'redirect',
        title: 'Redirect 301',
        icon: Link2,
        href: '/admin/redirects',
        summary: 'Chuyển hướng URL cũ sang URL mới; tự tạo khi đổi slug bài viết/trang.',
        keywords: ['redirect', '301', 'chuyển hướng'],
        blocks: [
          {
            type: 'callout',
            tone: 'warn',
            title: 'Phạm vi áp dụng',
            text: 'Redirect chỉ chạy khi URL dạng /cam-nang/{slug} hoặc /trang/{slug} không còn nội dung. Redirect cho đường dẫn khác được lưu nhưng không có tác dụng. Chỉ hỗ trợ đích nội bộ; cache 30 giây.',
          },
        ],
      },
    ],
  },
];
