import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@industriallink/contracts';

export const ROLES_KEY = 'roles';

/** Giới hạn endpoint theo vai trò. Ví dụ: @Roles(UserRole.Recruiter) */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
