//src/services/payment.ts
import axios from "axios";
import { PrismaClient, TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import { BaseService, CACHE_TTL } from "./base";
import { ServiceResponse } from "../types";
import { logger } from "../utils";

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    amount: number;
    currency: string;
    customer: { email: string };
    gateway_response: string;
    reference: string;
    paid_at: string;
    created_at: string;
    channel: string;
    ip_address: string;
    fees: number;
    split: {
      type: string;
      currency: string;
      subaccounts: Array<{
        subaccount: string;
        share: number;
      }>;
      bearer_type: string;
      bearer_subaccount?: string;
    };
  };
}

interface AccountResolveResponse {
  account_number?: string;
  account_name?: string;
  bank_code?: string;
}

interface PaystackSubaccountResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    subaccount_code: string;
    business_name: string;
    description: string;
    primary_contact_email: string | null;
    primary_contact_name: string | null;
    primary_contact_phone: string | null;
    metadata: any;
    percentage_charge: number;
    is_verified: boolean;
    settlement_bank: string;
    account_number: string;
    settlement_schedule: string;
    active: boolean;
    migrate: boolean;
    domain: string;
    split_config: any;
    createdAt: string;
    updatedAt: string;
  };
}

interface PaystackSubaccountBalance {
  status: boolean;
  message: string;
  data: {
    balance: number;
    currency: string;
  };
}

interface SubaccountValidationResult {
  isValid: boolean;
  accountName?: string;
}

interface UpdateSubaccountData {
  business_name?: string;
  settlement_bank?: string;
  account_number?: string;
  active?: boolean;
  percentage_charge?: number;
  description?: string;
  primary_contact_email?: string;
  primary_contact_name?: string;
  primary_contact_phone?: string;
  settlement_schedule?: string;
}

export class PaystackService extends BaseService {
  private readonly apiKey: string;
  private readonly baseUrl: string = "https://api.paystack.co";

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.apiKey = process.env.PAYSTACK_SECRET_KEY || "";
    if (!this.apiKey) {
      throw new Error("Paystack API key not configured");
    }
  }

  // Helper method to safely extract error information
  private extractErrorInfo(error: any): any {
    const errorInfo: any = {
      message: error.message || "Unknown error",
      name: error.name || "Error",
      stack: error.stack,
    };

    // Safely extract Axios response data if available
    if (error.response) {
      errorInfo.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      };
    }

    // Safely extract request config if available
    if (error.config) {
      errorInfo.config = {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        data: error.config.data,
      };
    }

    return errorInfo;
  }

  async initializePayment(
    email: string,
    amount: Decimal | number,
    reference: string,
    channels: string[] = [
      "card",
      "bank_transfer",
      "ussd",
      "qr",
      "mobile_money",
    ],
    subaccountCode?: string,
    callbackUrl?: string
  ): Promise<ServiceResponse<PaystackInitializeResponse>> {
    try {
      const payload: any = {
        email,
        amount: new Decimal(amount).mul(100).toNumber(), // Convert to kobo
        reference,
        channels,
      };

      // Add callback URL if provided
      if (callbackUrl) {
        payload.callback_url = callbackUrl;
      }

      // Add subaccount if provided
      if (subaccountCode) {
        payload.subaccount = subaccountCode;
        payload.bearer = "subaccount"; // Subaccount bears the transaction fee
      }

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return this.success(
        response.data,
        "Payment initialized with Paystack successfully"
      );
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error initializing payment:", safeError);
      return this.handleError(error, "initializePayment");
    }
  }

  async verifyPayment(
    reference: string
  ): Promise<ServiceResponse<PaystackVerifyResponse>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return this.success(
        response.data,
        "Payment with Paystack verified successfully"
      );
    } catch (error) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error verifying payment:", safeError);
      return this.handleError(error, "verifyPayment");
    }
  }

  async resolveAccountNumber(
    accountNumber: string,
    bankCode: string
  ): Promise<ServiceResponse<AccountResolveResponse>> {
    try {
      if (!this.apiKey) {
        return this.failure("Paystack secret key not configured");
      }

      if (!accountNumber || !bankCode) {
        return this.failure("Account number and bank code are required");
      }

      const response = await axios.get<{
        status: boolean;
        message: string;
        data: AccountResolveResponse;
      }>(
        `${this.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          validateStatus: () => true, // This ensures we get the response even for error status codes
        }
      );

      if (!response.data || typeof response.data !== "object") {
        return this.failure("Invalid response from Paystack service");
      }

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Account resolution failed"
        );
      }

      if (!response.data.data) {
        return this.failure("No account data received from Paystack");
      }

      return this.success(
        response.data.data,
        "Account number resolved successfully"
      );
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      console.error("Error resolving account number:", safeError);

      // Handle specific error cases
      if (error.response?.status === 400) {
        return this.failure("Invalid account number or bank code");
      }

      // Return a generic error message without exposing internal details
      return this.failure(
        "Failed to resolve account number. Please try again later."
      );
    }
  }

  async validateSubaccountDetails(
    accountNumber: string,
    bankCode: string,
    businessName: string
  ): Promise<ServiceResponse<SubaccountValidationResult>> {
    try {
      // First, resolve the account number
      const resolveResult = await this.resolveAccountNumber(
        accountNumber,
        bankCode
      );

      if (!resolveResult.success) {
        return this.failure(resolveResult.message);
      }

      const accountData = resolveResult.data!;

      // Basic validation
      if (!accountData.account_name) {
        return this.failure("Could not retrieve account name");
      }

      // You can add more validation logic here
      // For example, checking if account name matches business name partially

      return this.success(
        {
          isValid: true,
          accountName: accountData.account_name,
        },
        "Account details validated successfully"
      );
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error validating subaccount details:", safeError);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to validate subaccount details";
      return this.failure(errorMessage);
    }
  }

  async createSubaccount(
    businessName: string,
    accountNumber: string,
    bankCode: string,
    percentageCharge: number = 85,
    description?: string,
    primaryContactEmail?: string,
    primaryContactName?: string,
    primaryContactPhone?: string
  ): Promise<ServiceResponse<PaystackSubaccountResponse>> {
    try {
      const payload = {
        business_name: businessName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
        description: description || `Subaccount for ${businessName}`,
        primary_contact_email: primaryContactEmail,
        primary_contact_name: primaryContactName,
        primary_contact_phone: primaryContactPhone,
      };

      const response = await axios.post<PaystackSubaccountResponse>(
        `${this.baseUrl}/subaccount`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Failed to create subaccount"
        );
      }

      return this.success(response.data, "Subaccount created successfully");
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error creating Paystack subaccount:", safeError);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create Paystack subaccount";
      return this.failure(errorMessage);
    }
  }

  async updateSubaccount(
    subaccountCode: string,
    updateData: UpdateSubaccountData
  ): Promise<ServiceResponse<PaystackSubaccountResponse>> {
    try {
      const response = await axios.put<PaystackSubaccountResponse>(
        `${this.baseUrl}/subaccount/${subaccountCode}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Failed to update subaccount"
        );
      }

      return this.success(response.data, "Subaccount updated successfully");
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error updating subaccount:", safeError);

      if (error.response?.status === 404) {
        return this.failure("Subaccount not found");
      }

      if (error.response?.status === 400) {
        const errorMessage =
          error.response.data?.message || "Invalid update data";
        return this.failure(errorMessage);
      }

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update subaccount";
      return this.failure(errorMessage);
    }
  }

  async getSubaccount(
    subaccountCode: string
  ): Promise<ServiceResponse<PaystackSubaccountResponse>> {
    try {
      const response = await axios.get<PaystackSubaccountResponse>(
        `${this.baseUrl}/subaccount/${subaccountCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Failed to fetch subaccount"
        );
      }

      return this.success(response.data, "Subaccount fetched successfully");
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error fetching subaccount:", safeError);

      if (error.response?.status === 404) {
        return this.failure("Subaccount not found");
      }

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch subaccount";
      return this.failure(errorMessage);
    }
  }

  async getSubaccountBalance(
    subaccountCode: string
  ): Promise<ServiceResponse<PaystackSubaccountBalance>> {
    try {
      const response = await axios.get<PaystackSubaccountBalance>(
        `${this.baseUrl}/balance/subaccounts/${subaccountCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(response.data.message || "Failed to fetch balance");
      }

      return this.success(
        response.data,
        "Subaccount balance fetched successfully"
      );
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error fetching subaccount balance:", safeError);

      if (error.response?.status === 404) {
        return this.failure("Subaccount not found");
      }

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch subaccount balance";
      return this.failure(errorMessage);
    }
  }

  async listBanks(): Promise<ServiceResponse<any>> {
    try {
      const cacheKey = "paystack:banks";
      const cached = await this.getCache<any>(cacheKey);

      if (cached) {
        return this.success(cached, "Banks fetched from cache");
      }

      const response = await axios.get(`${this.baseUrl}/bank`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.data.status) {
        return this.failure(response.data.message || "Failed to fetch banks");
      }

      // Cache for 24 hours (banks don't change frequently)
      await this.setCache(cacheKey, response.data, CACHE_TTL.VERY_LONG as any);

      return this.success(response.data, "Banks fetched successfully");
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error fetching banks:", safeError);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch banks";
      return this.failure(errorMessage);
    }
  }

  async getTransactionsBySubaccount(
    subaccountCode: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction?subaccount=${subaccountCode}&page=${page}&perPage=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Failed to fetch transactions"
        );
      }

      return this.success(response.data, "Transactions fetched successfully");
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error fetching transactions:", safeError);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch transactions";
      return this.failure(errorMessage);
    }
  }

  async splitPayment(
    email: string,
    amount: Decimal | number,
    reference: string,
    splitConfig: {
      type: string;
      currency: string;
      subaccounts: Array<{
        subaccount: string;
        share: number;
      }>;
      bearer_type: string;
      bearer_subaccount?: string;
    }
  ): Promise<ServiceResponse<PaystackInitializeResponse>> {
    try {
      const payload = {
        email,
        amount: new Decimal(amount).mul(100).toNumber(), // Convert to kobo
        reference,
        split: splitConfig,
      };

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Failed to initialize split payment"
        );
      }

      return this.success(
        response.data,
        "Split payment initialized successfully"
      );
    } catch (error: any) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error initializing split payment:", safeError);
      return this.handleError(error, "splitPayment");
    }
  }

  /**
   * Retry a failed payment by creating a new payment URL for an existing booking
   * @param bookingId The ID of the booking to retry payment for
   * @param userId The ID of the user making the payment
   */
  async retryPayment(
    bookingId: string,
    userId: string
  ): Promise<
    ServiceResponse<{ paymentUrl: string; reference: string; expiresAt: Date }>
  > {
    try {
      // 1. Verify the booking exists and belongs to the user
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          renter: true,
          property: {
            include: {
              owner: {
                include: { subaccount: true },
              },
            },
          },
          transactions: {
            where: {
              status: "PENDING",
              type: {
                in: ["RENT_PAYMENT", "LEASE_PAYMENT", "SALE_PAYMENT"] as any[], // Temporary workaround for Prisma client type issue
              },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!booking) {
        return this.failure("Booking not found");
      }

      if (booking.renterId !== userId) {
        return this.failure("Unauthorized");
      }

      // 2. Check if booking is in a state that allows payment
      if (!["PENDING_PAYMENT", "PENDING_APPROVAL"].includes(booking.status)) {
        return this.failure("This booking is not eligible for payment");
      }

      // 3. Create a new transaction record or reuse existing pending one
      let transaction = booking.transactions[0];

      if (!transaction) {
        // Determine transaction type based on property listing type
        let transactionType: string;
        switch (booking.property.listingType) {
          case "RENT":
            transactionType = "RENT_PAYMENT";
            break;
          case "LEASE":
            transactionType = "LEASE_PAYMENT";
            break;
          case "SALE":
            transactionType = "SALE_PAYMENT";
            break;
          default:
            // Fallback to RENT_PAYMENT for backward compatibility
            transactionType = "RENT_PAYMENT";
        }

        // Create a new transaction if none exists
        const newTransaction = await this.prisma.transaction.create({
          data: {
            type: transactionType as any, // Type assertion needed due to Prisma client type issue
            amount: booking.amount,
            currency: "NGN",
            status: "PENDING" as const,
            reference: `PSTK-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 10)}`,
            userId,
            propertyId: booking.propertyId,
            bookingId: booking.id,
            description: `Payment for ${booking.property.listingType.toLowerCase()} booking ${
              booking.id
            }`,
          },
        });
        transaction = newTransaction;
      }

      // 4. Generate payment URL
      const paymentResult = await this.createSplitPayment(
        booking.renter.email!,
        booking.amount,
        transaction.reference,
        booking.property.owner.subaccount?.subaccountCode || "",
        booking.property.owner.subaccount?.percentageCharge || 85
      );

      if (
        !paymentResult.success ||
        !paymentResult.data?.data?.authorization_url
      ) {
        return this.failure("Failed to generate payment URL");
      }

      // 5. Update booking with new payment URL
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "PENDING_PAYMENT",
          updatedAt: new Date(),
        },
      });

      return this.success({
        paymentUrl: paymentResult.data.data.authorization_url,
        reference: transaction.reference,
        expiresAt,
      });
    } catch (error) {
      const safeError = this.extractErrorInfo(error);
      logger.error("Error retrying payment:", safeError);
      return this.handleError(error, "retryPayment");
    }
  }

  /**
   * Create a split payment with Paystack
   */
  async createSplitPayment(
    email: string,
    amount: Decimal | number,
    reference: string,
    subaccountCode: string,
    subaccountPercentage: number,
    callbackUrl?: string
  ): Promise<ServiceResponse<PaystackInitializeResponse>> {
    try {
      const splitConfig = {
        type: "percentage",
        currency: "NGN",
        subaccounts: [
          {
            subaccount: subaccountCode,
            share: subaccountPercentage,
          },
        ],
        bearer_type: "subaccount",
        bearer_subaccount: subaccountCode,
      };

      // Create payload with callback URL if provided
      const payload: any = {
        email,
        amount: new Decimal(amount).mul(100).toNumber(), // Convert to kobo
        reference,
        split: splitConfig,
      };

      if (callbackUrl) {
        payload.callback_url = callbackUrl;
      }

      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data.status) {
        return this.failure(
          response.data.message || "Failed to initialize split payment"
        );
      }

      return this.success(
        response.data,
        "Split payment initialized successfully"
      );
    } catch (error: any) {
      // Create a safe error object without circular references
      const safeError = this.extractErrorInfo(error);
      logger.error("Error creating split payment:", safeError);

      // Throw a clean error message
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create split payment";
      throw new Error(`Payment failed: ${errorMessage}`);
    }
  }
}
