import { ExperienceBand } from '@industriallink/contracts';
import {
  extractTechnicalJobFromText,
  normalizeParsedTechnicalJob,
} from './llm-job-parse-technical.util';

const SAMPLE_JD = `
Tuyển Kỹ sư tự động hóa / Điều khiển
Ngành: Tự động hóa & Điều khiển
Địa điểm làm việc: Hà Nội
Kinh nghiệm: 3-5 năm
Mức lương: 18-28 triệu
Số lượng: 2 vị trí

Mô tả công việc:
Làm việc với Tự động hóa / Điều khiển tại Nhà máy / xưởng. Bảo trì / bảo dưỡng, Sửa chữa, Xử lý sự cố. Có thể tự xử lý công việc phức tạp. Dùng AutoCAD, đọc Bản vẽ điện.

Yêu cầu:
Tốt nghiệp Đại học. Có thể làm ngoài giờ hoặc xử lý sự cố khi cần.

Quyền lợi:
BHXH đầy đủ.
`.trim();

describe('llm-job-parse-technical.util', () => {
  it('extractTechnicalJobFromText: chỉ lấy catalog có trong JD, không bịa thiết bị', () => {
    const parsed = extractTechnicalJobFromText(SAMPLE_JD);
    expect(parsed.title).toMatch(/tự động hóa/i);
    expect(parsed.equipmentSystems).toContain('Tự động hóa / Điều khiển');
    expect(parsed.equipmentSystems).not.toContain('Robot / Tự động hóa sản xuất');
    expect(parsed.workEnvironments).toContain('Nhà máy / xưởng');
    expect(parsed.technicalWorkTypes).toEqual(
      expect.arrayContaining(['Bảo trì / bảo dưỡng', 'Sửa chữa', 'Xử lý sự cố']),
    );
    expect(parsed.autonomyLevel).toBe(4);
    expect(parsed.technicalTools).toContain('AutoCAD');
    expect(parsed.documentLiteracy).toContain('Bản vẽ điện');
    expect(parsed.experienceBand).toBe(ExperienceBand.From3To5);
    expect(parsed.salaryMin).toBe(18_000_000);
    expect(parsed.description.length).toBeGreaterThan(10);
  });

  it('normalizeParsedTechnicalJob: bỏ thiết bị không có căn cứ trong nguồn', () => {
    const parsed = normalizeParsedTechnicalJob(
      {
        title: 'Kỹ sư PLC',
        equipmentSystems: ['Tự động hóa / Điều khiển', 'HVAC / Điều hòa – thông gió'],
        workEnvironments: ['Nhà máy / xưởng'],
      },
      'Tuyển kỹ sư PLC làm Tự động hóa / Điều khiển tại Nhà máy / xưởng',
    );
    expect(parsed.equipmentSystems).toEqual(['Tự động hóa / Điều khiển']);
    expect(parsed.equipmentSystems).not.toContain('HVAC / Điều hòa – thông gió');
    expect(parsed.workEnvironments).toContain('Nhà máy / xưởng');
  });
});
