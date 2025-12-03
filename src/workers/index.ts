import { PrismaClient } from '@prisma/client';
import { ExpiredBookingWorker, initializeExpiredBookingWorker } from './expired-booking.worker';
import { initializeEmailWorker } from '../jobs/email-processor';

export let expiredBookingWorker: ExpiredBookingWorker;

export function initializeWorkers(prisma: PrismaClient): void {
  // Initialize the expired booking worker to run every 24 hours
  initializeExpiredBookingWorker(prisma, 24);
  
  // Initialize email worker
  initializeEmailWorker();
}
