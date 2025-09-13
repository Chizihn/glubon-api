import { User } from "@prisma/client";

export interface RecentActivity {
  id: string;
  type: 'USER_SIGNUP' | 'PROPERTY_ADDED' | 'VERIFICATION_SUBMITTED' | 'PAYMENT_RECEIVED' | 'ACCOUNT_VERIFIED';
  description: string;
  timestamp: Date;
  userId: string;
  userName?: string | null; // Made optional to match implementation
  userAvatar?: string | null; // Made explicitly optional to match implementation
  metadata?: Record<string, any>;
}

export interface RecentTransaction {
  id: string;
  type: 'SUBSCRIPTION' | 'COMMISSION' | 'REFUND' | 'WITHDRAWAL' | 'DEPOSIT';
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  timestamp: Date;
  userId?: string | null;
  userName?: string | null; // Made explicitly optional to match implementation
  userAvatar?: string | null; // Made explicitly optional to match implementation
  reference: string;
  description?: string;
}

export interface RecentDataResponse {
  recentActivity: RecentActivity[];
  recentTransactions: RecentTransaction[];
}
