//src/services/subaccount.ts
import { PrismaClient, Subaccount, SubaccountStatus } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService, CACHE_TTL } from "./base";
import { ServiceResponse } from "../types";
import { PaystackService } from "./payment";
import { logger } from "../utils";
import { PaymentQueue } from "../jobs/queues/payment.queue";

interface CreateSubaccountInput {
  userId: string;
  accountNumber: string;
  bankCode: string;
  businessName: string;
  percentageCharge?: number;
}

export class SubaccountService extends BaseService {
  private paystackService: PaystackService;

  constructor(prisma: PrismaClient, redis: Redis, paymentQueue: PaymentQueue) {
    super(prisma, redis);
    this.paystackService = new PaystackService(prisma, redis, paymentQueue);
  }

  async createSubaccount(
    input: CreateSubaccountInput
  ): Promise<ServiceResponse<Subaccount>> {
    try {
      const { userId, accountNumber, bankCode, businessName, percentageCharge = 85 } = input;

      // Check if user already has a subaccount
      const existingSubaccount = await this.prisma.subaccount.findUnique({
        where: { userId }
      });

      if (existingSubaccount) {
        return this.failure("User already has a subaccount");
      }

      return await this.prisma.$transaction(async (tx) => {
        // Create local subaccount record first
        const subaccount = await tx.subaccount.create({
          data: {
            userId,
            businessName,
            accountNumber,
            bankCode,
            percentageCharge,
            status: SubaccountStatus.PENDING,
            isActive: false,
          },
        });

        try {
          // Validate account details first
          const validationResult = await this.paystackService.validateSubaccountDetails(
            accountNumber,
            bankCode,
            businessName
          );

          if (!validationResult.success || !validationResult.data?.isValid) {
            await tx.subaccount.update({
              where: { id: subaccount.id },
              data: {
                status: SubaccountStatus.FAILED,
                failureReason: validationResult.message || "Account validation failed",
              },
            });

            return this.failure(
              validationResult.message || "Account validation failed"
            );
          }

          // Create Paystack subaccount
          const paystackResult = await this.paystackService.createSubaccount(
            businessName,
            accountNumber,
            bankCode,
            percentageCharge,
            `Property Lister - ${businessName}`
          );

          if (!paystackResult.success || !paystackResult.data?.data) {
            await tx.subaccount.update({
              where: { id: subaccount.id },
              data: {
                status: SubaccountStatus.FAILED,
                failureReason: paystackResult.message,
              },
            });

            return this.failure(paystackResult.message);
          }

          // Update with Paystack details
          const updatedSubaccount = await tx.subaccount.update({
            where: { id: subaccount.id },
            data: {
              subaccountCode: paystackResult.data.data.subaccount_code,
              paystackSubaccountId: paystackResult.data.data.id,
              accountName: validationResult.data.accountName || null,
              status: SubaccountStatus.ACTIVE,
              isActive: true,
            },
          });

          // Clear any cached data
          await this.deleteCachePattern(`user:${userId}:*`);

          return this.success(updatedSubaccount, 'Subaccount created successfully');
        } catch (error: any) {
          logger.error("Error creating Paystack subaccount:", error);
          const errorMessage = error.message || "Failed to create Paystack subaccount";
          
          await tx.subaccount.update({
            where: { id: subaccount.id },
            data: {
              status: SubaccountStatus.FAILED,
              failureReason: errorMessage,
            },
          });

          return this.failure(errorMessage);
        }
      });
    } catch (error: any) {
      const errorMessage = error.message || "An error occurred while creating the subaccount";
      logger.error("Error in createSubaccount:", errorMessage);
      return this.failure(errorMessage);
    }
  }

  async getSubaccount(userId: string): Promise<ServiceResponse<Subaccount | null>> {
    try {
      const cacheKey = `subaccount:${userId}`;
      const cached = await this.getCache<Subaccount>(cacheKey);
      
      if (cached) {
        return this.success(cached, "Subaccount fetched from cache");
      }

      const subaccount = await this.prisma.subaccount.findUnique({
        where: { userId },
      });

      if (subaccount) {
        await this.setCache(cacheKey, subaccount, CACHE_TTL.SHORT as any);
      }

      return this.success(subaccount, "Subaccount fetched successfully");
    } catch (error) {
      return this.handleError(error, "getSubaccount");
    }
  }

  async updateSubaccountBankDetails(
    userId: string,
    accountNumber: string,
    bankCode: string,
    businessName?: string
  ): Promise<ServiceResponse<Subaccount>> {
    try {
      const existingSubaccount = await this.prisma.subaccount.findUnique({
        where: { userId },
      });

      if (!existingSubaccount) {
        return this.failure("Subaccount not found");
      }

      // Validate new account details
      const validationResult = await this.paystackService.validateSubaccountDetails(
        accountNumber,
        bankCode,
        businessName || existingSubaccount.businessName
      );

      if (!validationResult.success || !validationResult.data?.isValid) {
        return this.failure(
          validationResult.message || "Account validation failed"
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        // Update local record first
        let updatedSubaccount = await tx.subaccount.update({
          where: { userId },
          data: {
            accountNumber,
            bankCode,
            businessName: businessName || existingSubaccount.businessName,
            accountName: validationResult.data?.accountName || null,
            status: SubaccountStatus.PENDING,
            isActive: false,
            failureReason: null,
          },
        });

        // Update Paystack subaccount if it exists
        if (existingSubaccount.subaccountCode) {
          const paystackResult = await this.paystackService.updateSubaccount(
            existingSubaccount.subaccountCode,
            {
              account_number: accountNumber,
              settlement_bank: bankCode,
              business_name: businessName || existingSubaccount.businessName,
            }
          );

          if (!paystackResult.success) {
            await tx.subaccount.update({
              where: { userId },
              data: {
                status: SubaccountStatus.FAILED,
                failureReason: paystackResult.message,
              },
            });

            return this.failure(paystackResult.message);
          }

          // Mark as active if Paystack update succeeded
          updatedSubaccount = await tx.subaccount.update({
            where: { userId },
            data: {
              status: SubaccountStatus.ACTIVE,
              isActive: true,
            },
          });
        } else {
          // Create new Paystack subaccount
          const createResult = await this.createSubaccountInPaystack(
            updatedSubaccount
          );
          
          if (!createResult.success) {
            return createResult;
          }
          
          updatedSubaccount = createResult.data!;
        }

        // Clear cache
        await this.deleteCachePattern(`subaccount:${userId}`);
        await this.deleteCachePattern(`user:${userId}:*`);

        return this.success(updatedSubaccount, 'Subaccount updated successfully');
      });
    } catch (error) {
      return this.handleError(error, "updateSubaccountBankDetails");
    }
  }

  async retryFailedSubaccount(userId: string): Promise<ServiceResponse<Subaccount>> {
    try {
      const subaccount = await this.prisma.subaccount.findUnique({
        where: { userId },
      });

      if (!subaccount) {
        return this.failure("Subaccount not found");
      }

      if (subaccount.status !== SubaccountStatus.FAILED) {
        return this.failure("Subaccount is not in failed state");
      }

      return await this.createSubaccountInPaystack(subaccount);
    } catch (error) {
      return this.handleError(error, "retryFailedSubaccount");
    }
  }

  private async createSubaccountInPaystack(
    subaccount: any
  ): Promise<ServiceResponse<Subaccount>> {
    try {
      const paystackResult = await this.paystackService.createSubaccount(
        subaccount.businessName,
        subaccount.accountNumber,
        subaccount.bankCode,
        subaccount.percentageCharge,
        `Property Lister - ${subaccount.businessName}`
      );

      if (!paystackResult.success || !paystackResult.data?.data) {
        await this.prisma.subaccount.update({
          where: { id: subaccount.id },
          data: {
            status: SubaccountStatus.FAILED,
            failureReason: paystackResult.message,
          },
        });

        return this.failure(paystackResult.message);
      }

      const updatedSubaccount = await this.prisma.subaccount.update({
        where: { id: subaccount.id },
        data: {
          subaccountCode: paystackResult.data.data.subaccount_code,
          paystackSubaccountId: paystackResult.data.data.id,
          status: SubaccountStatus.ACTIVE,
          isActive: true,
          failureReason: null,
        },
      });

      // Clear cache
      await this.deleteCachePattern(`subaccount:${subaccount.userId}`);

      return this.success(updatedSubaccount, "Subaccount created successfully");
    } catch (error) {
      return this.handleError(error, "createSubaccountInPaystack");
    }
  }

  async suspendSubaccount(userId: string, reason: string): Promise<ServiceResponse<boolean>> {
    try {
      const subaccount = await this.prisma.subaccount.findUnique({
        where: { userId }
      });

      if (!subaccount) {
        return this.failure("Subaccount not found");
      }

      await this.prisma.subaccount.update({
        where: { userId },
        data: {
          status: SubaccountStatus.SUSPENDED,
          isActive: false,
          failureReason: reason,
        },
      });

      await this.deleteCachePattern(`subaccount:${userId}`);
      
      return this.success(true, "Subaccount suspended successfully");
    } catch (error) {
      return this.handleError(error, "suspendSubaccount");
    }
  }

  async activateSubaccount(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const subaccount = await this.prisma.subaccount.findUnique({
        where: { userId }
      });

      if (!subaccount) {
        return this.failure("Subaccount not found");
      }

      await this.prisma.subaccount.update({
        where: { userId },
        data: {
          status: SubaccountStatus.ACTIVE,
          isActive: true,
          failureReason: null,
        },
      });

      await this.deleteCachePattern(`subaccount:${userId}`);
      
      return this.success(true, "Subaccount activated successfully");
    } catch (error) {
      return this.handleError(error, "activateSubaccount");
    }
  }

  async getSubaccountBalance(userId: string): Promise<ServiceResponse<number>> {
    try {
      const subaccount = await this.prisma.subaccount.findUnique({
        where: { userId }
      });

      if (!subaccount || !subaccount.subaccountCode) {
        return this.failure("Subaccount not found or not active");
      }

      const balanceResult = await this.paystackService.getSubaccountBalance(
        subaccount.subaccountCode
      );

      if (!balanceResult.success) {
        return this.failure(balanceResult.message);
      }

      return this.success(balanceResult.data?.data?.balance || 0, "Balance fetched successfully");
    } catch (error) {
      return this.handleError(error, "getSubaccountBalance");
    }
  }

  async getAllSubaccounts(
    page: number = 1,
    limit: number = 20,
    status?: SubaccountStatus
  ): Promise<ServiceResponse<{ subaccounts: Subaccount[]; total: number; pages: number }>> {
    try {
      const skip = (page - 1) * limit;
      const where = status ? { status } : {};

      const [subaccounts, total] = await Promise.all([
        this.prisma.subaccount.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.subaccount.count({ where })
      ]);

      const pages = Math.ceil(total / limit);

      return this.success(
        { subaccounts, total, pages },
        "Subaccounts fetched successfully"
      );
    } catch (error) {
      return this.handleError(error, "getAllSubaccounts");
    }
  }
}