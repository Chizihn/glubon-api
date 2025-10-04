import nodemailer, { type Transporter } from "nodemailer";
import { BaseService } from "./base";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils";
import { ServiceResponse } from "../types";
import { 
  UserEmailTemplates,
  PropertyEmailTemplates,
  AdminEmailTemplates,
  ChatEmailTemplates
} from "../templates/email";

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
  scheduledFor?: Date;
}

export class EmailService extends BaseService {
  private static transporter: Transporter | null = null;
  private static isInitializing: boolean = false;
  private emailQueue = "email_queue";

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.initializeTransporter();
    this.startEmailProcessor();
  }

  private static _instance: EmailService;
  static getInstance(prisma: PrismaClient, redis: Redis): EmailService {
    if (!EmailService._instance) {
      EmailService._instance = new EmailService(prisma, redis);
    }
    return EmailService._instance;
  }

  private initializeTransporter(): void {
    // If already initialized or initializing, return
    if (EmailService.transporter || EmailService.isInitializing) {
      return;
    }

    EmailService.isInitializing = true;

    try {
      if (config.NODE_ENV === "production") {
        EmailService.transporter = nodemailer.createTransport({
          host: "gmail",
          port: Number(config.EMAIL_PORT) || 465,
          secure: true,
          auth: {
            user: config.EMAIL_USER,
            pass: config.EMAIL_PASS,
          },
        });
      } else {
        EmailService.transporter = nodemailer.createTransport({
          service: "gmail",
          port: Number(config.EMAIL_PORT) || 587,
          auth: {
            user: config.EMAIL_USER,
            pass: config.EMAIL_PASS,
          },
        });
      }

      EmailService.transporter.verify((error) => {
        EmailService.isInitializing = false;
        if (error) {
          logger.error("Email transporter configuration error:", error);
          EmailService.transporter = null; // Reset on error to allow retry
        } else {
          // logger.info("Email transporter is ready", { service: "graphql-api" });
        }
      });
    } catch (error) {
      EmailService.isInitializing = false;
      logger.error("Failed to initialize email transporter:", error);
    }
  }

  private async startEmailProcessor(): Promise<void> {
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

      const emailsToProcess = Math.min(queueLength, 10);

      for (let i = 0; i < emailsToProcess; i++) {
        const emailData = await this.redis.rpop(this.emailQueue);
        if (!emailData) continue;

        const queuedEmail: QueuedEmail = JSON.parse(emailData);

        if (queuedEmail.scheduledFor && new Date() < queuedEmail.scheduledFor) {
          await this.redis.lpush(this.emailQueue, emailData);
          continue;
        }

        try {
          await this.sendEmailDirectly(queuedEmail);
          // logger.info(`Email sent successfully: ${queuedEmail.id}`);
        } catch (error) {
          logger.error(`Failed to send email: ${queuedEmail.id}`, error);
          queuedEmail.attempts++;
          if (queuedEmail.attempts < queuedEmail.maxAttempts) {
            const delay = Math.pow(2, queuedEmail.attempts) * 60000;
            queuedEmail.scheduledFor = new Date(Date.now() + delay);
            await this.redis.lpush(
              this.emailQueue,
              JSON.stringify(queuedEmail)
            );
            // logger.info(
            //   `Email requeued for retry: ${queuedEmail.id}, attempt ${queuedEmail.attempts}`
            // );
          } else {
            logger.error(`Email failed permanently: ${queuedEmail.id}`);
          }
        }
      }
    } catch (error) {
      logger.error("Error processing email queue:", error);
    }
  }

  private async sendEmailDirectly(emailOptions: EmailOptions): Promise<void> {
    if (!EmailService.transporter) {
      throw new Error("Email transporter not initialized");
    }
    
    try {
      await EmailService.transporter.sendMail({
        from: emailOptions.from || `"Glubon" <${config.EMAIL_USER}>`,
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text,
      });
    } catch (error) {
      logger.error("Error sending email:", error);
      throw error;
    }
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = UserEmailTemplates.welcomeEmail(firstName);
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

  async sendAdminWelcomeEmail(
    email: string,
    firstName: string,
    password: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = AdminEmailTemplates.adminWelcomeEmail(firstName, password);
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(undefined, "Admin welcome email queued successfully");
    } catch (error) {
      logger.error("Error queueing admin welcome email:", error);
      return this.failure("Failed to queue admin welcome email");
    }
  }

  async sendVerificationCode(
    email: string,
    firstName: string,
    code: string,
    purpose: "email_verification" | "password_reset"
  ): Promise<ServiceResponse<void>> {
    try {
      const template = UserEmailTemplates.verificationCode(
        firstName,
        code,
        purpose
      );

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
      const template = PropertyEmailTemplates.propertyAlert(
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
      const template = PropertyEmailTemplates.propertyApproval(
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
      const template = AdminEmailTemplates.identityVerification(
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

  async sendUserStatusChangeNotification(
    email: string,
    firstName: string,
    status: string,
    reason?: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = UserEmailTemplates.userStatusChangeNotification(
        firstName,
        status,
        reason as string
      );
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(
        undefined,
        "User status change notification queued successfully"
      );
    } catch (error) {
      logger.error("Error queueing user status change notification:", error);
      return this.failure("Failed to queue user status change notification");
    }
  }

  async sendAdminDeactivationNotification(
    email: string,
    firstName: string
  ): Promise<ServiceResponse<void>> {
    try {
      const template = AdminEmailTemplates.adminDeactivationNotification(firstName);
      await this.addToQueue({
        to: email,
        ...template,
      });

      return this.success(
        undefined,
        "Admin deactivation notification queued successfully"
      );
    } catch (error) {
      logger.error("Error queueing admin deactivation notification:", error);
      return this.failure("Failed to queue admin deactivation notification");
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
      const template = ChatEmailTemplates.chatNotification(
        recipientName,
        senderName,
        propertyTitle,
        messagePreview,
        chatId
      );

      const scheduledFor = new Date(Date.now() + 300000);
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
      const template = UserEmailTemplates.notificationEmail(
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

  async getFailedEmails(): Promise<ServiceResponse<QueuedEmail[]>> {
    try {
      return this.success([], "No failed emails tracking implemented");
    } catch (error) {
      logger.error("Error getting failed emails:", error);
      return this.failure("Failed to get failed emails");
    }
  }
}

import { prisma, redis } from "../config";
export const emailServiceSingleton = EmailService.getInstance(prisma, redis);
