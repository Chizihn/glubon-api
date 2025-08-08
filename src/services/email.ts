import nodemailer, { type Transporter } from "nodemailer";
import { BaseService } from "./base";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils";
import { ServiceResponse } from "../types";
import { EmailTemplates } from "../templates/email";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

interface QueuedEmail extends EmailOptions {
  id: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date; // Optional for scheduling
}

export class EmailService extends BaseService {
  private transporter: Transporter;
  private emailQueue = "email_queue";

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.initializeTransporter();
    this.startEmailProcessor();
  }

  // Singleton instance
  private static _instance: EmailService;
  static getInstance(prisma: PrismaClient, redis: Redis): EmailService {
    if (!EmailService._instance) {
      EmailService._instance = new EmailService(prisma, redis);
    }
    return EmailService._instance;
  }

  private initializeTransporter(): void {
    if (config.NODE_ENV === "production") {
      // Use your SMTP production server here (replace with your actual SMTP settings)
      this.transporter = nodemailer.createTransport({
        host: "gmail",
        port: Number(config.EMAIL_PORT) || 465, // Usually 465 (SSL) or 587 (TLS)
        secure: true, // true for 465, false for other ports
        auth: {
          user: config.EMAIL_USER, // your SMTP username
          pass: config.EMAIL_PASS, // your SMTP password
        },
      });
    } else {
      // Use Gmail for development
      this.transporter = nodemailer.createTransport({
        service: "gmail", // e.g., 'gmail'
        port: Number(config.EMAIL_PORT) || 587, // Usually 587 for TLS
        auth: {
          user: config.EMAIL_USER,
          pass: config.EMAIL_PASS || config.EMAIL_PASS,
        },
      });
    }

    this.transporter.verify((error) => {
      if (error) {
        logger.error("Email transporter configuration error:", error);
      } else {
        logger.info("Email transporter is ready", { service: "graphql-api" });
      }
    });
  }

  private async startEmailProcessor(): Promise<void> {
    // Process email queue every 30 seconds
    setInterval(async () => {
      await this.processEmailQueue();
    }, 30000);
  }

  private async addToQueue(
    emailOptions: EmailOptions,
    scheduledFor?: Date
  ): Promise<void> {
    const queuedEmail: QueuedEmail = {
      ...emailOptions,
      id: `email_${Date.now()}_${Math.random()}`,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      scheduledFor: scheduledFor as Date,
    };

    await this.redis.lpush(this.emailQueue, JSON.stringify(queuedEmail));
    logger.info(`Email queued: ${queuedEmail.id}`);
  }

  private async processEmailQueue(): Promise<void> {
    try {
      const queueLength = await this.redis.llen(this.emailQueue);
      if (queueLength === 0) return;

      // Process up to 10 emails at a time
      const emailsToProcess = Math.min(queueLength, 10);

      for (let i = 0; i < emailsToProcess; i++) {
        const emailData = await this.redis.rpop(this.emailQueue);
        if (!emailData) continue;

        const queuedEmail: QueuedEmail = JSON.parse(emailData);

        // Check if email is scheduled for future
        if (queuedEmail.scheduledFor && new Date() < queuedEmail.scheduledFor) {
          // Put back in queue
          await this.redis.lpush(this.emailQueue, emailData);
          continue;
        }

        try {
          await this.sendEmailDirectly(queuedEmail);
          logger.info(`Email sent successfully: ${queuedEmail.id}`);
        } catch (error) {
          logger.error(`Failed to send email: ${queuedEmail.id}`, error);

          // Retry logic
          queuedEmail.attempts++;
          if (queuedEmail.attempts < queuedEmail.maxAttempts) {
            // Add delay before retry (exponential backoff)
            const delay = Math.pow(2, queuedEmail.attempts) * 60000; // 2min, 4min, 8min
            queuedEmail.scheduledFor = new Date(Date.now() + delay);
            await this.redis.lpush(
              this.emailQueue,
              JSON.stringify(queuedEmail)
            );
            logger.info(
              `Email requeued for retry: ${queuedEmail.id}, attempt ${queuedEmail.attempts}`
            );
          } else {
            logger.error(`Email failed permanently: ${queuedEmail.id}`);
            // Could store failed emails in a separate queue or database for manual review
          }
        }
      }
    } catch (error) {
      logger.error("Error processing email queue:", error);
    }
  }

  private async sendEmailDirectly(emailOptions: EmailOptions): Promise<void> {
    const mailOptions = {
      from: emailOptions.from || `"Glubon" <${config.EMAIL_FROM}>`,
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: emailOptions.html,
      text: emailOptions.text,
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Public methods for sending specific types of emails

  async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.welcomeEmail(firstName);
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(undefined, "Welcome email queued successfully");
    } catch (error) {
      logger.error("Error queueing welcome email:", error);
      return this.failure("Failed to queue welcome email");
    }
  }

  async sendVerificationCode(
    email: string,
    firstName: string,
    code: string,
    purpose: "email_verification" | "password_reset"
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.verificationCode(
        firstName,
        code,
        purpose
      );

      // Send verification emails immediately (don't queue)
      await this.sendEmailDirectly({
        to: email,
        ...template,
      });

      return this.success(undefined, "Verification code sent successfully");
    } catch (error) {
      logger.error("Error sending verification code:", error);
      return this.failure("Failed to send verification code");
    }
  }

  async sendPropertyAlert(
    email: string,
    firstName: string,
    propertyTitle: string,
    propertyId: string,
    alertType: "new_match" | "price_drop" | "status_change"
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.propertyAlert(
        firstName,
        propertyTitle,
        propertyId,
        alertType
      );
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(undefined, "Property alert queued successfully");
    } catch (error) {
      logger.error("Error queueing property alert:", error);
      return this.failure("Failed to queue property alert");
    }
  }

  async sendPropertyApprovalNotification(
    email: string,
    ownerName: string,
    propertyTitle: string,
    propertyId: string,
    approved: boolean
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.propertyApproval(
        ownerName,
        propertyTitle,
        propertyId,
        approved
      );
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(
        undefined,
        "Property approval notification queued successfully"
      );
    } catch (error) {
      logger.error("Error queueing property approval notification:", error);
      return this.failure("Failed to queue property approval notification");
    }
  }

  async sendIdentityVerificationNotification(
    email: string,
    firstName: string,
    verificationType: string,
    approved: boolean
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.identityVerification(
        firstName,
        verificationType,
        approved
      );
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(
        undefined,
        "Identity verification notification queued successfully"
      );
    } catch (error) {
      logger.error("Error queueing identity verification notification:", error);
      return this.failure("Failed to queue identity verification notification");
    }
  }

  async sendChatNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    propertyTitle: string,
    messagePreview: string,
    chatId: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.chatNotification(
        recipientName,
        senderName,
        propertyTitle,
        messagePreview,
        chatId
      );

      // Send chat notifications with slight delay to batch multiple messages
      const scheduledFor = new Date(Date.now() + 300000); // 5 minutes delay
      await this.addToQueue(
        {
          to: recipientEmail,
          ...template,
        },
        scheduledFor
      );

      return this.success(undefined, "Chat notification queued successfully");
    } catch (error) {
      logger.error("Error queueing chat notification:", error);
      return this.failure("Failed to queue chat notification");
    }
  }

  async sendBulkEmails(
    emails: Array<{ email: string; template: any }>,
    delayBetween: number = 1000
  ): Promise<ServiceResponse<{ sent: number; failed: number }>> {
    try {
      let sent = 0;
      let failed = 0;

      for (const emailData of emails) {
        try {
          await this.addToQueue({
            to: emailData.email,
            ...emailData.template,
          });
          sent++;

          // Add delay between emails to avoid rate limiting
          if (delayBetween > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayBetween));
          }
        } catch (error) {
          logger.error(`Failed to queue email for ${emailData.email}:`, error);
          failed++;
        }
      }

      return this.success(
        { sent, failed },
        `Bulk email operation completed: ${sent} sent, ${failed} failed`
      );
    } catch (error) {
      logger.error("Error in bulk email operation:", error);
      return this.failure("Failed to process bulk emails");
    }
  }

  async getQueueStatus(): Promise<
    ServiceResponse<{ queueLength: number; processingStatus: string }>
  > {
    try {
      const queueLength = await this.redis.llen(this.emailQueue);
      return this.success(
        {
          queueLength,
          processingStatus: "Active",
        },
        "Queue status retrieved successfully"
      );
    } catch (error) {
      logger.error("Error getting queue status:", error);
      return this.failure("Failed to get queue status");
    }
  }

  // Method to send immediate email (bypass queue)
  async sendImmediateEmail(
    emailOptions: EmailOptions
  ): Promise<ServiceResponse<void>> {
    try {
      await this.sendEmailDirectly(emailOptions);
      return this.success(undefined, "Email sent immediately");
    } catch (error) {
      logger.error("Error sending immediate email:", error);
      return this.failure("Failed to send immediate email");
    }
  }

  async sendNotificationEmail(
    email: string,
    firstName: string,
    title: string,
    message: string,
    type: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = EmailTemplates.notificationEmail(
        firstName,
        title,
        message,
        type
      );
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(undefined, "Notification email queued successfully");
    } catch (error) {
      logger.error("Error queueing notification email:", error);
      return this.failure("Failed to queue notification email");
    }
  }

  // Method to clear the email queue (useful for maintenance)
  async clearQueue(): Promise<ServiceResponse<void>> {
    try {
      await this.redis.del(this.emailQueue);
      logger.info("Email queue cleared");
      return this.success(undefined, "Email queue cleared successfully");
    } catch (error) {
      logger.error("Error clearing email queue:", error);
      return this.failure("Failed to clear email queue");
    }
  }

  // Method to get failed emails (if implemented)
  async getFailedEmails(): Promise<ServiceResponse<QueuedEmail[]>> {
    try {
      // This would require implementing a failed emails queue
      // For now, return empty array
      return this.success([], "No failed emails tracking implemented");
    } catch (error) {
      logger.error("Error getting failed emails:", error);
      return this.failure("Failed to get failed emails");
    }
  }
}

// Export singleton instance for use everywhere (after all class/function definitions)
import { prisma, redis } from "../config";
export const emailServiceSingleton = EmailService.getInstance(prisma, redis);
