import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../../utils";

export const PAYMENT_QUEUE_NAME = "payment-verification";

export class PaymentQueue {
  private queue: Queue;

  constructor(redis: Redis) {
    this.queue = new Queue(PAYMENT_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
    logger.info(`Payment queue '${PAYMENT_QUEUE_NAME}' initialized`);
  }

  async addVerificationJob(data: {
    reference: string;
    bookingId?: string;
    userId?: string;
    attempt?: number;
  }) {
    return this.queue.add("verify-payment", data);
  }

  async getQueue() {
    return this.queue;
  }
}
