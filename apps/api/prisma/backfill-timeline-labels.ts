import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script một lần: dịch lại các dòng lịch sử (application_timeline) đã lưu
 * trước khi sửa lỗi hiển thị mã trạng thái tiếng Anh (ví dụ "applied → screening").
 * Không đổi logic tạo timeline mới — chỉ backfill dữ liệu cũ đã có trong DB.
 */

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  applied: 'Đã nộp',
  screening: 'Sàng lọc',
  interview: 'Phỏng vấn',
  offer: 'Đề nghị',
  hired: 'Trúng tuyển',
  rejected: 'Từ chối',
  withdrawn: 'Đã rút',
};

const OFFER_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ phản hồi',
  accepted: 'Đã chấp nhận',
  declined: 'Đã từ chối',
  withdrawn: 'Đã rút',
  expired: 'Hết hạn',
};

const ONBOARDING_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ nhận việc',
  in_progress: 'Đang nhận việc',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

const APPLICATION_STATUS_RE = /^Chuyển trạng thái: ([a-z_]+) → ([a-z_]+)$/;
const OFFER_STATUS_RE = /^Cập nhật offer → ([a-z_]+)$/;
const ONBOARDING_STATUS_RE = /^Cập nhật onboarding → ([a-z_]+)$/;

function translateTitle(title: string): string | null {
  const appMatch = title.match(APPLICATION_STATUS_RE);
  if (appMatch) {
    const [, from, to] = appMatch;
    if (APPLICATION_STATUS_LABEL[from] && APPLICATION_STATUS_LABEL[to]) {
      return `Chuyển trạng thái: ${APPLICATION_STATUS_LABEL[from]} → ${APPLICATION_STATUS_LABEL[to]}`;
    }
  }

  const offerMatch = title.match(OFFER_STATUS_RE);
  if (offerMatch) {
    const [, status] = offerMatch;
    if (OFFER_STATUS_LABEL[status]) {
      return `Cập nhật đề nghị làm việc → ${OFFER_STATUS_LABEL[status]}`;
    }
  }

  const onboardingMatch = title.match(ONBOARDING_STATUS_RE);
  if (onboardingMatch) {
    const [, status] = onboardingMatch;
    if (ONBOARDING_STATUS_LABEL[status]) {
      return `Cập nhật nhận việc → ${ONBOARDING_STATUS_LABEL[status]}`;
    }
  }

  return null;
}

async function main(): Promise<void> {
  const rows = await prisma.applicationTimeline.findMany({
    where: {
      type: { in: ['status_changed', 'offer_updated', 'onboarding_updated'] },
    },
    select: { id: true, title: true },
  });

  let updated = 0;
  for (const row of rows) {
    const newTitle = translateTitle(row.title);
    if (newTitle && newTitle !== row.title) {
      await prisma.applicationTimeline.update({
        where: { id: row.id },
        data: { title: newTitle },
      });
      updated += 1;
    }
  }

  console.log(`Đã kiểm tra ${rows.length} dòng lịch sử, dịch lại ${updated} dòng.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
