import { looksLikeUuid, nextUniqueSlug, toSeoSlug } from '@industriallink/contracts';

describe('seo-slug', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(toSeoSlug('Nhân viên kinh doanh B2B')).toBe('nhan-vien-kinh-doanh-b2b');
    expect(toSeoSlug('Kỹ Sư Cơ Điện (M&E)')).toBe('ky-su-co-dien-m-e');
  });

  it('thêm -1, -2 khi trùng', () => {
    expect(nextUniqueSlug('cong-ty-psi', ['cong-ty-psi'])).toBe('cong-ty-psi-1');
    expect(nextUniqueSlug('cong-ty-psi', ['cong-ty-psi', 'cong-ty-psi-1'])).toBe(
      'cong-ty-psi-2',
    );
  });

  it('nhận diện UUID', () => {
    expect(looksLikeUuid('3ef1854c-ab71-4141-aa9d-f6852d2d7d2a')).toBe(true);
    expect(looksLikeUuid('nhan-vien-kinh-doanh-b2b')).toBe(false);
  });
});
