import {
  PrismaClient,
  PropertyStatus,
  RoleEnum,
  NotificationType,
  UserStatus,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { emailServiceSingleton } from "./email";
import { IBaseResponse } from "../types";
import {
  AdminPropertyFilters,
  AdminStats,
  AdminUserFilters,
  AnalyticsDateRange,
  ReviewVerificationInput,
  UpdatePropertyStatusInput,
  UpdateUserStatusInput,
} from "../types/services/admin";
import { ForbiddenError, NotFoundError } from "../utils";
import { NotificationService } from "./notification";
import { AdminRepository } from "../repository/admin";

export class AdminService extends BaseService {
  private emailService = emailServiceSingleton;
  private notificationService: NotificationService;
  private repository: AdminRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    // emailService is now a singleton, already assigned above
    this.notificationService = new NotificationService(prisma, redis);
    this.repository = new AdminRepository(prisma, redis);
  }

  async getDashboardStats(adminId: string): Promise<IBaseResponse<AdminStats>> {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_DASHBOARD_STATS");
      const stats = await this.repository.getDashboardStats();
      return this.success(stats, "Dashboard stats retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getDashboardStats");
    }
  }

  async getAllUsers(
    adminId: string,
    filters: AdminUserFilters = {},
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{ users: any[]; totalCount: number; pagination: any }>
  > {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_USERS", {
        filters,
        page,
        limit,
      });
      const { users, totalCount } = await this.repository.getAllUsers(
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
        { users, totalCount, pagination },
        "Users retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getAllUsers");
    }
  }

  async getUserById(
    adminId: string,
    userId: string
  ): Promise<IBaseResponse<any>> {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_USER_DETAILS", {
        userId,
      });
      const user = await this.repository.getUserById(userId);
      if (!user) return this.failure("User not found");
      return this.success(user, "User details retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getUserById");
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

      if (!user) throw new NotFoundError("User not found");
      if (user.role === RoleEnum.ADMIN && status === UserStatus.SUSPENDED)
        throw new ForbiddenError("Cannot suspend admin users");

      await this.repository.updateUserStatus(
        userId,
        status,
        status === UserStatus.ACTIVE
      );
      await this.repository.logAdminAction(adminId, "UPDATE_USER_STATUS", {
        userId,
        oldStatus: user.status,
        newStatus: status,
        reason,
      });

      let notificationType: NotificationType;
      let notificationTitle: string;
      let notificationMessage: string;

      switch (status) {
        case UserStatus.SUSPENDED:
          notificationType = NotificationType.ACCOUNT_SUSPENDED;
          notificationTitle = "Account Suspended";
          notificationMessage = reason
            ? `Your account has been suspended. Reason: ${reason}`
            : "Your account has been suspended.";
          break;
        case UserStatus.BANNED:
          notificationType = NotificationType.ACCOUNT_SUSPENDED;
          notificationTitle = "Account Banned";
          notificationMessage = reason
            ? `Your account has been banned. Reason: ${reason}`
            : "Your account has been banned.";
          break;
        case UserStatus.ACTIVE:
          notificationType = NotificationType.ACCOUNT_REACTIVATED;
          notificationTitle = "Account Reactivated";
          notificationMessage =
            "Your account has been reactivated. You can now access all features.";
          break;
        default:
          notificationType = NotificationType.SYSTEM_UPDATE;
          notificationTitle = "Account Status Updated";
          notificationMessage = `Your account status has been updated to ${status}.`;
      }

      await this.notificationService.createNotification({
        userId,
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        data: { reason, adminId },
      });

      return this.success(null, `User status updated to ${status}`);
    } catch (error: unknown) {
      return this.handleError(error, "updateUserStatus");
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

  async getDashboardAnalytics(
    adminId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<any>> {
    try {
      await this.repository.logAdminAction(adminId, "VIEW_ANALYTICS", {
        dateRange,
      });
      const analytics = await this.repository.getDashboardAnalytics(dateRange);
      return this.success(analytics, "Analytics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getDashboardAnalytics");
    }
  }
}
