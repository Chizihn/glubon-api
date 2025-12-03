import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../../utils";
import { Container } from "../../container";
import { PAYMENT_QUEUE_NAME } from "../queues/payment.queue";
import { TransactionService } from "../../services/transaction";

export class PaymentWorker {
  private worker: Worker;
  private container: Container;

  constructor(container: Container, redis: Redis) {
    this.container = container;
    
    this.worker = new Worker(
      PAYMENT_QUEUE_NAME,
      async (job: Job) => {
        logger.info(`Processing payment verification job ${job.id} for reference: ${job.data.reference}`);
        await this.processPaymentVerification(job);
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    this.worker.on("completed", (job) => {
      logger.info(`Payment verification job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      logger.error(`Payment verification job ${job?.id} failed: ${err.message}`);
    });

    logger.info(`Payment worker for '${PAYMENT_QUEUE_NAME}' initialized`);
  }

  private async processPaymentVerification(job: Job) {
    const { reference } = job.data;
    
    if (!reference) {
      throw new Error("Job data missing reference");
    }

    const transactionService = new TransactionService(
      this.container.getPrisma(),
      this.container.getRedis()
    );

    try {
      // Verify the transaction using the existing service logic
      // This service handles calling Paystack and updating the transaction/booking status
      const result = await transactionService.verifyTransaction(reference);
      
      if (!result.success) {
        // If verification fails but it's not a terminal error (e.g. network issue), 
        // throwing an error will cause BullMQ to retry based on backoff settings
        // If the payment is actually failed/abandoned, the service might return success=false
        // We need to decide if we want to retry.
        
        // For now, if the service says it failed, we assume it might be pending or temporary error
        // unless it explicitly says "abandoned" or "failed" in a way that shouldn't be retried.
        // But transactionService.verifyTransaction usually updates the DB.
        
        // If the transaction is still PENDING after verification, we might want to throw to retry later
        // But let's check the transaction status first.
        
        const tx = await this.container.getPrisma().transaction.findUnique({
          where: { reference },
        });
        
        if (tx && tx.status === 'PENDING') {
             throw new Error(result.message || "Payment verification failed, retrying...");
        }
      }
      
      return result;
    } catch (error: any) {
      logger.error(`Error in payment worker: ${error.message}`);
      throw error; // Re-throw to trigger retry
    }
  }

  async close() {
    await this.worker.close();
  }
}
