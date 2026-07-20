import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Băm và xác minh mật khẩu bằng Argon2id (khuyến nghị OWASP).
 */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
