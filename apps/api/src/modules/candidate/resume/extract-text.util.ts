/**
 * Trích text thô từ buffer CV (TXT / PDF / DOCX).
 * Tách khỏi Nest service để dễ unit test.
 */

/** Giữ đủ dài cho CV nhiều trang — Gemini context lớn hơn 20k. */
const MAX_CHARS = 80_000;

export class ExtractTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractTextError';
  }
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Chuẩn hoá MIME (bỏ charset / tham số phụ). */
function normalizeMime(mime: string): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

/** Trích text từ buffer theo MIME. Trả chuỗi rỗng nếu không có nội dung đọc được. */
export async function extractResumeText(buffer: Buffer, mime: string): Promise<string> {
  if (!buffer?.length) {
    throw new ExtractTextError(
      'File CV trống hoặc không có dữ liệu. Vui lòng tải lại file hợp lệ (PDF, DOCX hoặc TXT).',
    );
  }

  const normalized = normalizeMime(mime);

  if (normalized.startsWith('text/') || normalized === 'application/json') {
    return buffer.toString('utf8').slice(0, MAX_CHARS);
  }

  if (normalized === 'application/pdf') {
    let parser: { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } | null =
      null;
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return (result.text ?? '').trim().slice(0, MAX_CHARS);
    } catch (err) {
      if (err instanceof ExtractTextError) throw err;
      throw new ExtractTextError(
        `Không đọc được nội dung PDF. File có thể bị hỏng hoặc là ảnh scan. Chi tiết: ${String(err).slice(0, 200)}`,
      );
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // bỏ qua lỗi giải phóng tài nguyên
        }
      }
    }
  }

  if (normalized === DOCX_MIME) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return (result.value ?? '').trim().slice(0, MAX_CHARS);
    } catch (err) {
      if (err instanceof ExtractTextError) throw err;
      throw new ExtractTextError(
        `Không đọc được nội dung DOCX. File Word có thể bị hỏng. Vui lòng kiểm tra lại. Chi tiết: ${String(err).slice(0, 200)}`,
      );
    }
  }

  if (normalized === 'application/msword') {
    throw new ExtractTextError(
      'Định dạng DOC (Word cũ) chưa được hỗ trợ. Vui lòng tải lên PDF, DOCX hoặc TXT.',
    );
  }

  throw new ExtractTextError(`Định dạng file không hỗ trợ trích text: ${mime || '(trống)'}`);
}
