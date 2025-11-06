//src/routes/webhook.ts
import express, { Request, Response } from "express";
import { createHmac } from "crypto";
import { TransactionStatus } from "@prisma/client";
import { getContainer } from "../services";
import { BookingService } from "../services/booking";
import { PaystackService } from "../services/payment";

class WebhookController {
  private bookingService: BookingService;
  private paystackService: PaystackService;

  constructor() {
    const container = getContainer();
    this.bookingService = container.resolve<BookingService>('bookingService');
    this.paystackService = container.resolve<PaystackService>('paystackService');
  }

  async handlePaystackWebhook(req: Request, res: Response) {
    try {
      const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
      if (!secretKey) {
        console.error("Paystack secret key not configured");
        return res.status(500).json({ error: "Payment service not configured" });
      }

      // Verify Paystack signature
      const hash = createHmac("sha512", secretKey)
        .update(JSON.stringify(req.body))
        .digest("hex");
      const signature = req.headers["x-paystack-signature"] as string;

      if (hash !== signature) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const event = req.body;
      console.log("Received webhook event:", event.event);

      // Handle different event types
      switch (event.event) {
        case "charge.success":
          await this.handleChargeSuccess(event);
          break;
        case "transfer.success":
          await this.handleTransferSuccess(event);
          break;
        case "transfer.failed":
          await this.handleTransferFailed(event);
          break;
        default:
          console.log(`Unhandled webhook event: ${event.event}`);
      }

      return res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  private async handleChargeSuccess(event: any) {
    try {
      const { reference } = event.data;
      
      // Verify the payment with Paystack first
      const verification = await this.paystackService.verifyPayment(reference);
      
      if (!verification.data?.data || verification.data.data.status !== "success") {
        console.error(`Payment verification failed for ${reference}`);
        return;
      }

      // Process the payment confirmation using booking service
      const paymentResult = await this.bookingService.confirmBookingPayment({
        reference,
        userId: event.data.customer?.email || 'system' // Use customer email or 'system' as fallback
      });
      
      if (!paymentResult.success) {
        console.error(`Failed to process payment for reference ${reference}:`, paymentResult.message);
        return;
      }
      
      console.log(`Successfully processed payment for reference: ${reference}`);
    } catch (error) {
      console.error("Error handling charge success:", error);
    }
  }

  private async handleTransferSuccess(event: any) {
    try {
      const { reference, recipient } = event.data;
      
      console.log(`Transfer successful - Reference: ${reference}, Recipient: ${recipient}`);
      
      // You can add logic here to update any transfer-related records
      // For example, updating payout status for property owners
    } catch (error) {
      console.error("Error handling transfer success:", error);
    }
  }

  private async handleTransferFailed(event: any) {
    try {
      const { reference, recipient } = event.data;
      
      console.log(`Transfer failed - Reference: ${reference}, Recipient: ${recipient}`);
      
      // You can add logic here to handle failed transfers
      // For example, notifying the property owner about payout issues
    } catch (error) {
      console.error("Error handling transfer failure:", error);
    }
  }
}

export function createWebhookRouter() {
  const router = express.Router();
  const webhookController = new WebhookController();

  // Raw body parser for Paystack signature verification
  router.post(
    "/paystack",
    express.raw({ type: "application/json" }),
    (req, res) => {
      webhookController.handlePaystackWebhook(req, res);
    }
  );

  return router;
}