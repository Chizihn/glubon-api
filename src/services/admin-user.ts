import {
  PrismaClient,
  UserStatus,
  RoleEnum,
  PermissionEnum,
  NotificationType,
  PropertyStatus,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { emailServiceSingleton } from "./email";
import { NotificationService } from "./notification";
import { IBaseResponse } from "../types";
import {
  AdminUserFilters,
  AdminListFilters,
  CreateAdminUserInput,
  UpdateAdminUserInput,
  UpdateUserStatusInput,
  AdminUserResponse,
  PaginatedUsersResponse,
  AdminPropertyFilters,
  ReviewVerificationInput,
  UpdatePropertyStatusInput,
} from "../types/services/admin";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils";
import { AdminUsersRepository } from "../repository/admin-user";

export class AdminUsersService extends BaseService {
  private emailService = emailServiceSingleton;
  private notificationService: NotificationService;
  private repository: AdminUsersRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
    this.repository = new AdminUsersRepository(prisma, redis);
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
      // Check if requester has permission to view other admins
      const requester = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: { permissions: true },
      });

      if (!requester?.permissions.includes(PermissionEnum.SUPER_ADMIN)) {
        throw new ForbiddenError(
          "Insufficient permissions to view admin users"
        );
      }

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

  async updatePropertyStatus(
    adminId: string,
    input: UpdatePropertyStatusInput
  ): Promise<IBaseResponse<null>> {
    try {
      const { propertyId, status, reason } = input;
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!property) throw new NotFoundError("Property not found");

      await this.repository.updatePropertyStatus(propertyId, status);
      await this.repository.logAdminAction(adminId, "UPDATE_PROPERTY_STATUS", {
        propertyId,
        oldStatus: property.status,
        newStatus: status,
        reason,
      });

      let notificationType: NotificationType;
      let notificationTitle: string;
      let notificationMessage: string;

      switch (status) {
        case PropertyStatus.ACTIVE:
          notificationType = NotificationType.PROPERTY_APPROVED;
          notificationTitle = "Property Approved";
          notificationMessage = `Your property "${property.title}" has been approved and is now live.`;
          break;
        case PropertyStatus.REJECTED:
          notificationType = NotificationType.PROPERTY_REJECTED;
          notificationTitle = "Property Rejected";
          notificationMessage = reason
            ? `Your property "${property.title}" has been rejected. Reason: ${reason}`
            : `Your property "${property.title}" has been rejected.`;
          break;
        case PropertyStatus.SUSPENDED:
          notificationType = NotificationType.PROPERTY_REJECTED;
          notificationTitle = "Property Suspended";
          notificationMessage = reason
            ? `Your property "${property.title}" has been suspended. Reason: ${reason}`
            : `Your property "${property.title}" has been suspended.`;
          break;
        default:
          notificationType = NotificationType.SYSTEM_UPDATE;
          notificationTitle = "Property Status Updated";
          notificationMessage = `Your property "${property.title}" status has been updated to ${status}.`;
      }

      await this.notificationService.createNotification({
        userId: property.ownerId,
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        data: { propertyId, reason, adminId },
      });

      if (
        status === PropertyStatus.ACTIVE ||
        status === PropertyStatus.REJECTED
      ) {
        await this.emailService.sendPropertyApprovalNotification(
          property.owner.email,
          property.owner.firstName,
          property.title,
          propertyId,
          status === PropertyStatus.ACTIVE
        );
      }

      return this.success(null, `Property status updated to ${status}`);
    } catch (error: unknown) {
      return this.handleError(error, "updatePropertyStatus");
    }
  }

  async getPendingVerifications(
    adminId: string,
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{ verifications: any[]; totalCount: number; pagination: any }>
  > {
    try {
      await this.repository.logAdminAction(
        adminId,
        "VIEW_PENDING_VERIFICATIONS"
      );
      const { verifications, totalCount } =
        await this.repository.getPendingVerifications(page, limit);
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );
      return this.success(
        { verifications, totalCount, pagination },
        "Pending verifications retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getPendingVerifications");
    }
  }

  async getPendingOwnershipVerifications(
    adminId: string,
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{ verifications: any[]; totalCount: number; pagination: any }>
  > {
    try {
      await this.repository.logAdminAction(
        adminId,
        "VIEW_PENDING_OWNERSHIP_VERIFICATIONS"
      );
      const { verifications, totalCount } =
        await this.repository.getPendingOwnershipVerifications(page, limit);
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );
      return this.success(
        { verifications, totalCount, pagination },
        "Pending ownership verifications retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getPendingOwnershipVerifications");
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

  async reviewOwnershipVerification(
    adminId: string,
    verificationId: string,
    approved: boolean,
    reason?: string
  ): Promise<IBaseResponse<null>> {
    try {
      const { propertyId, ownerId, propertyTitle } =
        await this.repository.reviewOwnershipVerification(
          verificationId,
          approved,
          adminId,
          reason
        );

      await this.repository.logAdminAction(
        adminId,
        approved ? "APPROVE_OWNERSHIP" : "REJECT_OWNERSHIP",
        {
          verificationId,
          propertyId,
          ownerId,
          reason,
        }
      );

      await this.notificationService.createNotification({
        userId: ownerId,
        title: approved
          ? "Property Ownership Verified"
          : "Property Ownership Verification Rejected",
        message: approved
          ? `Ownership of "${propertyTitle}" has been verified and is now active.`
          : `Ownership verification for "${propertyTitle}" has been rejected.${
              reason ? ` Reason: ${reason}` : ""
            }`,
        type: approved
          ? NotificationType.PROPERTY_APPROVED
          : NotificationType.PROPERTY_REJECTED,
        data: { propertyId, verificationId, reason, adminId },
      });

      return this.success(
        null,
        `Property ownership verification ${
          approved ? "approved" : "rejected"
        } successfully`
      );
    } catch (error: unknown) {
      return this.handleError(error, "reviewOwnershipVerification");
    }
  }

  async togglePropertyFeatured(
    adminId: string,
    propertyId: string
  ): Promise<IBaseResponse<{ featured: boolean }>> {
    try {
      const { featured, ownerId, title } =
        await this.repository.togglePropertyFeatured(propertyId);

      await this.repository.logAdminAction(
        adminId,
        "TOGGLE_PROPERTY_FEATURED",
        {
          propertyId,
          oldFeatured: !featured,
          newFeatured: featured,
        }
      );

      await this.notificationService.createNotification({
        userId: ownerId,
        title: featured ? "Property Featured" : "Property Unfeatured",
        message: featured
          ? `Your property "${title}" has been featured and will get more visibility.`
          : `Your property "${title}" is no longer featured.`,
        type: NotificationType.SYSTEM_UPDATE,
        data: { propertyId, featured, adminId },
      });

      return this.success(
        { featured },
        `Property ${featured ? "featured" : "unfeatured"} successfully`
      );
    } catch (error: unknown) {
      return this.handleError(error, "togglePropertyFeatured");
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

  async getAllProperties(
    adminId: string,
    filters: AdminPropertyFilters = {},
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{ properties: any[]; totalCount: number; pagination: any }>
  > {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_PROPERTIES", {
        filters,
        page,
        limit,
      });
      const { properties, totalCount } = await this.repository.getAllProperties(
        filters,
        page,
        limit
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );
      return this.success(
        { properties, totalCount, pagination },
        "Properties retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getAllProperties");
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
