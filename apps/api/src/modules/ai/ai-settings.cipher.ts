import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Mã hoá/giải mã API key trước khi lưu DB — AES-256-GCM.
 * Khoá 32 byte dẫn xuất từ `secret` (SETTINGS_ENCRYPTION_KEY hoặc JWT secret).
 * Định dạng lưu: "v1:" + base64(iv[12] | tag[16] | ciphertext).
 */
const ALGO = 'aes-256-gcm';
const PREFIX = 'v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string, secret: string): string {
  if (!payload.startsWith(PREFIX)) {
    throw new Error('Ciphertext không đúng định dạng');
  }
  const raw = Buffer.from(payload.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/** 4 ký tự cuối của key để nhận diện trên UI (không lộ key). */
export function keyPreview(plainKey: string | undefined | null): string | null {
  if (!plainKey) return null;
  const tail = plainKey.slice(-4);
  return tail ? `…${tail}` : null;
}
