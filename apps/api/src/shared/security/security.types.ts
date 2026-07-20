import type { UserRole } from '@industriallink/contracts';

/** Payload ký trong JWT access token. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  displayName: string;
  status: string;
}

/** Thông tin người dùng đã xác thực, gắn vào request. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  displayName: string;
  status: string;
}
