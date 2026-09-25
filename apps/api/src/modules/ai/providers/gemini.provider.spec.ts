import { geminiModelsToTry, isRetryableGeminiStatus } from './gemini.provider';

describe('Gemini retry / fallback', () => {
  it('thử model chính rồi 2.5-flash / 2.5-flash-lite', () => {
    expect(geminiModelsToTry('gemini-3.6-flash')).toEqual([
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('không lặp model nếu đã là fallback', () => {
    expect(geminiModelsToTry('gemini-2.5-flash')).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('503 và 429 được thử lại', () => {
    expect(isRetryableGeminiStatus(503)).toBe(true);
    expect(isRetryableGeminiStatus(429)).toBe(true);
    expect(isRetryableGeminiStatus(400)).toBe(false);
    expect(isRetryableGeminiStatus(200)).toBe(false);
  });
});
