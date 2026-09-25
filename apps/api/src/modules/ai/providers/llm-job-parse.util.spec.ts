import { ExperienceBand } from '@industriallink/contracts';
import {
  extractSalesJobFromText,
  normalizeParsedSalesJob,
} from './llm-job-parse.util';

const SAMPLE_JD = `
Tuyển Nhân viên kinh doanh
Ngành: Máy móc & Thiết bị sản xuất
Hình thức: Toàn thời gian
Địa điểm làm việc: KCN Bắc Ninh
Kinh nghiệm: 1-3 năm
Mức lương: 15-25 triệu
Số lượng: 2 vị trí

Bán Máy nén khí cho Nhà máy FDI, phụ trách Miền Bắc.
Phạm vi: Tìm kiếm khách hàng, Lập & gửi báo giá, Chốt hợp đồng.

Yêu cầu:
- Tốt nghiệp Đại học
- Tiếng Anh giao tiếp
- Có bằng lái ô tô, sẵn sàng đi công tác khi cần

Mô tả công việc:
Tìm kiếm và chăm sóc khách hàng B2B máy nén khí tại KCN Bắc Ninh.

Quyền lợi:
Lương + hoa hồng, BHXH đầy đủ.
`.trim();

describe('llm-job-parse.util', () => {
  it('extractSalesJobFromText: chỉ lấy catalog có trong JD, không bịa sản phẩm', () => {
    const parsed = extractSalesJobFromText(SAMPLE_JD);
    expect(parsed.title).toMatch(/Nhân viên kinh doanh/i);
    expect(parsed.productsSold).toContain('Máy nén khí');
    expect(parsed.productsSold).not.toContain('Robot công nghiệp');
    expect(parsed.customerSegments).toContain('Nhà máy FDI');
    expect(parsed.marketsCovered).toContain('Miền Bắc');
    expect(parsed.experienceBand).toBe(ExperienceBand.From1To3);
    expect(parsed.salaryMin).toBe(15_000_000);
    expect(parsed.salaryMax).toBe(25_000_000);
    expect(parsed.educationLevel).toBe('Đại học');
    expect(parsed.languages).toContain('Tiếng Anh');
    expect(parsed.driverLicenses).toContain('Ô tô');
    expect(parsed.description.length).toBeGreaterThan(10);
  });

  it('normalizeParsedSalesJob: bỏ sản phẩm không có căn cứ trong nguồn', () => {
    const parsed = normalizeParsedSalesJob(
      {
        title: 'NVKD',
        productsSold: ['Máy nén khí', 'Robot công nghiệp'],
        customerSegments: ['Nhà máy FDI'],
      },
      'Tuyển NVKD bán máy nén khí cho nhà máy FDI',
    );
    expect(parsed.productsSold).toEqual(['Máy nén khí']);
    expect(parsed.productsSold).not.toContain('Robot công nghiệp');
    expect(parsed.customerSegments).toContain('Nhà máy FDI');
  });
});
