import { PrismaClient } from '@prisma/client';
import { ExpiredBookingWorker, initializeExpiredBookingWorker } from './expired-booking.worker';

export let expiredBookingWorker: ExpiredBookingWorker;

export function initializeWorkers(prisma: PrismaClient): void {
  // Initialize the expired booking worker to run every 24 hours
  initializeExpiredBookingWorker(prisma, 24);
}
