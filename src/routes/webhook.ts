import { Request, Response } from "express";
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BookingService } from "../services/booking";

export class WebhookController {
  private prisma: PrismaClient;
  private redis: Redis;
  private bookingService: BookingService;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    this.bookingService = new BookingService(prisma, redis);
  }

  async handlePaystackWebhook(req: Request, res: Response) {
    try {
      const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
      if (!secretKey) {
        return res
          .status(500)
          .json({ error: "Paystack secret key not configured" });
      }

      // Verify Paystack signature
      const hash = createHmac("sha512", secretKey)
        .update(JSON.stringify(req.body))
        .digest("hex");
      const signature = req.headers["x-paystack-signature"] as string;

      if (hash !== signature) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const event = req.body;
      const result = await this.bookingService.handlePaymentWebhook(event);

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      return res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
