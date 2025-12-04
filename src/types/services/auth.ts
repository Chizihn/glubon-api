//src/types/services/auth.ts
import { ProviderEnum, RoleEnum, User } from "@prisma/client";

export interface RegisterInput {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  phoneNumber?: string;
  role: RoleEnum;
  roles?: RoleEnum[];
  provider?: ProviderEnum;
}

export interface LoginInput {
  email: string;
  password: string;
  role?: RoleEnum;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthResult extends AuthTokens {
  user: Omit<User, "password" | "refreshToken"> & { roles: RoleEnum[] };
}

export interface OAuthUserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePic?: string;
  phoneNumber?: string;
  isEmailVerified: boolean;
}

export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}
