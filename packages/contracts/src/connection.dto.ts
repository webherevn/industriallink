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

export interface ConnectionChatProfileFact {
  label: string;
  value: string;
}

/** Hồ sơ sơ bộ của người đối diện trong chat đã kết nối. */
export interface ConnectionChatProfile {
  /** candidate: đối phương là ứng viên. company: đối phương là nhà tuyển dụng. */
  kind: 'candidate' | 'company';
  /** Trang hồ sơ đầy đủ: /candidates/:id hoặc /cong-ty/:slug. */
  path: string;
  headline: string | null;
  summary: string | null;
  facts: ConnectionChatProfileFact[];
  tags: string[];
  /** Id công ty khi đã có logo công khai. */
  logoCompanyId: string | null;
}

export interface ConnectionChatThread {
  connectionId: string;
  peerName: string;
  peerHint: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
  profile: ConnectionChatProfile;
}

export interface ConnectionChatMessage {
  id: string;
  connectionId: string;
  body: string;
  mine: boolean;
  createdAt: string;
}

export interface SendConnectionMessageRequest {
  body: string;
}
