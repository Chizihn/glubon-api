//src/services/payment
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { ServiceResponse } from "../types";

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
  };
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

  async initializePayment(
    email: string,
    amount: number,
    reference: string,
    channels: string[] = ["card", "bank_transfer", "ussd", "qr", "mobile_money"]
  ): Promise<ServiceResponse<PaystackInitializeResponse>> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100,
          reference,
          channels,
        },
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
      return this.handleError(error, "verifyPayment");
    }
  }
}
