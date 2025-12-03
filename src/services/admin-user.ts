import {
  PrismaClient,
  UserStatus,
  RoleEnum,
  PermissionEnum,
  NotificationType,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { emailServiceSingleton } from "./email";
import { NotificationService } from "./notification";
import { IBaseResponse } from "../types";
import { VerificationStatus } from "@prisma/client";
import {
  AdminUserFilters,
  AdminListFilters,
  CreateAdminUserInput,
  UpdateAdminUserInput,
  UpdateUserStatusInput,
  AdminUserResponse,
  PaginatedUsersResponse,
  ReviewVerificationInput,
} from "../types/services/admin";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils";
import { AdminUsersRepository } from "../repository/admin-user";
import { SubaccountService } from "./subaccount";
import { PaymentQueue } from "../jobs/queues/payment.queue";

export class AdminUsersService extends BaseService {
  private emailService = emailServiceSingleton;
  private notificationService: NotificationService;
  private repository: AdminUsersRepository;
  private subaccountService: SubaccountService;

  /**
   * Get verifications with filtering and pagination
   */
  async getVerifications(
    adminId: string,
    status?: VerificationStatus,
    page = 1,
    limit = 20,
    search?: string
  ): Promise<IBaseResponse<{ verifications: any[]; totalCount: number; pagination: any }>> {
    try {
      await this.repository.logAdminAction(
        adminId,
        status ? `VIEW_${status.toUpperCase()}_VERIFICATIONS` : "VIEW_ALL_VERIFICATIONS"
      );
      
      const { verifications, totalCount } = await this.repository.getVerifications(
        page,
        limit,
        status,
        search
      );
      
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );
      
      return this.success(
        { verifications, totalCount, pagination },
        status 
          ? `${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()} verifications retrieved successfully`
          : "All verifications retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getVerifications");
    }
  }

  constructor(prisma: PrismaClient, redis: Redis, paymentQueue: PaymentQueue) {
    super(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
    this.repository = new AdminUsersRepository(prisma, redis);
    this.subaccountService = new SubaccountService(prisma, redis, paymentQueue);
  }

  /**
   * Get all users with filtering and pagination
   */
  async getAllUsers(
    adminId: string,
    filters: AdminUserFilters = {},
    page = 1,
    limit = 20
  ): Promise<IBaseResponse<PaginatedUsersResponse>> {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_USERS", {
        filters,
        page,
        limit,
      });

      const { users, totalCount } = await this.repository.getAllUsers(
        filters,
        page,
        limit,
        false // Don't include admin users
      );

      const transformedUsers = users.map(this.transformUserToResponse);
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      // Ensure pagination matches PaginationInfo type
      const paginationInfo = {
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
        totalCount: pagination.totalCount,
        hasNextPage: pagination.hasNextPage,
        hasPreviousPage: pagination.hasPreviousPage,
        limit: pagination.limit
      };

      return this.success(
        { items: transformedUsers, pagination: paginationInfo },
        "Users retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getAllUsers");
    }
  }

  /**
   * Get all admin users with permission filtering
   */
  async getAllAdmins(
    adminId: string,
    filters: AdminListFilters = {},
    page = 1,
    limit = 20
  ): Promise<IBaseResponse<PaginatedUsersResponse>> {
    try {

      await this.repository.logAdminAction(adminId, "VIEW_ADMINS", {
        filters,
        page,
        limit,
      });

      const { admins, totalCount } = await this.repository.getAllAdmins(
        filters,
        page,
        limit
      );

      const transformedAdmins = admins.map(this.transformUserToResponse);
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      // Ensure pagination matches PaginationInfo type
      const paginationInfo = {
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
        totalCount: pagination.totalCount,
        hasNextPage: pagination.hasNextPage,
        hasPreviousPage: pagination.hasPreviousPage,
        limit: pagination.limit
      };

      return this.success(
        { items: transformedAdmins, pagination: paginationInfo },
        "Admin users retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getAllAdmins");
    }
  }

  /**
   * Get user by ID with detailed information
   */
  async getUserById(
    adminId: string,
    userId: string,
    includeFullDetails = true
  ): Promise<IBaseResponse<AdminUserResponse>> {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_USER_DETAILS", {
        userId,
        includeFullDetails,
      });

      const user = await this.repository.getUserById(
        userId,
        includeFullDetails
      );
      if (!user) {
        return this.failure("User not found");
      }

      const transformedUser = this.transformUserToResponse(user);
      return this.success(
        transformedUser,
        "User details retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getUserById");
    }
  }

  /**
   * Create new admin user
   */
  async createAdminUser(
    creatorId: string,
    input: CreateAdminUserInput
  ): Promise<IBaseResponse<AdminUserResponse>> {
    try {
      // Check if creator has permission
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        select: { permissions: true, role: true },
      });

      if (!creator?.permissions.includes(PermissionEnum.SUPER_ADMIN)) {
        throw new ForbiddenError(
          "Insufficient permissions to create admin users"
        );
      }

      // Validate input
      await this.validateAdminUserInput(input);

      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new ValidationError("Email already exists");
      }

      const newAdmin = await this.repository.createAdminUser(input, creatorId);
      const transformedAdmin = this.transformUserToResponse(newAdmin);

      // Send welcome email
      await this.emailService.sendAdminWelcomeEmail(
        newAdmin.email,
        newAdmin.firstName,
        input.password
      );

      return this.success(transformedAdmin, "Admin user created successfully");
    } catch (error: unknown) {
      return this.handleError(error, "createAdminUser");
    }
  }

  /**
   * Update admin user
   */
  async updateAdminUser(
    updaterId: string,
    adminId: string,
    input: UpdateAdminUserInput
  ): Promise<IBaseResponse<AdminUserResponse>> {
    try {
      // Check permissions
      const updater = await this.prisma.user.findUnique({
        where: { id: updaterId },
        select: { permissions: true, id: true },
      });

      const targetAdmin = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true, permissions: true },
      });

      if (!targetAdmin || targetAdmin.role !== RoleEnum.ADMIN) {
        throw new NotFoundError("Admin user not found");
      }

      // Only SUPER_ADMIN can update other admins, or users can update themselves (limited fields)
      const canUpdate =
        updater?.permissions.includes(PermissionEnum.SUPER_ADMIN) ||
        updaterId === adminId;

      if (!canUpdate) {
        throw new ForbiddenError(
          "Insufficient permissions to update admin user"
        );
      }

      // If updating self, restrict permissions change
      if (updaterId === adminId && input.permissions) {
        throw new ForbiddenError("Cannot modify your own permissions");
      }

      const updatedAdmin = await this.repository.updateAdminUser(
        adminId,
        input,
        updaterId
      );

      const transformedAdmin = this.transformUserToResponse(updatedAdmin);

      return this.success(transformedAdmin, "Admin user updated successfully");
    } catch (error: unknown) {
      return this.handleError(error, "updateAdminUser");
    }
  }

  /**
   * Update user status (for regular users)
   */
  async updateUserStatus(
    adminId: string,
    input: UpdateUserStatusInput
  ): Promise<IBaseResponse<null>> {
    try {
      const { userId, status, reason } = input;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          role: true,
        },
      });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      if (user.role === RoleEnum.ADMIN) {
        throw new ForbiddenError(
          "Cannot update admin user status through this endpoint"
        );
      }

      if (user.status === status) {
        return this.success(null, "User status is already set to " + status);
      }

      await this.repository.updateUserStatus(
        userId,
        status,
        status === UserStatus.ACTIVE,
        adminId,
        reason
      );

      // Send notification to user
      await this.notificationService.createNotification({
        userId,
        title: this.getStatusChangeTitle(status),
        message: this.getStatusChangeMessage(status, reason),
        type: this.getStatusChangeNotificationType(status),
        data: { reason, adminId, oldStatus: user.status },
      });

      // Send email notification
      await this.emailService.sendUserStatusChangeNotification(
        user.email,
        user.firstName,
        status,
        reason
      );

      return this.success(null, `User status updated to ${status}`);
    } catch (error: unknown) {
      return this.handleError(error, "updateUserStatus");
    }
  }

  /**
   * Deactivate admin user
   */
  async deactivateAdminUser(
    requesterId: string,
    adminId: string
  ): Promise<IBaseResponse<null>> {
    try {
      // Check permissions
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { permissions: true },
      });

      if (!requester?.permissions.includes(PermissionEnum.SUPER_ADMIN)) {
        throw new ForbiddenError(
          "Insufficient permissions to deactivate admin users"
        );
      }

      if (requesterId === adminId) {
        throw new ForbiddenError("Cannot deactivate your own account");
      }

      const targetAdmin = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true, firstName: true, email: true },
      });

      if (!targetAdmin || targetAdmin.role !== RoleEnum.ADMIN) {
        throw new NotFoundError("Admin user not found");
      }

      await this.repository.deleteAdminUser(adminId, requesterId);

      // Send notification email
      await this.emailService.sendAdminDeactivationNotification(
        targetAdmin.email,
        targetAdmin.firstName
      );

      return this.success(null, "Admin user deactivated successfully");
    } catch (error: unknown) {
      return this.handleError(error, "deactivateAdminUser");
    }
  }
  
  async getAdminLogs(
    adminId: string,
    page = 1,
    limit = 50
  ): Promise<
    IBaseResponse<{ logs: any[]; totalCount: number; pagination: any }>
  > {
    try {
      const { logs, totalCount } = await this.repository.getAdminLogs(
        page,
        limit
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );
      return this.success(
        { logs, totalCount, pagination },
        "Admin logs retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getAdminLogs");
    }
  }

  async reviewVerification(
    adminId: string,
    input: ReviewVerificationInput
  ): Promise<IBaseResponse<null>> {
    try {
      const { verificationId, approved, reason } = input;
      const { userId, userEmail, userFirstName, documentType } =
        await this.repository.reviewVerification(
          verificationId,
          approved,
          adminId,
          reason
        );

      await this.repository.logAdminAction(adminId, "REVIEW_VERIFICATION", {
        verificationId,
        userId,
        approved,
        reason,
      });

      // If approved and user is a LISTER, check if they need a subaccount
      if (approved) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { subaccount: true }
        });

        // If user is a lister and doesn't have a subaccount, create one
        if (user?.role === "LISTER" && !user.subaccount) {
          // Check if user has provided bank details during verification
          const verification = await this.prisma.identityVerification.findUnique({
            where: { id: verificationId },
          });

          const metadata = (verification as any)?.metadata;
          
          if (metadata?.bankDetails) {
            const { accountNumber, bankCode, businessName } = metadata.bankDetails;
            
            // Create subaccount automatically
            const subaccountResult = await this.subaccountService.createSubaccount({
              userId,
              accountNumber,
              bankCode,
              businessName: businessName || `${userFirstName}'s Properties`,
              percentageCharge: 85, // Default: lister gets 85%, platform gets 15%
            });

            if (!subaccountResult.success) {
              // Log the error but don't fail the verification
              console.error(`Failed to create subaccount for user ${userId}:`, subaccountResult.message);
              
              // Send notification to admin about subaccount creation failure
              await this.notificationService.createNotification({
                userId: adminId,
                title: "Subaccount Creation Failed",
                message: `Failed to create subaccount for ${userFirstName} (${userEmail}). Reason: ${subaccountResult.message}`,
                type: NotificationType.ADMIN_ALERT,
                data: { 
                  userId, 
                  verificationId, 
                  error: subaccountResult.message 
                },
              });
            } else {
              // Notify user about subaccount creation
              await this.notificationService.createNotification({
                userId,
                title: "Payment Setup Complete",
                message: "Your payment account has been set up successfully. You can now receive payments for your property bookings.",
                type: NotificationType.PAYMENT_SETUP_COMPLETE,
                data: { 
                  subaccountId: subaccountResult.data?.id,
                  subaccountCode: subaccountResult.data?.subaccountCode
                },
              });
            }
          } else {
            // Bank details not provided, notify user to complete payment setup
            await this.notificationService.createNotification({
              userId,
              title: "Complete Payment Setup",
              message: "Your verification is approved! Please complete your payment setup to start receiving payments for bookings.",
              type: NotificationType.ACTION_REQUIRED,
              data: { 
                action: "COMPLETE_PAYMENT_SETUP",
                verificationId 
              },
            });
          }
        }
      }

      await this.notificationService.createNotification({
        userId,
        title: approved
          ? "Identity Verification Approved"
          : "Identity Verification Rejected",
        message: approved
          ? "Your identity verification has been approved. Your account is now verified."
          : reason
          ? `Your identity verification has been rejected. Reason: ${reason}`
          : "Your identity verification has been rejected.",
        type: approved
          ? NotificationType.VERIFICATION_APPROVED
          : NotificationType.VERIFICATION_REJECTED,
        data: { verificationId, reason, adminId },
      });

      await this.emailService.sendIdentityVerificationNotification(
        userEmail,
        userFirstName,
        documentType,
        approved
      );

      return this.success(
        null,
        `Verification ${approved ? "approved" : "rejected"} successfully`
      );
    } catch (error: unknown) {
      return this.handleError(error, "reviewVerification");
    }
  }

  /**
   * Get user activity statistics
   */
  async getUserActivity(
    adminId: string,
    userId: string,
    days = 30
  ): Promise<IBaseResponse<any>> {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_USER_ACTIVITY", {
        userId,
        days,
      });

      const activity = await this.repository.getUserActivity(userId, days);

      return this.success(activity, "User activity retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getUserActivity");
    }
  }

  /**
   * Bulk update user status
   */
  async bulkUpdateUserStatus(
    adminId: string,
    userIds: string[],
    status: UserStatus,
    reason?: string
  ): Promise<IBaseResponse<{ updated: number; failed: string[] }>> {
    try {
      if (userIds.length === 0) {
        throw new ValidationError("No user IDs provided");
      }

      if (userIds.length > 100) {
        throw new ValidationError("Cannot update more than 100 users at once");
      }

      const results = {
        updated: 0,
        failed: [] as string[],
      };

      // Check all users exist and are not admins
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, role: true, email: true, firstName: true },
      });

      const validUserIds = users
        .filter((user) => user.role !== RoleEnum.ADMIN)
        .map((user) => user.id);

      // Update users in batches
      for (const userId of validUserIds) {
        try {
          await this.repository.updateUserStatus(
            userId,
            status,
            status === UserStatus.ACTIVE,
            adminId,
            reason
          );

          const user = users.find((u) => u.id === userId);
          if (user) {
            // Send notification
            await this.notificationService.createNotification({
              userId,
              title: this.getStatusChangeTitle(status),
              message: this.getStatusChangeMessage(status, reason),
              type: this.getStatusChangeNotificationType(status),
              data: { reason, adminId, bulkUpdate: true },
            });
          }

          results.updated++;
        } catch (error) {
          results.failed.push(userId);
        }
      }

      await this.repository.logAdminAction(adminId, "BULK_UPDATE_USER_STATUS", {
        userIds,
        status,
        reason,
        results,
      });

      return this.success(
        results,
        `Bulk update completed. ${results.updated} users updated, ${results.failed.length} failed.`
      );
    } catch (error: unknown) {
      return this.handleError(error, "bulkUpdateUserStatus");
    }
  }


  // Private helper methods

  private transformUserToResponse(user: any): AdminUserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber ?? null,
      profilePic: user.profilePic ?? null,
      address: user.address ?? null,
      city: user.city ?? null,
      state: user.state ?? null,
      country: user.country ?? null,
      role: user.role,
      roles: user.roles || [user.role],
      permissions: user.permissions || [],
      provider: user.provider,
      isVerified: user.isVerified,
      isActive: user.isActive,
      status: user.status,
      lastLogin: user.lastLogin ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        properties: user._count?.properties || 0,
        propertyLikes: user._count?.propertyLikes || 0,
        conversations:
          (user._count?.chatsAsRenter || 0) + (user._count?.chatsAsOwner || 0),
        propertyViews: user._count?.propertyViews || 0,
      },
      properties: user.properties || [],
      identityVerifications: user.identityVerifications || [],
      propertyLikes: user.propertyLikes || [],
      adminActionLogs: user.adminActionLogs || [],
    };
  }

  private async validateAdminUserInput(
    input: CreateAdminUserInput
  ): Promise<void> {
    const errors: string[] = [];

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      errors.push("Invalid email format");
    }

    // Password validation
    if (input.password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    // Name validation
    if (input.firstName.length < 2) {
      errors.push("First name must be at least 2 characters long");
    }
    if (input.lastName.length < 2) {
      errors.push("Last name must be at least 2 characters long");
    }

    // Permissions validation
    if (!input.permissions || input.permissions.length === 0) {
      errors.push("At least one permission must be assigned");
    }

    const validPermissions = Object.values(PermissionEnum);
    const invalidPermissions = input.permissions.filter(
      (p) => !validPermissions.includes(p)
    );
    if (invalidPermissions.length > 0) {
      errors.push(`Invalid permissions: ${invalidPermissions.join(", ")}`);
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join("; "));
    }
  }

  private getStatusChangeTitle(status: UserStatus): string {
    switch (status) {
      case UserStatus.ACTIVE:
        return "Account Reactivated";
      case UserStatus.SUSPENDED:
        return "Account Suspended";
      case UserStatus.BANNED:
        return "Account Banned";
      case UserStatus.PENDING_VERIFICATION:
        return "Account Pending Verification";
      default:
        return "Account Status Updated";
    }
  }

  private getStatusChangeMessage(status: UserStatus, reason?: string): string {
    const baseMessage =
      {
        [UserStatus.ACTIVE]:
          "Your account has been reactivated and you can now access all features.",
        [UserStatus.SUSPENDED]: "Your account has been suspended.",
        [UserStatus.BANNED]: "Your account has been banned.",
        [UserStatus.PENDING_VERIFICATION]:
          "Your account is pending verification.",
      }[status] || "Your account status has been updated.";

    return reason ? `${baseMessage} Reason: ${reason}` : baseMessage;
  }

  private getStatusChangeNotificationType(
    status: UserStatus
  ): NotificationType {
    switch (status) {
      case UserStatus.ACTIVE:
        return NotificationType.ACCOUNT_REACTIVATED;
      case UserStatus.SUSPENDED:
      case UserStatus.BANNED:
        return NotificationType.ACCOUNT_SUSPENDED;
      default:
        return NotificationType.SYSTEM_UPDATE;
    }
  }
}