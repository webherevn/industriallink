import type { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/** Cột bật: vẫn gửi email. Nút «Đã nhận việc» bật thì cột này tắt và không gửi email gợi ý, kết nối. */
export async function candidateAcceptsOutreachEmail(
  prisma: PrismaService,
  userId: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT outreach_email_enabled AS ok
    FROM candidate.candidate
    WHERE user_id = CAST(${userId} AS uuid) AND is_deleted = false
    LIMIT 1
  `;
  if (rows.length === 0) return true;
  return rows[0].ok !== false;
}
