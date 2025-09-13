import { PrismaClient, RoleEnum, PermissionEnum } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService, CACHE_TTL } from "./base";
import { ServiceResponse } from "../types";



interface UserSettingInput {
  notificationPreferences?: Record<string, boolean>;
  theme?: string;
  language?: string;
  receivePromotions?: boolean;
  pushNotifications?: boolean;
}

interface PlatformSettingInput {
  key: string;
  value: string;
  description?: string;
}

export class SettingsService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async getUserSettings(userId: string): Promise<ServiceResponse<any>> {
    try {
      const cacheKey = this.generateCacheKey("userSettings", userId);
      const cached = await this.getCache<any>(cacheKey);
      if (cached) return this.success(cached);

      const userSettings = await this.prisma.userSetting.findUnique({
        where: { userId }
      });

      if (!userSettings) {
        // Return default settings if none exist
        const defaultSettings = {
          notificationPreferences: {},
          theme: 'light',
          language: 'en',
          receivePromotions: true,
          pushNotifications: true
        };
        return this.success(defaultSettings);
      }

      await this.setCache(cacheKey, userSettings, CACHE_TTL.LONG);
      return this.success(userSettings);
    } catch (error) {
      return this.handleError(error, "getUserSettings");
    }
  }

  async updateUserSettings(
    userId: string,
    input: UserSettingInput
  ): Promise<ServiceResponse<any>> {
    try {
      const updatedSettings = await this.prisma.userSetting.upsert({
        where: { userId },
        update: {
          ...input,
          updatedAt: new Date(),
          notificationPreferences: input.notificationPreferences ?? {},
        },
        create: {
          userId,
          ...input,
          notificationPreferences: input.notificationPreferences ?? {},
        },
      });

      const cacheKey = this.generateCacheKey("userSettings", userId);
      await this.setCache(cacheKey, updatedSettings, CACHE_TTL.LONG);
      await this.deleteCachePattern(`userSettings:${userId}:*`);

      return this.success(updatedSettings, "User settings updated successfully");
    } catch (error) {
      return this.handleError(error, "updateUserSettings");
    }
  }

  async getPlatformSettings(
    userId: string,
    userRole: RoleEnum,
    userPermissions: PermissionEnum[]
  ): Promise<ServiceResponse<any[]>> {
    try {
      // Only ADMIN or SUPER_ADMIN can view platform settings
      if (
        userRole !== RoleEnum.ADMIN &&
        !userPermissions.includes(PermissionEnum.SUPER_ADMIN)
      ) {
        return this.failure("Unauthorized: Insufficient permissions", [], [
          { message: "Only admins can view platform settings", code: "FORBIDDEN" },
        ]);
      }

      const cacheKey = this.generateCacheKey("platformSettings", "all");
      const cached = await this.getCache<any[]>(cacheKey);
      if (cached) return this.success(cached);

      const settings = await this.prisma.platformSetting.findMany({
        orderBy: { key: "asc" },
        include: { updater: { select: { id: true, email: true } } },
      });

      await this.setCache(cacheKey, settings, CACHE_TTL.VERY_LONG as any);
      return this.success(settings);
    } catch (error) {
      return this.handleError(error, "getPlatformSettings");
    }
  }

  async updatePlatformSetting(
    userId: string,
    userPermissions: PermissionEnum[],
    input: PlatformSettingInput
  ): Promise<ServiceResponse<any>> {
    try {
      // Only SUPER_ADMIN can update platform settings
      if (!userPermissions.includes(PermissionEnum.SUPER_ADMIN)) {
        return this.failure("Unauthorized: Insufficient permissions", null, [
          { message: "Only super admins can update platform settings", code: "FORBIDDEN" },
        ]);
      }

      const data = {
        value: input.value,
        description: input.description || null,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      const setting = await this.prisma.platformSetting.upsert({
        where: { key: input.key },
        update: data,
        create: {
          key: input.key,
          ...data,
        },
        include: { updater: { select: { id: true, email: true } } }
      });

      const cacheKey = this.generateCacheKey("platformSettings", "all");
      await this.deleteCache(cacheKey);
      await this.warmCache([
        {
          key: cacheKey,
          dataFetcher: async () => {
            return this.prisma.platformSetting.findMany({
              orderBy: { key: "asc" },
              include: { updater: { select: { id: true, email: true } } },
            });
          },
          ttl: CACHE_TTL.VERY_LONG,
        },
      ]);

      return this.success(setting, "Platform setting updated successfully");
    } catch (error) {
      return this.handleError(error, "updatePlatformSetting");
    }
  }
}