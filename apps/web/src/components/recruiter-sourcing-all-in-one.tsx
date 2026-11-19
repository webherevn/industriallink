/**
 * Barrel export giữ nguyên API công khai của `recruiter-sourcing-all-in-one`.
 *
 * Lịch sử: file gốc `recruiter-sourcing-all-in-one.tsx` gộp 3 component lớn
 * (~3.6k dòng) vào một chỗ. Đã tách thành 3 file chuyên biệt để dễ bảo trì,
 * logic bên trong GIỮ NGUYÊN 100% (chỉ di chuyển vị trí, không sửa nội dung).
 *
 * File này chỉ là lớp giao diện tương thích ngược — import cũ vẫn hoạt động.
 */
export {
  SourcingProgressReportModal,
} from '@/components/sourcing-progress-report-modal';
export {
  SourcingJdRevisionModal,
} from '@/components/sourcing-jd-revision-modal';
export {
  SourcingCandidateDrawer,
  type SourcingDrawerSection,
} from '@/components/sourcing-candidate-drawer';
