import { Prisma } from "@prisma/client";
import {
  PrismaClient,
  UserStatus,
  RoleEnum,
  PermissionEnum,
  VerificationStatus,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseRepository } from "./base";
import {
  AdminUserFilters,
  AdminListFilters,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from "../types/services/admin";
import { logger } from "../utils";

import { Service } from "typedi";

@Service()
export class AdminUsersRepository extends BaseRepository {
  // Constructor removed to use BaseRepository's constructor with injection

  /**
   * Get all users (excluding admin roles unless specified)
   */
  async getAllUsers(
    filters: AdminUserFilters,
    page: number,
    limit: number,
    includeAdmins = false
  ): Promise<{ users: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "users",
      JSON.stringify(filters),
      page.toString(),
      limit.toString(),
      includeAdmins.toString()
    );

    const cached = await this.getCache<{ users: any[]; totalCount: number }>(
      cacheKey
    );
    if (cached) return cached;

    const where = this.buildUserWhereClause(filters, includeAdmins);

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          profilePic: true,
          address: true,
          city: true,
          state: true,
          country: true,
          role: true,
          permissions: true,
          isVerified: true,
          isActive: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          // _count: {
          //   select: {
          //     properties: true,
          //     propertyLikes: true,
          //     userConversations: true,
          //     propertyViews: true,
          //   },
          // },
          // identityVerifications: {
          //   select: {
          //     id: true,
          //     status: true,
          //     documentType: true,
          //     createdAt: true,
          //     reviewedAt: true,
          //   },
          //   orderBy: { createdAt: "desc" },
          //   take: 1,
          // },
        },
        skip,
        take: validatedLimit,
        orderBy: this.buildUserOrderBy(filters.sortBy, filters.sortOrder),
      }),
      this.prisma.user.count({ where }),
    ]);

    const result = { users, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async reviewVerification(
    verificationId: string,
    approved: boolean,
    adminId: string,
    reason?: string
  ): Promise<{
    userId: string;
    userEmail: string;
    userFirstName: string;
    documentType: string;
  }> {
    const verification = await this.prisma.identityVerification.findUnique({
      where: { id: verificationId },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });

    if (!verification) throw new Error("Verification not found");
    if (verification.status !== VerificationStatus.PENDING)
      throw new Error("Verification has already been reviewed");

    await this.prisma.identityVerification.update({
      where: { id: verificationId },
      data: {
        status: approved
          ? VerificationStatus.APPROVED
          : VerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: { set: approved ? null : reason ?? null },
      },
    });

    if (approved) {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: { isVerified: true },
      });
    }

    await this.deleteCachePattern(`user:${verification.userId}:*`);
    return {
      userId: verification.userId,
      userEmail: verification.user.email,
      userFirstName: verification.user.firstName,
      documentType: verification.documentType,
    };
  }

  /**
   * Get all admin users with permission filtering
   */
  async getAllAdmins(
    filters: AdminListFilters,
    page: number,
    limit: number
  ): Promise<{ admins: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "admins",
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );

    const cached = await this.getCache<{ admins: any[]; totalCount: number }>(
      cacheKey
    );
    if (cached) return cached;

    const where = this.buildAdminWhereClause(filters);

    const [admins, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          profilePic: true,
          role: true,
          permissions: true,
          isActive: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              adminActionLogs: true,
            },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    const result = { admins, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(userId: string, includeFullDetails = true): Promise<any> {
    const cacheKey = this.generateCacheKey(
      "admin",
      "user",
      userId,
      includeFullDetails.toString()
    );
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    // First fetch the user to check their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) return null;

    // Then fetch the full user data with appropriate includes
    const fullUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        properties: includeFullDetails
          ? {
              select: {
                id: true,
                title: true,
                status: true,
                amount: true,
                city: true,
                state: true,
                createdAt: true,
                featured: true,
                _count: {
                  select: {
                    likes: true,
                    views: true,
                    conversations: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            }
          : false,
        identityVerifications: includeFullDetails
          ? {
              orderBy: { createdAt: "desc" },
              take: 5,
            }
          : false,
        propertyLikes: includeFullDetails
          ? {
              include: {
                property: {
                  select: {
                    id: true,
                    title: true,
                    amount: true,
                    city: true,
                    state: true,
                  },
                },
              },
              take: 10,
            }
          : false,
        adminActionLogs:
          includeFullDetails && user.role === RoleEnum.ADMIN
            ? {
                select: {
                  id: true,
                  action: true,
                  data: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 20,
              }
            : false,
        _count: {
          select: {
            properties: true,
            propertyLikes: true,
            userConversations: true,
            propertyViews: true,
            adminActionLogs: true,
          },
        },
      },
    });

    if (!fullUser) return null;

    await this.setCache(cacheKey, fullUser, 600);
    return fullUser;
  }

  /**
   * Create new admin user
   */
  async createAdminUser(
    input: CreateAdminUserInput,
    creatorId: string
  ): Promise<any> {
    const hashedPassword = await this.hashPassword(input.password);

    const newAdmin = await this.prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber || "",
        password: hashedPassword,
        role: RoleEnum.ADMIN,
        permissions: input.permissions,
        isVerified: true,
        isActive: true,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        permissions: true,
        isActive: true,
        status: true,
        createdAt: true,
      },
    });

    // Log the admin creation
    await this.prisma.adminActionLog.create({
      data: {
        adminId: creatorId,
        action: "CREATE_ADMIN_USER",
        data: {
          newAdminId: newAdmin.id,
          email: newAdmin.email,
          permissions: newAdmin.permissions,
        },
      },
    });

    // Clear admin caches
    await this.deleteCachePattern("admin:admins:*");

    return newAdmin;
  }

  /**
   * Update admin user
   */
  async updateAdminUser(
    adminId: string,
    input: UpdateAdminUserInput,
    updaterId: string
  ): Promise<any> {
    const updateData: any = {
      ...input,
    };

    if (input.password) {
      updateData.password = await this.hashPassword(input.password);
    }

    const updatedAdmin = await this.prisma.user.update({
      where: { id: adminId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        permissions: true,
        isActive: true,
        status: true,
        updatedAt: true,
      },
    });

    // Log the admin update
    await this.prisma.adminActionLog.create({
      data: {
        adminId: updaterId,
        action: "UPDATE_ADMIN_USER",
        data: JSON.parse(JSON.stringify({
          targetAdminId: adminId,
          changes: input,
        })) as Prisma.InputJsonValue,
      },
    });

    // Clear caches
    await this.deleteCachePattern(`admin:user:${adminId}:*`);
    await this.deleteCachePattern("admin:admins:*");

    return updatedAdmin;
  }

  async getAdminLogs(
    page: number,
    limit: number
  ): Promise<{ logs: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "logs",
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{ logs: any[]; totalCount: number }>(
      cacheKey
    );
    if (cached) return cached;

    const [logs, totalCount] = await Promise.all([
      this.prisma.adminActionLog.findMany({
        include: {
          admin: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.adminActionLog.count(),
    ]);

    const result = { logs, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  /**
   * Update user status (for regular users)
   */
  async updateUserStatus(
    userId: string,
    status: UserStatus,
    isActive: boolean,
    adminId: string,
    reason?: string
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        isActive,
        ...(status !== UserStatus.ACTIVE && { refreshToken: null }),
      },
    });

    // Log the action
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        action: "UPDATE_USER_STATUS",
        data: {
          userId,
          newStatus: status,
          isActive,
          reason,
        },
      },
    });

    await this.deleteCachePattern(`user:${userId}:*`);
    await this.deleteCachePattern("admin:users:*");
  }

  /**
   * Delete admin user (soft delete by deactivating)
   */
  async deleteAdminUser(adminId: string, deleterId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: adminId },
      data: {
        isActive: false,
        status: UserStatus.SUSPENDED,
        refreshToken: null,
      },
    });

    // Log the deletion
    await this.prisma.adminActionLog.create({
      data: {
        adminId: deleterId,
        action: "DELETE_ADMIN_USER",
        data: {
          deletedAdminId: adminId,
        },
      },
    });

    await this.deleteCachePattern(`admin:user:${adminId}:*`);
    await this.deleteCachePattern("admin:admins:*");
  }

  /**
   * Get user activity statistics
   */
  async getUserActivity(
    userId: string,
    days = 30
  ): Promise<{
    propertyViews: number;
    conversationsStarted: number;
    propertiesListed: number;
    loginFrequency: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [propertyViews, conversationsStarted, propertiesListed] =
      await Promise.all([
        this.prisma.propertyView.count({
          where: {
            userId,
            // createdAt: { gte: startDate },
          },
        }),
        this.prisma.conversation.count({
          where: {
            // renterId: userId,
            createdAt: { gte: startDate },
          },
        }),
        this.prisma.property.count({
          where: {
            ownerId: userId,
            createdAt: { gte: startDate },
          },
        }),
      ]);

    // For login frequency, we'd need to track login events
    // This is a placeholder calculation
    const loginFrequency = 0; // Would need login tracking

    return {
      propertyViews,
      conversationsStarted,
      propertiesListed,
      loginFrequency,
    };
  }

  async getVerifications(
    page: number,
    limit: number,
    status?: VerificationStatus,
    search?: string
  ): Promise<{ verifications: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "verifications",
      status || 'all',
      search || 'no-search',
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{
      verifications: any[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { documentNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [verifications, totalCount] = await Promise.all([
      this.prisma.identityVerification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.identityVerification.count({
        where: { status: VerificationStatus.PENDING },
      }),
    ]);

    const result = { verifications, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  private buildUserWhereClause(
    filters: AdminUserFilters,
    includeAdmins = false
  ): any {
    const where: any = {};

    // Exclude admin roles unless specifically requested
    if (!includeAdmins) {
      where.role = { not: RoleEnum.ADMIN };
    }

    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.provider) where.provider = filters.provider;
    if (filters.city)
      where.city = { contains: filters.city, mode: "insensitive" };
    if (filters.state)
      where.state = { contains: filters.state, mode: "insensitive" };
    if (filters.country)
      where.country = { contains: filters.country, mode: "insensitive" };

    if (filters.createdAfter) {
      where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
    }
    if (filters.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phoneNumber: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async logAdminAction(
    adminId: string,
    action: string,
    data?: any
  ): Promise<void> {
    try {
      await this.prisma.adminActionLog.create({
        data: { adminId, action, data: data || {} },
      });
    } catch (error) {
      logger.error("Failed to log admin action:", error);
    }
  }

  private buildAdminWhereClause(filters: AdminListFilters): any {
    const where: any = {
      role: RoleEnum.ADMIN,
    };

    if (filters.permissions && filters.permissions.length > 0) {
      where.permissions = {
        hasEvery: filters.permissions,
      };
    }

    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.status) where.status = filters.status;

    if (filters.createdAfter) {
      where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
    }
    if (filters.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  private buildUserOrderBy(sortBy?: string, sortOrder = "desc"): any {
    const orderBy: any = {};

    switch (sortBy) {
      case "name":
        orderBy.firstName = sortOrder;
        break;
      case "email":
        orderBy.email = sortOrder;
        break;
      case "lastLogin":
        orderBy.lastLogin = sortOrder;
        break;
      case "status":
        orderBy.status = sortOrder;
        break;
      default:
        orderBy.createdAt = sortOrder;
    }

    return orderBy;
  }

  private async hashPassword(password: string): Promise<string> {
    // Use bcrypt or your preferred hashing library
    const bcrypt = require("bcrypt");
    return bcrypt.hash(password, 12);
  }
}