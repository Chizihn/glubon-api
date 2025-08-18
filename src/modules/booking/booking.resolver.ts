// src/resolvers/booking.resolver.ts
import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types/context";
import { prisma } from "../../config";
import { redis } from "../../config";
import { AuthMiddleware } from "../../middleware";
import { BookingService } from "../../services/booking";
import { CreateBookingInput } from "./booking.inputs";
import { Booking, BookingResponse } from "./booking.types";
import { ServiceResponse } from "../../types/responses";

@Resolver()
export class BookingResolver {
  private bookingService: BookingService;
  //   private platformFeeService: PlatformFeeService;

  constructor() {
    this.bookingService = new BookingService(prisma, redis);
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async createBooking(
    @Arg("input") input: CreateBookingInput,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.createBooking(
      input, 
      ctx.user!.id
    ) as ServiceResponse<{ booking: any; paymentUrl: string }>;

    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to create booking');
    }

    return {
      booking: result.data.booking as any, // Cast to any to handle complex type
      paymentUrl: result.data.paymentUrl,
      success: true,
    };
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async confirmBookingPayment(
    @Arg("reference") reference: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.bookingService.confirmBookingPayment(
      reference,
      ctx.user!.id
    ) as ServiceResponse<{ success: boolean }>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to confirm booking payment');
    }

    return true;
  }

  @Query(() => [Booking])
  @UseMiddleware(AuthMiddleware)
  async getUserBookings(
    @Ctx() ctx: Context,
    @Arg('userId', () => String, { nullable: true }) userId?: string
  ): Promise<Booking[]> {
    // If userId is provided, verify the requester is an admin
    if (userId && ctx.user?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only admins can view other users\' bookings');
    }
    
    const targetUserId = userId || ctx.user!.id;
    const result = await this.bookingService.getUserBookings(
      targetUserId,
      ctx.user?.role,
      ctx.user?.id
    ) as ServiceResponse<Booking[]>;
    
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to fetch bookings');
    }
    
    return result.data;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async completeBooking(
    @Arg("bookingId") bookingId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.bookingService.completeBooking(
      bookingId,
      ctx.user!.id
    ) as ServiceResponse<{ success: boolean }>;

    if (!result.success) {
      throw new Error(result.message || 'Failed to complete booking');
    }

    return true;
  }
}
