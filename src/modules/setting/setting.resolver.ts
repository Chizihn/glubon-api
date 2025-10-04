import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import type { Context } from "../../types/context";
import { getContainer } from "../../services";
import { SettingsService } from "../../services/setting";
import {
  UserSetting,
  PlatformSetting,
  PaginatedPlatformSettingsResponse,
} from "./setting.types";
import {
  UserSettingInput,
  PlatformSettingInput,
  PlatformSettingFilter,
} from "./setting.inputs";
import {
  RoleEnum,
  PermissionEnum,
  Prisma,
  ProviderEnum,
  UserStatus,
  PrismaClient,
} from "@prisma/client";
import { AuthMiddleware } from "../../middleware/auth";

@Resolver()
export class SettingsResolver {
  private settingsService: SettingsService;
  private prisma: PrismaClient;

  constructor() {
    const container = getContainer();
    this.settingsService = container.resolve('settingsService');
    this.prisma = container.getPrisma();
  }

  @Query(() => UserSetting, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async getUserSettings(@Ctx() ctx: Context): Promise<UserSetting | null> {
    const result = await this.settingsService.getUserSettings(ctx.user!.id);
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Mutation(() => UserSetting)
  @UseMiddleware(AuthMiddleware)
  async updateUserSettings(
    @Arg("input") input: UserSettingInput,
    @Ctx() ctx: Context
  ): Promise<UserSetting> {
    const result = await this.settingsService.updateUserSettings(
      ctx.user!.id,
      input
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => PaginatedPlatformSettingsResponse)
  @UseMiddleware(AuthMiddleware)
  async getPlatformSettings(
    @Arg("filters", { nullable: true }) filters: PlatformSettingFilter,
    @Arg("page", { defaultValue: 1 }) page: number,
    @Arg("limit", { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedPlatformSettingsResponse> {
    const result = await this.settingsService.getPlatformSettings(
      ctx.user!.id,
      ctx.user!.role,
      ctx.user!.permissions
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    const where: Prisma.PlatformSettingWhereInput = {};
    if (filters?.key) {
      where.key = { contains: filters.key, mode: "insensitive" };
    }
    if (filters?.search) {
      where.OR = [
        { key: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [settings, totalCount] = await this.prisma.$transaction([
      this.prisma.platformSetting.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { key: "asc" },
        include: {
          updater: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              permissions: true,
              isActive: true,
              status: true,
              provider: true,
              phoneNumber: true,
              profilePic: true,
              address: true,
              city: true,
              state: true,
              country: true,
              refreshToken: true,
              lastLogin: true,
              isVerified: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.platformSetting.count({ where }),
    ]);

    // Convert the raw database result to PlatformSetting objects
    const platformSettings = settings.map((setting) => ({
      ...setting,
      value: String(setting.value), // Convert JsonValue to string
      updater: setting.updater
        ? {
            id: setting.updater.id,
            email: setting.updater.email,
            // Add required User fields with default values
            firstName: setting.updater.firstName || "",
            lastName: setting.updater.lastName || "",
            isVerified: false,
            role: setting.updater.role || "USER",
            permissions: setting.updater.permissions || [],
            isActive: setting.updater.isActive ?? true,
            status: UserStatus.ACTIVE,
            provider: ProviderEnum.EMAIL,
            createdAt: setting.updater.createdAt || new Date(),
            updatedAt: setting.updater.updatedAt || new Date(),
            // Add other required fields with default values
            phoneNumber: null,
            profilePic: null,
            address: null,
            city: null,
            state: null,
            country: "Nigeria",
            refreshToken: null,
            lastLogin: null,
          }
        : null,
    }));

    return new PaginatedPlatformSettingsResponse(
      platformSettings,
      page,
      limit,
      totalCount
    );
  }

  @Mutation(() => PlatformSetting)
  @UseMiddleware(AuthMiddleware)
  async updatePlatformSetting(
    @Arg("input") input: PlatformSettingInput,
    @Ctx() ctx: Context
  ): Promise<PlatformSetting> {
    const result = await this.settingsService.updatePlatformSetting(
      ctx.user!.id,
      ctx.user!.permissions,
      input
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }
}
