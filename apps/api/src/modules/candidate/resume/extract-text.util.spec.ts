import { extractResumeText, ExtractTextError } from './extract-text.util';

describe('extractResumeText', () => {
  it('trích text từ file TXT / text/plain', async () => {
    const buffer = Buffer.from('Kỹ sư PLC Siemens, SCADA WinCC, 5 năm kinh nghiệm.', 'utf8');
    const text = await extractResumeText(buffer, 'text/plain');
    expect(text).toContain('PLC Siemens');
    expect(text).toContain('SCADA');
  });

  it('chấp nhận MIME có charset (text/plain; charset=utf-8)', async () => {
    const text = await extractResumeText(
      Buffer.from('PLC Siemens', 'utf8'),
      'text/plain; charset=utf-8',
    );
    expect(text).toContain('PLC Siemens');
  });

  it('báo lỗi rõ khi buffer trống', async () => {
    await expect(extractResumeText(Buffer.alloc(0), 'text/plain')).rejects.toBeInstanceOf(
      ExtractTextError,
    );
    await expect(extractResumeText(Buffer.alloc(0), 'text/plain')).rejects.toThrow(/trống/);
  });

  it('báo lỗi rõ khi định dạng DOC cũ', async () => {
    await expect(
      extractResumeText(Buffer.from('fake'), 'application/msword'),
    ).rejects.toBeInstanceOf(ExtractTextError);
    await expect(
      extractResumeText(Buffer.from('fake'), 'application/msword'),
    ).rejects.toThrow(/DOC \(Word cũ\)/);
  });

  it('báo lỗi khi MIME không hỗ trợ', async () => {
    await expect(extractResumeText(Buffer.from('x'), 'image/png')).rejects.toThrow(/không hỗ trợ/);
  });

  it('PDF buffer không hợp lệ → ExtractTextError tiếng Việt', async () => {
    await expect(
      extractResumeText(Buffer.from('%PDF-not-a-real-file'), 'application/pdf'),
    ).rejects.toBeInstanceOf(ExtractTextError);
    await expect(
      extractResumeText(Buffer.from('%PDF-not-a-real-file'), 'application/pdf'),
    ).rejects.toThrow(/PDF/);
  });

  it('DOCX buffer hỏng → ExtractTextError tiếng Việt', async () => {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    await expect(extractResumeText(Buffer.from('not-a-docx'), mime)).rejects.toBeInstanceOf(
      ExtractTextError,
    );
    await expect(extractResumeText(Buffer.from('not-a-docx'), mime)).rejects.toThrow(/DOCX/);
  });
});
