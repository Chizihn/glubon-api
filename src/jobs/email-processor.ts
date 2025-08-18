import cron from "node-cron";
import { prisma, config } from "../config";
import { logger } from "../utils";
import { emailServiceSingleton } from "../services/email";
import { NotificationType } from "@prisma/client";

// Run every minute to process email queue
cron.schedule("* * * * *", async () => {
  try {
    // Get up to 50 unsent notifications that should be sent by now
    const pendingEmails = await prisma.notification.findMany({
      where: {
        type: "EMAIL" as NotificationType,
        data: {
          path: ["status"],
          equals: "PENDING"
        },
        createdAt: {
          lte: new Date() // Only process emails that should be sent by now
        }
      },
      orderBy: {
        createdAt: "asc" // Process oldest first
      },
      take: 50 // Process in batches of 50
    });

    if (pendingEmails.length > 0) {
      logger.info(`Processing ${pendingEmails.length} queued emails`);
    }

    for (const email of pendingEmails) {
      try {
        // Parse email data
        const emailData = email.data as {
          to: string;
          subject: string;
          html: string;
          text: string;
          status?: string;
          from?: string;
          retryCount?: number;
          nextRetryAt?: string | null;
        };

        // Update status to processing
        await prisma.notification.update({
          where: { id: email.id },
          data: { 
            data: {
              ...emailData,
              status: "PROCESSING"
            }
          }
        });

        // Send the email using the immediate email method
        await emailServiceSingleton.sendImmediateEmail({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          from: emailData.from || config.EMAIL_FROM
        });

        // Mark as sent
        await prisma.notification.update({
          where: { id: email.id },
          data: { 
            data: {
              ...emailData,
              status: "SENT",
              sentAt: new Date().toISOString()
            }
          }
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error sending email ${email.id}:`, errorMessage);
        
        // Update with error status
        const emailData = email.data as any || {};
        const retryCount = (emailData.retryCount || 0) + 1;
        const shouldRetry = retryCount < 3; // Max 3 retries
        
        await prisma.notification.update({
          where: { id: email.id },
          data: { 
            data: {
              ...emailData,
              status: shouldRetry ? 'PENDING' : 'FAILED',
              error: errorMessage,
              lastAttemptedAt: new Date().toISOString(),
              retryCount,
              nextRetryAt: shouldRetry ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null
            }
          }
        });
      }
    }
  } catch (error) {
    logger.error("Error in email processor job:", error);
  }
});
