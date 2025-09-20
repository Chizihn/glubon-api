// src/services/PlatformService.ts
import { Prisma, PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";

type PlatformSettingKey = 
  | 'PLATFORM_ACCOUNT_ID'
  | 'MAINTENANCE_MODE'
  | 'CURRENCY'
  | 'DEFAULT_SUBACCOUNT_PERCENTAGE'
  | string; // Allow for custom settings

// Define a more specific type for platform setting values
type PlatformSettingValue = 
  | string 
  | number 
  | boolean 
  | Record<string, unknown> 
  | Array<unknown>;

export class PlatformService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  // ====================
  // Platform Settings
  // ====================

  /**
   * Get a platform setting by key
   */
  async getSetting<T = any>(key: PlatformSettingKey): Promise<T | null> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    
    if (!setting) return null;
    
    try {
      // Parse the JSON string back to an object
      return JSON.parse(setting.value as string) as T;
    } catch (error) {
      // If parsing fails, return the raw value (for backward compatibility)
      return setting.value as unknown as T;
    }
  }

  /**
   * Set a platform setting
   */
  async setSetting(
    key: PlatformSettingKey, 
    value: PlatformSettingValue,
    description?: string
  ) {
    // Get the current user ID for audit purposes
    const updatedBy = 'system'; // In a real app, this would be the current user's ID
    
    // Convert the value to a JSON string for storage
    const jsonValue = JSON.stringify(value);
    
    return this.prisma.platformSetting.upsert({
      where: { key },
      update: { 
        value: jsonValue,
        ...(description ? { description } : {}),
        updatedBy
      },
      create: { 
        key, 
        value: jsonValue, 
        ...(description ? { description } : {}),
        updatedBy
      },
    });
  }

  // ====================
  // Super Admin Management
  // ====================

  /**
   * Get or create the platform's main admin account ID
   */
  async getPlatformAccountId(): Promise<string> {
    const setting = await this.getSetting<{ userId: string }>('PLATFORM_ACCOUNT_ID');
    
    if (setting?.userId) {
      return setting.userId;
    }

    // Find super admin user
    const superAdmin = await this.prisma.user.findFirst({
      where: { permissions: { has: "SUPER_ADMIN" } },
    });

    if (!superAdmin) {
      throw new Error("No super admin account found. Please create a super admin user first.");
    }

    // Save the super admin ID as platform account
    await this.setSetting('PLATFORM_ACCOUNT_ID', { userId: superAdmin.id });
    return superAdmin.id;
  }

  /**
   * Set the platform's main admin account
   */
  async setPlatformAccount(userId: string): Promise<void> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, permissions: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Update user permissions to include SUPER_ADMIN if not already
    if (!user.permissions.includes('SUPER_ADMIN')) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          permissions: { push: 'SUPER_ADMIN' }
        },
      });
    }

    // Save as platform account
    await this.setSetting('PLATFORM_ACCOUNT_ID', { userId });
  }

  // ====================
  // System Status
  // ====================

  /**
   * Check if system is in maintenance mode
   */
  async isMaintenanceMode(): Promise<boolean> {
    const setting = await this.getSetting<boolean>('MAINTENANCE_MODE');
    return setting === true;
  }

  /**
   * Set maintenance mode
   */
  async setMaintenanceMode(enabled: boolean): Promise<void> {
    await this.setSetting('MAINTENANCE_MODE', enabled, 'Whether the platform is in maintenance mode');
  }

  // ====================
  // Subaccount Defaults
  // ====================

  /**
   * Get default subaccount percentage
   */
  async getDefaultSubaccountPercentage(): Promise<number> {
    const percentage = await this.getSetting<number>('DEFAULT_SUBACCOUNT_PERCENTAGE');
    return percentage ?? 80; // Default to 80% for property owners
  }

  /**
   * Set default subaccount percentage
   */
  async setDefaultSubaccountPercentage(percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    await this.setSetting(
      'DEFAULT_SUBACCOUNT_PERCENTAGE', 
      percentage,
      'Default percentage for property owner subaccounts (0-100)'
    );
  }

  // ====================
  // Utility Methods
  // ====================

  /**
   * Generate a unique reference string
   */
  /**
   * Generate a unique reference string
   * @param prefix - Prefix for the reference (e.g., 'TXN', 'BOOK')
   * @returns A unique reference string
   */
  private generateReference(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
}
