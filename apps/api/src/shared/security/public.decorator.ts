import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Endpoint đọc được không cần đăng nhập (Googlebot / SSR). JWT vẫn được đọc nếu có. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
