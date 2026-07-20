/** Gravatar dùng SHA-256 của email (chuẩn mới, trình duyệt hỗ trợ Web Crypto). */
export async function gravatarUrl(email: string, size = 200): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
