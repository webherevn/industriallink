import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hash tạo chuỗi khác plain và verify đúng mật khẩu', async () => {
    const plain = 'MatKhau@123';
    const hash = await passwords.hash(plain);
    expect(hash).not.toBe(plain);
    expect(hash.length).toBeGreaterThan(20);
    await expect(passwords.verify(hash, plain)).resolves.toBe(true);
  });

  it('verify trả false khi mật khẩu sai', async () => {
    const hash = await passwords.hash('dung-roi');
    await expect(passwords.verify(hash, 'sai-roi')).resolves.toBe(false);
  });
});
