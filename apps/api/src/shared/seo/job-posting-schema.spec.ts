import {
  companyPublicPath,
  jobPublicPath,
  jobValidThroughIso,
  toJobPostingDescriptionHtml,
} from '@industriallink/contracts';

describe('job SEO schema helpers', () => {
  it('URL tin chỉ là /viec-lam/{slug}', () => {
    expect(
      jobPublicPath({
        slug: 'nhan-vien-kinh-doanh-b2b',
        industry: 'Máy móc & Thiết bị sản xuất',
      }),
    ).toBe('/viec-lam/nhan-vien-kinh-doanh-b2b');
  });

  it('URL công ty công khai là /cong-ty/{slug}', () => {
    expect(
      companyPublicPath({
        companyId: 'c1',
        companySlug: 'cong-ty-psi',
        slug: 'nhan-vien-kinh-doanh-b2b',
      }),
    ).toBe('/cong-ty/cong-ty-psi');
  });

  it('validThrough mặc định +30 ngày nếu không có deadline', () => {
    const iso = jobValidThroughIso({
      createdAt: '2026-09-24T00:00:00.000Z',
      publishedAt: '2026-09-24T00:00:00.000Z',
    });
    expect(iso.startsWith('2026-10-24')).toBe(true);
  });

  it('description là HTML p/ul chứ không plain text', () => {
    const html = toJobPostingDescriptionHtml({
      title: 'Kỹ sư Bán hàng B2B',
      description: 'Tìm khách hàng nhà máy.\nTư vấn thiết bị.',
      requirements: 'Đại học\n2 năm sales B2B',
    });
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('<h3>Yêu cầu:</h3>');
  });
});
