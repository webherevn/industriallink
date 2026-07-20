import { createHash } from 'node:crypto';

/**
 * Sinh embedding giả lập DETERMINISTIC từ text (dùng cho provider mock).
 * Không phải embedding ngữ nghĩa thật, nhưng ổn định để test luồng lưu vector.
 */
export function deterministicEmbedding(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const hash = createHash('sha256').update(token).digest();
    for (let i = 0; i < dim; i++) {
      // Trải giá trị hash lên toàn vector.
      vec[i] += (hash[i % hash.length] - 128) / 128;
    }
  }
  // Chuẩn hoá L2 để dùng cosine similarity.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}
