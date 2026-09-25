import { UserRole, UserStatus } from './enums';

export interface AdminUserView {
  id: string;
  code: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus | string;
  isVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export interface AdminUpdateUserRequest {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
}
