import {
  PrismaClient,
  ProviderEnum,
  RoleEnum,
  TokenType,
  User,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { BaseService } from "./base";
import { EmailService } from "./email";
import { OAuthService } from "./oauth";
import { jwtConfig, securityConfig } from "../config";
import { ServiceResponse } from "../types";
import { logger } from "../utils";
import {
  AuthResult,
  AuthTokens,
  ForgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "../types/services/auth";
import { UserRepository } from "../repository/user";
import Redis from "ioredis";
import { validateRole } from "../middleware";
import { getContainer } from "./container";

export class AuthService extends BaseService {
  private emailService: EmailService;
  private oauthService: OAuthService;
  private userRepository: UserRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    const container = getContainer();
    this.oauthService = container.resolve('oauthService');
    this.userRepository = container.resolve('userRepository');
    this.emailService = container.resolve('emailService');
  }

  async register(input: RegisterInput): Promise<ServiceResponse<AuthResult>> {
    try {
      const {
        email,
        firstName,
        lastName,
        password,
        phoneNumber,
        role,
        provider,
      } = input;

      if (role === RoleEnum.ADMIN) {
        return this.failure(
          "You do not have permission to perform this action!"
        );
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findUserByEmailOrPhone(
        email,
        phoneNumber
      );

      if (existingUser) {
        return this.failure(
          "User with this email or phone number already exists"
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        password as string,
        securityConfig.bcryptRounds
      );

      // Create user
      const user = await this.userRepository.createUser({
        email,
        firstName,
        lastName,
        password: hashedPassword as string,
        phoneNumber: phoneNumber || "",
        role: role || RoleEnum.RENTER,
        provider: provider || ProviderEnum.EMAIL,
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update user with refresh token
      await this.userRepository.updateUser(user.id, {
        refreshToken: tokens.refreshToken,
      });

      // Send verification email
      await this.sendVerificationEmail(user);

      // Remove sensitive data
      const { password: _, refreshToken: __, ...userWithoutSensitive } = user;

      return this.success<AuthResult>(
        {
          ...tokens,
          user: userWithoutSensitive,
        },
        "Registration successful. Please check your email for verification."
      );
    } catch (error) {
      return this.handleError(error, "register");
    }
  }

  async login(input: LoginInput): Promise<ServiceResponse<AuthResult>> {
    try {
      const { email, password } = input;

      // Find user
      const user = await this.userRepository.findUserByEmail(email);

      if (!user || !user.password) {
        return this.failure("Invalid credentials");
      }

      // Check if user is active
      if (!user.isActive) {
        return this.failure("Account has been deactivated");
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return this.failure("Invalid credentials");
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update user with refresh token and last login
      await this.userRepository.updateUser(user.id, {
        refreshToken: tokens.refreshToken,
        lastLogin: new Date(),
      });

      // Remove sensitive data
      const { password: _, refreshToken: __, ...userWithoutSensitive } = user;

      return this.success<AuthResult>(
        {
          ...tokens,
          user: userWithoutSensitive,
        },
        "Login successful"
      );
    } catch (error) {
      return this.handleError(error, "login");
    }
  }

  async refreshToken(
    input: RefreshTokenInput
  ): Promise<ServiceResponse<AuthTokens>> {
    try {
      const { refreshToken } = input;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as any;

      // Find user
      const user = await this.userRepository.findUserById(decoded.userId);

      if (!user || user.refreshToken !== refreshToken || !user.isActive) {
        return this.failure("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update user with new refresh token
      await this.userRepository.updateUser(user.id, {
        refreshToken: tokens.refreshToken,
      });

      return this.success<AuthTokens>(tokens, "Token refreshed successfully");
    } catch (error) {
      return this.handleError(error, "refreshToken");
    }
  }

  async logout(userId: string): Promise<ServiceResponse> {
    try {
      // Clear refresh token
      await this.userRepository.updateUser(userId, { refreshToken: null });

      // Clear cached user data
      await this.deleteCache(this.generateCacheKey("user", userId));

      return this.success(null, "Logout successful");
    } catch (error) {
      return this.handleError(error, "logout");
    }
  }

  async resendVerificationEmail(email: string): Promise<ServiceResponse> {
    try {
      const user = await this.userRepository.findUserByEmail(email);

      if (!user) {
        // Don't reveal if user doesn't exist
        return this.success(null, "If an account exists with this email, a verification email has been sent");
      }

      if (user.isVerified) {
        return this.failure("Email is already verified");
      }

      await this.sendVerificationEmail(user);

      return this.success(
        null,
        "If an account exists with this email, a verification email has been sent"
      );
    } catch (error) {
      return this.handleError(error, "resendVerificationEmail");
    }
  }

  async resendPasswordReset(email: string): Promise<ServiceResponse> {
    try {
      const user = await this.userRepository.findUserByEmail(email);

      if (!user) {
        // Don't reveal if user doesn't exist
        return this.success(
          null,
          "If an account exists with this email, a password reset link has been sent"
        );
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      // Invalidate any existing reset tokens
      await this.prisma.verificationToken.updateMany({
        where: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          used: false,
        },
        data: {
          used: true,
        },
      });

      // Create new reset token
      await this.prisma.verificationToken.create({
        data: {
          token: resetToken,
          type: TokenType.PASSWORD_RESET,
          userId: user.id,
          email: user.email,
          expiresAt,
        },
      });

      // Send reset email with link
      await this.emailService.sendVerificationCode(
        user.email,
        user.firstName,
        resetLink, // This will be the reset link, not just the token
        "password_reset"
      );

      return this.success(
        null,
        "If an account exists with this email, a password reset link has been sent"
      );
    } catch (error) {
      return this.handleError(error, "resendPasswordReset");
    }
  }

  async verifyEmail(input: VerifyEmailInput): Promise<ServiceResponse> {
    try {
      const { token } = input;

      const verificationToken = await this.userRepository.findVerificationToken(
        token,
        TokenType.EMAIL_VERIFICATION
      );

      if (!verificationToken) {
        return this.failure("Invalid or expired verification token");
      }

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: verificationToken.userId },
          data: { isVerified: true },
        }),
        this.prisma.verificationToken.update({
          where: { id: verificationToken.id },
          data: { used: true },
        }),
      ]);

      return this.success(null, "Email verified successfully");
    } catch (error) {
      return this.handleError(error, "verifyEmail");
    }
  }

  async forgotPassword(
    input: ForgotPasswordInput
  ): Promise<ServiceResponse<null>> {
    try {
      const { email } = input;

      // Find user
      const user = await this.userRepository.findUserByEmail(email);

      if (!user) {
        // Don't reveal if email exists
        return this.success(
          null,
          "If the email exists, a reset link has been sent"
        );
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      // Save reset token
      await this.userRepository.createVerificationToken({
        token: resetToken,
        type: TokenType.PASSWORD_RESET,
        userId: user.id,
        email: user.email,
        expiresAt,
      });

      // Send reset email
      await this.emailService.sendVerificationCode(
        user.email,
        user.firstName,
        resetToken,
        "password_reset"
      );

      return this.success(
        null,
        "If the email exists, a reset link has been sent"
      );
    } catch (error) {
      return this.handleError(error, "forgotPassword");
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<ServiceResponse> {
    try {
      const { token, newPassword } = input;

      const verificationToken = await this.userRepository.findVerificationToken(
        token,
        TokenType.PASSWORD_RESET
      );

      if (!verificationToken) {
        return this.failure("Invalid or expired reset token");
      }

      const hashedPassword = await bcrypt.hash(
        newPassword,
        securityConfig.bcryptRounds
      );

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: verificationToken.userId },
          data: {
            password: hashedPassword,
            refreshToken: null,
          },
        }),
        this.prisma.verificationToken.update({
          where: { id: verificationToken.id },
          data: { used: true },
        }),
      ]);

      return this.success(null, "Password reset successfully");
    } catch (error) {
      return this.handleError(error, "resetPassword");
    }
  }

  async registerWithProvider(input: {
    accessToken: string;
    provider: ProviderEnum;
    role: RoleEnum;
  }): Promise<ServiceResponse<AuthResult>> {
    try {
      const { accessToken, provider, role } = input;

      // Validate role using utility
      const validatedRole = validateRole(role);

      // Verify the access token with the OAuth provider
      const verificationResult = await this.oauthService.verifyProviderToken(
        provider,
        accessToken
      );
      if (!verificationResult.success) {
        return this.failure(verificationResult.message);
      }

      const userData = verificationResult.data!;

      // Check if user already exists with this email
      const existingUser = await this.userRepository.findUserByEmail(
        userData.email
      );

      if (existingUser) {
        // If user exists but with different provider, link the accounts
        if (existingUser.provider !== provider) {
          const updatedUser = await this.userRepository.updateUser(
            existingUser.id,
            {
              provider,
              profilePic: userData.profilePic || existingUser.profilePic,
              isVerified: true,
              lastLogin: new Date(),
            }
          );

          const tokens = await this.generateTokens({
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            permissions: updatedUser.permissions,
          });

          return this.success<AuthResult>(
            {
              ...tokens,
              user: updatedUser,
            },
            "Account linked and login successful"
          );
        } else {
          // Same provider, just login
          return this.loginWithProvider({ accessToken, provider });
        }
      }

      // Create new user with OAuth provider
      const user = await this.userRepository.createUser({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        provider: provider || ProviderEnum.EMAIL,
        role: validatedRole,
        phoneNumber: userData.phoneNumber || "",
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update user with refresh token
      await this.userRepository.updateUser(user.id, {
        refreshToken: tokens.refreshToken,
        lastLogin: new Date(),
      });

      // Send welcome email (no verification needed)
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);

      // Remove sensitive data
      const { password: _, refreshToken: __, ...userWithoutSensitive } = user;

      return this.success<AuthResult>(
        {
          ...tokens,
          user: userWithoutSensitive,
        },
        "Registration with OAuth provider successful"
      );
    } catch (error) {
      return this.handleError(error, "registerWithProvider");
    }
  }

  async loginWithProvider(input: {
    accessToken: string;
    provider: ProviderEnum;
    role?: RoleEnum;
  }): Promise<ServiceResponse<AuthResult>> {
    try {
      const { accessToken, provider, role } = input;

      // Verify the access token with the OAuth provider
      const verificationResult = await this.oauthService.verifyProviderToken(
        provider,
        accessToken
      );
      if (!verificationResult.success) {
        return this.failure(verificationResult.message);
      }

      const userData = verificationResult.data!;

      // Find user by email
      const user = await this.userRepository.findUserByEmail(userData.email);

      // If user doesn't exist, register them with provided or default role
      if (!user) {
        return this.registerWithProvider({
          accessToken,
          provider,
          role: validateRole(role), // Use utility to validate or default to TENANT
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return this.failure("Account has been deactivated");
      }

      // Update provider if user originally registered with email
      let updatedUser = user;
      if (user.provider === ProviderEnum.EMAIL) {
        updatedUser = await this.userRepository.updateUser(user.id, {
          provider,
          isVerified: true,
          profilePic: userData.profilePic || user.profilePic,
          firstName: userData.firstName || user.firstName, // Safely update fields
          lastName: userData.lastName || user.lastName,
          phoneNumber: userData.phoneNumber || user.phoneNumber,
        });
      }

      // Check if provider matches
      if (updatedUser.provider !== provider) {
        return this.failure(
          `Account registered with ${updatedUser.provider}. Please use the correct provider or link accounts.`
        );
      }

      // Generate tokens
      const tokens = await this.generateTokens({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        permissions: updatedUser.permissions,
      });

      // Update user with refresh token and last login
      await this.userRepository.updateUser(updatedUser.id, {
        refreshToken: tokens.refreshToken,
        lastLogin: new Date(),
      });

      // Remove sensitive data
      const { password, refreshToken, ...userWithoutSensitive } = updatedUser;

      return this.success<AuthResult>(
        {
          ...tokens,
          user: userWithoutSensitive,
        },
        "OAuth login successful"
      );
    } catch (error) {
      return this.handleError(error, "loginWithProvider");
    }
  }

  async linkProvider(
    userId: string,
    input: {
      provider: ProviderEnum;
      providerId: string;
      email?: string;
    }
  ): Promise<ServiceResponse> {
    try {
      const { provider, providerId, email } = input;

      // Get current user
      const user = await this.userRepository.findUserById(userId);

      if (!user) {
        return this.failure("User not found");
      }

      // If email is provided and different, check if it's already taken
      if (email && email !== user.email) {
        const existingUser = await this.userRepository.findUserByEmail(email);

        if (existingUser) {
          return this.failure(
            "Email is already associated with another account"
          );
        }
      }

      // Update user with new provider info
      await this.userRepository.updateUser(userId, {
        provider,
        ...(email && email !== user.email && { email }),
        isVerified: true,
      });

      return this.success(null, `${provider} account linked successfully`);
    } catch (error) {
      return this.handleError(error, "linkProvider");
    }
  }

  async unlinkProvider(userId: string): Promise<ServiceResponse> {
    try {
      // Get current user
      const user = await this.userRepository.findUserById(userId);

      if (!user) {
        return this.failure("User not found");
      }

      // Don't allow unlinking if user has no password (OAuth only)
      if (!user.password) {
        return this.failure(
          "Cannot unlink provider. Please set a password first."
        );
      }

      // Reset to email provider
      await this.userRepository.updateUser(userId, {
        provider: ProviderEnum.EMAIL,
      });

      return this.success(null, "Provider unlinked successfully");
    } catch (error) {
      return this.handleError(error, "unlinkProvider");
    }
  }

  async setPasswordForOAuthUser(
    userId: string,
    password: string
  ): Promise<ServiceResponse> {
    try {
      // Get current user
      const user = await this.userRepository.findUserById(userId);

      if (!user) {
        return this.failure("User not found");
      }

      // Check if user already has a password
      if (user.password) {
        return this.failure(
          "User already has a password. Use change password instead."
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        password,
        securityConfig.bcryptRounds
      );

      // Update user with password
      await this.userRepository.updateUser(userId, {
        password: hashedPassword,
      });

      return this.success(null, "Password set successfully");
    } catch (error) {
      return this.handleError(error, "setPasswordForOAuthUser");
    }
  }

  async getOAuthAuthUrl(
    provider: ProviderEnum,
    redirectUri: string,
    role?: string
  ): Promise<ServiceResponse<{ authUrl: string, state: string }>> {
    return this.oauthService.generateAuthUrl(provider, redirectUri, role as RoleEnum);
  }

  async exchangeOAuthCode(
    provider: ProviderEnum,
    code: string,
    redirectUri: string
  ): Promise<ServiceResponse<{ accessToken: string }>> {
    const result = await this.oauthService.exchangeCodeForToken(
      provider,
      code,
      redirectUri
    );
    if (!result.success) {
      return this.failure(result.message);
    }

    return this.success(
      { accessToken: result.data!.accessToken },
      "Code exchanged successfully"
    );
  }

  private async generateTokens(
    user: Pick<User, "id" | "email" | "role" | "permissions">
  ): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    const accessToken = jwt.sign(payload, jwtConfig.secret, {
      expiresIn: "7d",
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      jwtConfig.refreshSecret,
      {
        expiresIn: "30d",
      }
    );

    const decoded = jwt.decode(accessToken) as any;
    const expiresAt = new Date(decoded.exp * 1000);

    return { accessToken, refreshToken, expiresAt };
  }

  private generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    try {
      // Generate 6-digit verification code
      const verificationCode = this.generateSixDigitCode();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // Invalidate any existing verification codes
      await this.prisma.verificationToken.updateMany({
        where: {
          userId: user.id,
          type: TokenType.EMAIL_VERIFICATION,
          used: false,
        },
        data: {
          used: true,
        },
      });

      // Save verification code
      await this.userRepository.createVerificationToken({
        token: verificationCode,
        type: TokenType.EMAIL_VERIFICATION,
        userId: user.id,
        email: user.email,
        expiresAt,
      });

      // Send email with 6-digit code
      await this.emailService.sendVerificationCode(
        user.email,
        user.firstName,
        verificationCode,
        "email_verification"
      );
    } catch (error) {
      logger.error("Failed to send verification email:", error);
    }
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, jwtConfig.secret);
    } catch (error) {
      throw new Error("Invalid token");
    }
  }
}
