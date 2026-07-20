import { MfaMethod, UserRole } from './enums';

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole.Candidate | UserRole.Recruiter;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyLoginOtpRequest {
  mfaToken: string;
  otp: string;
}

export interface ResendLoginOtpRequest {
  mfaToken: string;
}

export interface UpdateMfaRequest {
  enabled: boolean;
}

/** Kết quả khởi tạo TOTP: hiển thị QR + secret để người dùng thêm vào app xác thực. */
export interface TotpSetupResponse {
  /** Secret dạng Base32 (phòng khi không quét được QR, nhập tay). */
  secret: string;
  /** URI chuẩn otpauth:// để tạo QR. */
  otpauthUrl: string;
  /** Ảnh QR dạng data URL (PNG base64), hiển thị trực tiếp trong <img>. */
  qrCodeDataUrl: string;
}

export interface VerifyTotpRequest {
  /** Mã 6 số từ app xác thực. */
  code: string;
}

export interface AuthUserView {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: string;
  mfaEnabled: boolean;
  mfaMethod: MfaMethod | null;
}

export interface AuthTokens {
  accessToken: string;
  /** TTL (giây) của access token. */
  expiresIn: number;
}

/** Đăng nhập thành công — đã cấp JWT. */
export interface LoginSuccessResponse extends AuthTokens {
  mfaRequired?: false;
  user: AuthUserView;
}

/** Cần bước MFA (OTP email hoặc TOTP) trước khi cấp JWT. */
export interface LoginMfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
  /** Phương thức cần xác thực: email_otp (đã gửi mã) hoặc totp (nhập mã từ app). */
  mfaMethod: MfaMethod;
  /** TTL (giây) của mfaToken / OTP. */
  expiresIn: number;
  message: string;
  /** Chỉ có ở non-production để tiện dev local, và chỉ khi mfaMethod=email_otp. */
  devOtp?: string;
}

export type LoginResponse = LoginSuccessResponse | LoginMfaChallengeResponse;

export function isLoginMfaChallenge(res: LoginResponse): res is LoginMfaChallengeResponse {
  return res.mfaRequired === true;
}
