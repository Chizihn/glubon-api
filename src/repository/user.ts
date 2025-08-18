import {
  PrismaClient,
  User,
  ProviderEnum,
  RoleEnum,
  TokenType,
  DocumentType,
  VerificationStatus,
  UserStatus,
} from "@prisma/client";
import { BaseRepository } from "./base";
import { RegisterInput } from "../types/services/auth";
import { SubmitIdentityVerificationInput } from "../modules/user/user.inputs";

export class UserRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: any) {
    super(prisma, redis);
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async findUserByEmailOrPhone(email: string, phoneNumber?: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phoneNumber ? [{ phoneNumber }] : [])],
      },
    });
  }

  async createUser(data: RegisterInput) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password || null,
        phoneNumber: data.phoneNumber || null,
        role: data.role,
        provider: data.provider || ProviderEnum.EMAIL,
      },
    });
  }

  async updateUser(userId: string, data: Partial<User>) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
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
        provider: true,
        isVerified: true,
        isActive: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        password: true, // Include password to match User type
        refreshToken: true, // Include refreshToken to match User type
      },
    });
  }

  async createVerificationToken(data: {
    token: string;
    type: TokenType;
    userId: string;
    email: string;
    expiresAt: Date;
  }) {
    return this.prisma.verificationToken.create({
      data,
    });
  }

  async findVerificationToken(token: string, type: TokenType) {
    return this.prisma.verificationToken.findFirst({
      where: {
        token,
        type,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  }

  async updateVerificationToken(tokenId: string, data: { used: boolean }) {
    return this.prisma.verificationToken.update({
      where: { id: tokenId },
      data,
    });
  }

  async findIdentityVerification(userId: string) {
    return this.prisma.identityVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        documentType: true,
        status: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
    });
  }

  async createIdentityVerification(
    userId: string,
    data: SubmitIdentityVerificationInput
  ) {
    return this.prisma.identityVerification.create({
      data: {
        userId,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        documentImages: data.documentImages,
        status: VerificationStatus.PENDING,
      },
    });
  }

  async getUserProfile(userId: string) {
    const cacheKey = this.generateCacheKey("user_profile", userId);
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
        provider: true,
        isVerified: true,
        isActive: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,


        _count: {
          select: {
            properties: true,
            propertyLikes: true,
            propertyViews: true,
            userConversations: true,
            notifications: true,
          },
        },
      },
    });

    if (user) await this.setCache(cacheKey, user, 600);
    return user;
  }

  async getUserStats(userId: string) {
    const cacheKey = this.generateCacheKey("user_stats", userId);
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const stats = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: {
            properties: true,
            propertyLikes: true,
            propertyViews: true,
            userConversations: true,
            notifications: { where: { isRead: false } },
          },
        },
      },
    });

    if (!stats) return null;

    const userStats = {
      propertiesCount: stats._count.properties,
      likedPropertiesCount: stats._count.propertyLikes,
      viewedPropertiesCount: stats._count.propertyViews,
      conversationsCount: stats._count.userConversations,
      unreadNotificationsCount: stats._count.notifications,
    };

    await this.setCache(cacheKey, userStats, 300);
    return userStats;
  }

  async searchUsers(query: string, skip: number, limit: number) {
    const where = {
      AND: [
        { isActive: true },
        {
          OR: [
            { firstName: { contains: query, mode: "insensitive" as const } },
            { lastName: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        },
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePic: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}
