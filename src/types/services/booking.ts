import {
  Booking,
  BookingStatus,
  Dispute,
  DisputeStatus,
  Refund,
  Transaction,
  User,
} from "@prisma/client";

export interface CreateBookingInput {
  propertyId: string;
  startDate: Date;
  endDate?: Date;
  specialRequests?: string | null;
}

export interface CreateDisputeInput {
  bookingId: string;
  reason: string;
  description: string;
  evidence?: string[];
}

export interface ResolveDisputeInput {
  disputeId: string;
  status: DisputeStatus;
  resolution: string;
  refundAmount?: number;
}

export interface CreateRefundInput {
  transactionId: string;
  disputeId?: string;
  amount: number;
  reason: string;
}

export interface RequestWithdrawalInput {
  amount: number;
  paymentMethod: "BANK_TRANSFER";
  details: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    phoneNumber?: string;
  };
}

export interface BookingPaymentResponse {
  booking: Booking;
  paymentUrl: string;
  success: boolean;
}
