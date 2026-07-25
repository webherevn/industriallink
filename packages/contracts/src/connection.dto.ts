import type { ConnectionStatus } from './enums';
import type { CandidateView } from './candidate.dto';

export interface ConnectionView {
  id: string;
  status: ConnectionStatus;
  companyId: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  requestedAt: string;
  respondedAt: string | null;
  message: string | null;
}

/** Hồ sơ ứng viên khi NTD xem — liên hệ bị ẩn cho đến khi Accepted. */
export interface RecruiterCandidateView extends CandidateView {
  contactUnlocked: boolean;
  /** Email thật chỉ khi đã kết nối; ngược lại null. */
  email: string | null;
  /** SĐT thật chỉ khi đã kết nối; ngược lại null (profile.phone cũng bị xoá). */
  phone: string | null;
  phoneMasked: string | null;
  emailMasked: string | null;
  connection: ConnectionView | null;
  isShortlisted: boolean;
}

export interface CreateConnectionRequest {
  message?: string;
}
