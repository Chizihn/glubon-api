import {
  Resolver,
  Query,
  Mutation,
  Arg,
  UseMiddleware,
  Ctx,
  ID,
} from "type-graphql";
import { Context } from "../../types/context";
import { getContainer } from "../../services";
import { SubaccountService } from "../../services/subaccount";
import { PaystackService } from "../../services/payment";
import { AuthMiddleware, RequireRole } from "../../middleware";
import { RoleEnum } from "@prisma/client";
import {
  Subaccount,
  SubaccountResponse,
  BankListResponse,
  AccountResolveResponse,
  AccountDetails,
} from "./subaccount.types";
import {
  CreateSubaccountInput,
  UpdateBankDetailsInput,
  AccountResolveInput,
  SuspendSubaccountInput,
} from "./subaccount.inputs";
import { logger } from "../../utils";

@Resolver(() => Subaccount)
export class SubaccountResolver {
  private subaccountService: SubaccountService;
  private paystackService: PaystackService;

  constructor() {
        const container = getContainer();
    
    this.subaccountService = container.resolve('subaccountService');
    this.paystackService = container.resolve('paystackService');
  }

  @Query(() => Subaccount, { nullable: true })
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getSubaccount(@Ctx() context: Context): Promise<Subaccount | null> {
    try {
      const result = await this.subaccountService.getSubaccount(context.user!.id);
      
      if (!result.success || !result.data) {
        return null;
      }

      // Convert paystackSubaccountId to string if it exists
      return {
        ...result.data,
        paystackSubaccountId: result.data.paystackSubaccountId?.toString() || null
      };
    } catch (error) {
      throw new Error(`Failed to fetch subaccount: ${error}`);
    }
  }

  @Query(() => BankListResponse)
  @UseMiddleware(AuthMiddleware)
  async getBanks(): Promise<BankListResponse> {
    try {
      const result = await this.paystackService.listBanks();

      if (!result.success) {
        throw new Error(result.message);
      }

      // Filter only active Nigerian banks
      const nigerianBanks = result.data?.data?.filter(
        (bank: { active: boolean; country: string }) => bank.active && bank.country === "Nigeria"
      ) || [];

      return {
        success: true,
        message: "Banks fetched successfully",
        data: nigerianBanks.map((bank: { name: string; slug: string; code: string; longcode: string; gateway: string | null; pay_with_bank: boolean; active: boolean; country: string; currency: string; type: string }) => ({
          name: bank.name,
          slug: bank.slug,
          code: bank.code,
          longcode: bank.longcode,
          gateway: bank.gateway,
          payWithBank: bank.pay_with_bank,
          active: bank.active,
          country: bank.country,
          currency: bank.currency,
          type: bank.type,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch banks: ${error}`);
    }
  }

  @Query(() => AccountResolveResponse)
  @UseMiddleware(AuthMiddleware)
  async resolveAccountNumber(
    @Arg("input") input: AccountResolveInput
  ): Promise<AccountResolveResponse> {
    try {
      const result = await this.paystackService.resolveAccountNumber(
        input.accountNumber,
        input.bankCode
      );

      if (!result.success) {
        return {
          success: false,
          message: result.message || "Failed to resolve account number",
          data: {
            accountNumber: "",
            accountName: "",
            bankCode: input.bankCode
          }
        };
      }

      return {
        success: true,
        message: "Account resolved successfully",
        data: {
          accountNumber: result.data?.account_number || "",
          accountName: result.data?.account_name || "",
          bankCode: result.data?.bank_code || input.bankCode,
        },
      };
    } catch (error: any) {
      logger.error("Error in resolveAccountNumber:", error);
      return {
        success: false,
        message: error.message || "Failed to resolve account number",
        data: {
          accountNumber: "",
          accountName: "",
          bankCode: input.bankCode
        }
      };
    }
  }

  @Mutation(() => SubaccountResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async createSubaccount(
    @Arg("input") input: CreateSubaccountInput,
    @Ctx() context: Context
  ): Promise<SubaccountResponse> {
    // First validate the account details
    const validationResult = await this.paystackService.resolveAccountNumber(
      input.accountNumber,
      "001"
      // input.bankCode
    );

    if (!validationResult.success) {
      throw new Error(validationResult.message);
    }

    // Create the subaccount
    const result = await this.subaccountService.createSubaccount({
      userId: context.user!.id,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
      // bankCode: "001",
      businessName: input.businessName,
      percentageCharge: input.percentageCharge,
    });

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to create subaccount');
    }

    // Convert paystackSubaccountId to string if it exists
    const subaccount = {
      ...result.data,
      paystackSubaccountId: result.data.paystackSubaccountId?.toString() || null
    };

    return {
      success: true,
      message: "Subaccount created successfully",
      data: subaccount,
    };
  }

  @Mutation(() => SubaccountResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async updateBankDetails(
    @Arg("input") input: UpdateBankDetailsInput,
    @Ctx() context: Context
  ): Promise<SubaccountResponse> {
    const result = await this.subaccountService.updateSubaccountBankDetails(
      context.user!.id,
      input.accountNumber,
      input.bankCode,
      input.businessName
    );

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to update bank details');
    }

    // Convert paystackSubaccountId to string if it exists
    const subaccount = {
      ...result.data,
      paystackSubaccountId: result.data.paystackSubaccountId?.toString() || null
    };

    return {
      success: true,
      message: "Bank details updated successfully",
      data: subaccount,
    };
  }

  @Mutation(() => SubaccountResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async retrySubaccount(@Ctx() context: Context): Promise<SubaccountResponse> {
    const result = await this.subaccountService.retryFailedSubaccount(context.user!.id);

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to retry subaccount creation');
    }

    // Convert paystackSubaccountId to string if it exists
    const subaccount = {
      ...result.data,
      paystackSubaccountId: result.data.paystackSubaccountId?.toString() || null
    };

    return {
      success: true,
      message: "Subaccount retry successful",
      data: subaccount,
    };
  }

  // Admin endpoints
  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
  async adminSuspendSubaccount(
    @Arg("userId", () => ID) userId: string,
    @Arg("input") input: SuspendSubaccountInput
  ): Promise<boolean> {
    const result = await this.subaccountService.suspendSubaccount(userId, input.reason);

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data!;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
  async adminActivateSubaccount(
    @Arg("userId", () => ID) userId: string
  ): Promise<boolean> {
    const result = await this.subaccountService.activateSubaccount(userId);

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data!;
  }
}
