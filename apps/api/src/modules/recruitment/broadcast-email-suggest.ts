import { ApplicationStatus } from '@industriallink/contracts';

export const BROADCAST_EMAIL_PURPOSES = ['progress', 'screening', 'interview', 'keep'] as const;
export type BroadcastEmailPurpose = (typeof BROADCAST_EMAIL_PURPOSES)[number];

const PURPOSE_LABEL: Record<BroadcastEmailPurpose, string> = {
  progress: 'Cập nhật tiến độ tuyển dụng',
  screening: 'Thông báo sau bước sàng lọc hồ sơ',
  interview: 'Nhắc chuẩn bị phỏng vấn, không hẹn giờ cụ thể',
  keep: 'Giữ liên lạc lịch sự',
};

/** Thư gửi đi đã gắn [tên công ty] phía trước, nên tiêu đề không lặp tên công ty. */
export function stripCompanyFromSubject(subject: string, companyName: string): string {
  const company = companyName.trim();
  if (!company) return subject;
  const escaped = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return subject
    .replace(new RegExp(`\\s*[-–—|]\\s*${escaped}\\s*$`, 'i'), '')
    .replace(new RegExp(`^${escaped}\\s*[-–—:|]\\s*`, 'i'), '')
    .trim()
    .slice(0, 120);
}

export function broadcastPurposeLabel(purpose: BroadcastEmailPurpose): string {
  return PURPOSE_LABEL[purpose];
}

export function parseBroadcastDraft(raw: string): { subject: string; body: string } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(trimmed.slice(start, end + 1)) as { subject?: unknown; body?: unknown };
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    const body = typeof data.body === 'string' ? data.body.trim() : '';
    if (subject.length < 3 || body.length < 10) return null;
    return { subject: subject.slice(0, 120), body: body.slice(0, 2000) };
  } catch {
    return null;
  }
}

type Tone = 'rejected' | 'hired' | 'offer' | 'interview' | 'screening' | 'applied' | 'general';

function toneOf(statuses: ApplicationStatus[]): Tone {
  const unique = [...new Set(statuses)];
  if (unique.length !== 1) return 'general';
  switch (unique[0]) {
    case ApplicationStatus.Rejected:
      return 'rejected';
    case ApplicationStatus.Hired:
      return 'hired';
    case ApplicationStatus.Offer:
      return 'offer';
    case ApplicationStatus.Interview:
      return 'interview';
    case ApplicationStatus.Screening:
      return 'screening';
    case ApplicationStatus.Applied:
      return 'applied';
    default:
      return 'general';
  }
}

/** Bản nháp khi AI không trả JSON hợp lệ. Không bịa lịch, lương hay tên người. */
export function localBroadcastDraft(input: {
  purpose: BroadcastEmailPurpose;
  companyName: string;
  jobTitle: string;
  statuses: ApplicationStatus[];
}): { subject: string; body: string } {
  const company = input.companyName.trim() || 'chúng tôi';
  const title = input.jobTitle.trim() || 'vị trí đang tuyển';
  const tone = toneOf(input.statuses);

  if (tone === 'rejected' || input.purpose === 'keep') {
    return {
      subject: `Phản hồi hồ sơ vị trí ${title}`,
      body: [
        `Cảm ơn bạn đã quan tâm tới vị trí ${title} tại ${company}.`,
        'Sau khi xem xét theo quy trình, chúng tôi xin phép phản hồi để bạn chủ động sắp xếp. Nếu hồ sơ chưa đi tiếp ở đợt này, đó không phủ nhận năng lực của bạn.',
        `${company} vẫn sẵn sàng kết nối khi có vị trí phù hợp hơn. Bạn không cần gửi lại hồ sơ trừ khi chúng tôi yêu cầu bổ sung.`,
      ].join('\n\n'),
    };
  }

  if (input.purpose === 'interview' || tone === 'interview') {
    return {
      subject: `Chuẩn bị bước phỏng vấn vị trí ${title}`,
      body: [
        `Hồ sơ của bạn cho vị trí ${title} tại ${company} đã được chuyển sang bước phỏng vấn.`,
        'Lịch cụ thể sẽ được gửi riêng trong mục Lịch phỏng vấn, không nằm trong thư này. Bạn nên xem lại kinh nghiệm gắn với công việc và chuẩn bị những điều muốn hỏi về vai trò.',
        'Nếu thời gian chưa phù hợp, hãy phản hồi trên inlink để đội tuyển dụng sắp xếp lại.',
      ].join('\n\n'),
    };
  }

  if (input.purpose === 'screening' || tone === 'screening') {
    return {
      subject: `Hồ sơ vị trí ${title} đang được sàng lọc`,
      body: [
        `Cảm ơn bạn đã ứng tuyển vị trí ${title} tại ${company}.`,
        'Hồ sơ đang ở bước sàng lọc. Đội tuyển dụng đối chiếu kinh nghiệm với yêu cầu của tin. Nếu cần bổ sung, chúng tôi sẽ nhắn trên inlink.',
        'Bạn chưa cần làm thêm thao tác nào. Kết quả bước này sẽ được báo khi đã chốt.',
      ].join('\n\n'),
    };
  }

  if (tone === 'offer') {
    return {
      subject: `Bước đề nghị cho vị trí ${title}`,
      body: [
        `Hồ sơ của bạn cho vị trí ${title} tại ${company} đã tới bước đề nghị làm việc.`,
        'Thư đề nghị chính thức, gồm điều khoản, sẽ được gửi riêng. Thư này chỉ để bạn biết tiến độ, chưa phải bản đề nghị.',
        'Bạn cứ chờ thư đề nghị trên inlink trước khi quyết định.',
      ].join('\n\n'),
    };
  }

  if (tone === 'hired') {
    return {
      subject: `Chào mừng bạn tới ${company}`,
      body: [
        `Chúc mừng bạn đã được nhận vào vị trí ${title} tại ${company}.`,
        'Các việc nhận việc, gồm ngày bắt đầu và giấy tờ, được gửi ở bước Nhận việc. Thư này không thay cho phiếu nhận việc.',
        'Nếu còn điểm chưa rõ, hãy phản hồi trên inlink để bộ phận tuyển dụng hỗ trợ.',
      ].join('\n\n'),
    };
  }

  return {
    subject: `Cập nhật tuyển dụng vị trí ${title}`,
    body: [
      `Cảm ơn bạn đã quan tâm tới vị trí ${title} tại ${company}.`,
      'Hồ sơ đang được xử lý theo đúng bước trên inlink. Chúng tôi sẽ báo khi có bước tiếp theo và không yêu cầu bạn nộp lại nếu thông tin đã đủ.',
      'Bạn có thể theo dõi trạng thái hồ sơ trên inlink. Mọi thay đổi quan trọng sẽ được thông báo thêm.',
    ].join('\n\n'),
  };
}
