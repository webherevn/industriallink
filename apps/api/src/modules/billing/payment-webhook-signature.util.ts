import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify Stripe webhook signature.
 * Format: "t=<timestamp>,v1=<hex-hmac>"
 * HMAC-SHA256 trên chuỗi "<timestamp>.<rawBody>" với webhook signing secret.
 *
 * Trả về true nếu signature hợp lệ, false nếu sai.
 */
export function verifyStripeSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts.t;
  const receivedSig = parts.v1;
  if (!timestamp || !receivedSig) return false;

  // Chống replay: timestamp không quá lệch ±5 phút
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > toleranceSeconds) return false;

  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${bodyStr}`).digest();

  let received: Buffer;
  try {
    received = Buffer.from(receivedSig, 'hex');
  } catch {
    return false;
  }
  if (received.length !== expected.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * Tạo "mock signing secret" giả lập cho dev. Không dùng trong production.
 * Chỉ để đảm bảo webhook handler nhận diện mock events.
 */
export function isMockEventId(eventId: string): boolean {
  return eventId.startsWith('evt_mock_');
}
