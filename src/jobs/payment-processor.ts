import cron from "node-cron";
import { logger } from "../utils";
import { Container } from "typedi";
import { TransactionService } from "../services/transaction";
import { PRISMA_TOKEN } from "../types/di-tokens";
import { PrismaClient } from "@prisma/client";

// Run every 15 minutes to process pending payments
cron.schedule("*/15 * * * *", async () => {
  try {
    const transactionService = Container.get(TransactionService);
    const prisma = Container.get(PRISMA_TOKEN) as PrismaClient;
    
    // Find pending transactions older than 5 minutes
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        status: "PENDING",
        createdAt: {
          lte: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        },
      },
      include: {
        booking: true,
      },
    });

    // logger.info(`Found ${pendingTransactions.length} pending transactions to process`);

    for (const tx of pendingTransactions) {
      try {
        // Verify payment status with payment gateway
        const txMetadata = tx.metadata as { gatewayReference?: string; [key: string]: any } || {};
        const gatewayReference = txMetadata.gatewayReference;
        
        if (tx.gateway === "PAYSTACK" && gatewayReference) {
          await transactionService.verifyTransaction(gatewayReference);
        }
        // Add other payment gateways as needed
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error processing transaction ${tx.id}:`, errorMessage);
        
        // Get current retry count from metadata
        const txMetadata = tx.metadata as { retryCount?: number; [key: string]: any } || {};
        const currentRetryCount = txMetadata.retryCount || 0;
        const maxRetries = 3;
        
        // Update transaction status to failed after max retries
        if (currentRetryCount >= maxRetries) {
          // const prisma = Container.get(PRISMA_TOKEN); // Already got prisma above
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { 
              status: "FAILED",
              metadata: {
                ...txMetadata,
                error: errorMessage,
                lastRetry: new Date().toISOString(),
                retryCount: currentRetryCount + 1,
              } as any,
            },
          });
        } else {
          // Increment retry count
          // const prisma = Container.get(PRISMA_TOKEN); // Already got prisma above
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { 
              metadata: {
                ...txMetadata,
                lastRetry: new Date().toISOString(),
                retryCount: currentRetryCount + 1,
              } as any,
            },
          });
        }
      }
    }
  } catch (error) {
    logger.error("Error in payment processor job:", error);
  }
});
