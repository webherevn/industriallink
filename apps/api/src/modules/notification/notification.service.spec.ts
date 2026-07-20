import { NotificationService } from './notification.service';
import { ApplicationStatus, DomainEvents } from '@industriallink/contracts';

describe('NotificationService', () => {
  const email = {
    webOrigin: 'http://localhost:3000',
    sendSafe: jest.fn().mockResolvedValue(true),
    sendMany: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
  };

  function buildService(prisma: Record<string, unknown>) {
    email.sendSafe.mockClear();
    email.sendMany.mockClear();
    return new NotificationService(prisma as never, email as never);
  }

  describe('onApplicationSubmitted', () => {
    it('tạo thông báo cho từng thành viên công ty', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 2 });
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            candidate: { displayName: 'Nguyễn A' },
            job: {
              id: 'job-1',
              title: 'Kỹ sư PLC',
              companyId: 'co-1',
              company: {
                members: [
                  { userId: 'u1', user: { email: 'u1@example.com' } },
                  { userId: 'u2', user: { email: 'u2@example.com' } },
                  { userId: 'u1', user: { email: 'u1@example.com' } },
                ],
              },
            },
          }),
        },
        notification: { createMany },
      };
      const service = buildService(prisma);

      await service.onApplicationSubmitted({
        name: DomainEvents.ApplicationSubmitted,
        eventId: 'e1',
        correlationId: 'c1',
        tenantId: 'default',
        occurredAt: new Date().toISOString(),
        payload: { applicationId: 'app-1', jobId: 'job-1', candidateId: 'can-1' },
      });

      expect(createMany).toHaveBeenCalledTimes(1);
      const data = createMany.mock.calls[0][0].data as Array<{ userId: string; type: string }>;
      expect(data).toHaveLength(2);
      expect(data.map((d) => d.userId).sort()).toEqual(['u1', 'u2']);
      expect(data[0].type).toBe('application.submitted');
    });

    it('không tạo gì khi thiếu application', async () => {
      const createMany = jest.fn();
      const prisma = {
        application: { findUnique: jest.fn().mockResolvedValue(null) },
        notification: { createMany },
      };
      const service = buildService(prisma);

      await service.onApplicationSubmitted({
        name: DomainEvents.ApplicationSubmitted,
        eventId: 'e1',
        correlationId: 'c1',
        tenantId: 'default',
        occurredAt: new Date().toISOString(),
        payload: { applicationId: 'missing', jobId: 'j', candidateId: 'c' },
      });

      expect(createMany).not.toHaveBeenCalled();
    });
  });

  describe('onApplicationStatusChanged', () => {
    it('tạo thông báo cho ứng viên với nhãn trạng thái tiếng Việt', async () => {
      const create = jest.fn().mockResolvedValue({});
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            candidate: {
              displayName: 'Trần C',
              userId: 'candidate-user',
              user: { email: 'c@example.com' },
            },
            job: { title: 'Kỹ sư SCADA' },
          }),
        },
        notification: { create },
      };
      const service = buildService(prisma);

      await service.onApplicationStatusChanged({
        name: DomainEvents.ApplicationStatusChanged,
        eventId: 'e2',
        correlationId: 'c2',
        tenantId: 'default',
        occurredAt: new Date().toISOString(),
        payload: {
          applicationId: 'app-1',
          from: ApplicationStatus.Applied,
          to: ApplicationStatus.Interview,
        },
      });

      expect(create).toHaveBeenCalledTimes(1);
      const row = create.mock.calls[0][0].data as {
        userId: string;
        body: string;
        type: string;
      };
      expect(row.userId).toBe('candidate-user');
      expect(row.type).toBe('application.status_changed');
      expect(row.body).toContain('Đã nộp');
      expect(row.body).toContain('Phỏng vấn');
    });
  });

  describe('onInterviewScheduled', () => {
    it('tạo in-app notification và gửi email mời PV', async () => {
      const create = jest.fn().mockResolvedValue({});
      const prisma = {
        interview: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'iv-1',
            durationMinutes: 60,
            location: 'KCN',
            meetingLink: 'https://meet.example/x',
            interviewerName: 'HR Lan',
            notes: null,
            candidate: {
              displayName: 'Nguyễn B',
              user: { id: 'cu-1', email: 'b@example.com' },
            },
            job: {
              title: 'Kỹ sư PLC',
              company: { name: 'Công ty ABC' },
            },
          }),
        },
        notification: { create },
      };
      const service = buildService(prisma);

      await service.onInterviewScheduled({
        name: DomainEvents.InterviewScheduled,
        eventId: 'e3',
        correlationId: 'c3',
        tenantId: 'default',
        occurredAt: new Date().toISOString(),
        payload: {
          interviewId: 'iv-1',
          applicationId: 'app-1',
          scheduledAt: '2026-07-20T09:00:00.000Z',
          type: 'hr',
        },
      });

      expect(create).toHaveBeenCalledTimes(1);
      expect(email.sendSafe).toHaveBeenCalledTimes(1);
      const msg = email.sendSafe.mock.calls[0][0] as {
        to: string;
        subject: string;
        html: string;
      };
      expect(msg.to).toBe('b@example.com');
      expect(msg.subject).toContain('Mời phỏng vấn');
      expect(msg.html).toContain('Công ty ABC');
    });
  });

  describe('markAllRead', () => {
    it('đánh dấu tất cả chưa đọc của user', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 3 });
      const service = buildService({
        notification: { updateMany },
      });

      const result = await service.markAllRead({
        id: 'user-1',
        email: 'a@b.c',
        role: 'candidate',
        tenantId: 'default',
      } as never);

      expect(result.updated).toBe(3);
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', readAt: null },
        }),
      );
    });
  });
});
