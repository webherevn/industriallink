import { decryptSecret, encryptSecret, keyPreview } from './ai-settings.cipher';

describe('ai-settings.cipher', () => {
  it('mã hoá rồi giải mã lại đúng chuỗi gốc', () => {
    const secret = 'test-encryption-secret';
    const plain = 'AIzaSy-demo-key-1234';
    const enc = encryptSecret(plain, secret);
    expect(enc.startsWith('v1:')).toBe(true);
    expect(decryptSecret(enc, secret)).toBe(plain);
  });

  it('cùng plaintext cho 2 ciphertext khác nhau (IV ngẫu nhiên)', () => {
    const a = encryptSecret('same', 's');
    const b = encryptSecret('same', 's');
    expect(a).not.toBe(b);
    expect(decryptSecret(a, 's')).toBe('same');
    expect(decryptSecret(b, 's')).toBe('same');
  });

  it('sai khoá thì giải mã thất bại', () => {
    const enc = encryptSecret('hello', 'key-a');
    expect(() => decryptSecret(enc, 'key-b')).toThrow();
  });

  it('keyPreview chỉ lộ 4 ký tự cuối', () => {
    expect(keyPreview('AIzaSyXXXXYYYY')).toBe('…YYYY');
    expect(keyPreview(null)).toBeNull();
  });
});
