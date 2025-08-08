import {
  DocumentType,
  UserStatus,
  VerificationStatus,
  PrismaClient,
  User,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { ServiceResponse } from "../types";
import { securityConfig } from "../config";
import { UserRepository } from "../repository/user";

import { BaseService } from "./base";
import {
  ChangePasswordInput,
  SubmitIdentityVerificationInput,
  UpdateProfileInput,
  UserWithStats,
} from "../types/services/user";

export class UserService extends BaseService {
  private userRepository: UserRepository;

  constructor(prisma: PrismaClient, redis: any) {
    super(prisma, redis);
    this.userRepository = new UserRepository(prisma, redis);
  }

  async getUserProfile(
    userId: string
  ): Promise<ServiceResponse<Partial<User> | null>> {
    try {
      const user = await this.userRepository.getUserProfile(userId);

      if (!user) {
        return this.failure<UserWithStats | null>("User not found", null);
      }

      return this.success(user, "User profile retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getUserProfile");
    }
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<ServiceResponse<UserWithStats>> {
    try {
      // Check if phone number is already taken by another user
      if (input.phoneNumber) {
        const existingUser = await this.userRepository.findUserByEmailOrPhone(
          "",
          input.phoneNumber
        );

        if (existingUser && existingUser.id !== userId) {
          return this.failure("Phone number is already taken");
        }
      }

      const updatedUser = await this.userRepository.updateUser(userId, input);

      // Clear cache
      await this.deleteCache(this.generateCacheKey("user_profile", userId));

      return this.success(updatedUser, "Profile updated successfully");
    } catch (error) {
      return this.handleError(error, "updateProfile");
    }
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<ServiceResponse> {
    try {
      const { currentPassword, newPassword } = input;

      // Get user with password
      const user = await this.userRepository.findUserById(userId);

      if (!user || !user.password) {
        return this.failure("User not found");
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isValidPassword) {
        return this.failure("Current password is incorrect");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(
        newPassword,
        securityConfig.bcryptRounds
      );

      // Update password and invalidate all sessions
      await this.userRepository.updateUser(userId, {
        password: hashedPassword,
        refreshToken: null,
      });

      return this.success(null, "Password changed successfully");
    } catch (error) {
      return this.handleError(error, "changePassword");
    }
  }

  async submitIdentityVerification(
    userId: string,
    input: SubmitIdentityVerificationInput
  ): Promise<ServiceResponse> {
    try {
      const { documentType, documentNumber, documentImages } = input;

      // Check if user already has a pending or approved verification
      const existingVerification =
        await this.userRepository.findIdentityVerification(userId);

      if (
        existingVerification &&
        (existingVerification.status === VerificationStatus.APPROVED ||
          existingVerification.status === VerificationStatus.PENDING)
      ) {
        return this.failure(
          existingVerification.status === VerificationStatus.APPROVED
            ? "Identity already verified"
            : "Identity verification already pending"
        );
      }

      // Create new verification request
      const verification = await this.userRepository.createIdentityVerification(
        userId,
        { documentType, documentNumber, documentImages }
      );

      return this.success(
        verification,
        "Identity verification submitted successfully"
      );
    } catch (error) {
      return this.handleError(error, "submitIdentityVerification");
    }
  }

  async getIdentityVerificationStatus(
    userId: string
  ): Promise<ServiceResponse> {
    try {
      const verification = await this.userRepository.findIdentityVerification(
        userId
      );

      return this.success(
        verification,
        "Identity verification status retrieved"
      );
    } catch (error) {
      return this.handleError(error, "getIdentityVerificationStatus");
    }
  }

  async deactivateAccount(userId: string): Promise<ServiceResponse> {
    try {
      await this.userRepository.updateUser(userId, {
        isActive: false,
        status: UserStatus.SUSPENDED,
        refreshToken: null,
      });

      // Clear cache
      await this.deleteCache(this.generateCacheKey("user_profile", userId));

      return this.success(null, "Account deactivated successfully");
    } catch (error) {
      return this.handleError(error, "deactivateAccount");
    }
  }

  async getUserStats(userId: string): Promise<ServiceResponse> {
    try {
      const stats = await this.userRepository.getUserStats(userId);

      if (!stats) {
        return this.failure("User not found");
      }

      return this.success(stats, "User stats retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getUserStats");
    }
  }

  async searchUsers(
    query: string,
    page = 1,
    limit = 10
  ): Promise<ServiceResponse> {
    try {
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      const { users, total } = await this.userRepository.searchUsers(
        query,
        skip,
        validatedLimit
      );

      const pagination = this.buildPagination(page, validatedLimit, total);

      return this.success(
        { users, pagination },
        "Users search completed successfully"
      );
    } catch (error) {
      return this.handleError(error, "searchUsers");
    }
  }
}
