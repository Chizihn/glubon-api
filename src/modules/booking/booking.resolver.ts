//src/modules/booking/booking.resolver.ts
import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
  Int,
} from "type-graphql";
import { Context } from "../../types/context";
import { getContainer } from "../../services";
import { AuthMiddleware, RequireRole } from "../../middleware/auth";
import { BookingService } from "../../services/booking";
import { BookingStatus, RoleEnum } from "@prisma/client";
import {
  CreateBookingInput,
  CreateBookingRequestInput,
  RespondToBookingRequestInput,
  VerifyPaymentInput,
} from "./booking.inputs";
import {
  BookingResponse,
  BookingRequestResponse,
  PaginatedBookingsResponse,
} from "./booking.types";

@Resolver()
export class BookingResolver {
  private bookingService: BookingService;

  private paymentService: any; // We'll use any type to avoid import issues

  constructor() {
    const container = getContainer();
    this.bookingService = container.resolve('bookingService');
    this.paymentService = container.resolve('paystackService');
  }

  /**
   * Step 1: Create a booking request (no payment yet)
   */
  @Mutation(() => BookingRequestResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async createBookingRequest(
    @Arg("input") input: CreateBookingRequestInput,
    @Ctx() ctx: Context
  ): Promise<BookingRequestResponse> {
    const result = await this.bookingService.createBookingRequest(
      input,
      ctx.user!.id
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      booking: result.data!.booking,
      success: true,
      message: result.message,
    };
  }

  /**
   * Step 2: Host responds to booking request
   */
  @Mutation(() => BookingRequestResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async respondToBookingRequest(
    @Arg("input") input: RespondToBookingRequestInput,
    @Ctx() ctx: Context
  ): Promise<BookingRequestResponse> {
    const result = await this.bookingService.respondToBookingRequest(
      input.bookingId,
      ctx.user!.id,
      input.accept
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      booking: result.data!.booking,
      success: true,
      message: result.message,
    };
  }

  /**
   * Step 3: Create actual booking with payment (after approval)
   */
  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async createBooking(
    @Arg("input") input: CreateBookingInput,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.createBooking(
      input,
      ctx.user!.id
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    if (!result.data) {
      throw new Error('Failed to create booking');
    }
    
    return {
      booking: result.data.booking,
      paymentUrl: result.data.paymentUrl,
      success: true,
      message: result.message,
    };
  }

  /**
   * Verify payment for a booking (for renter)
   */
  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async verifyPayment(
    @Arg("reference") reference: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.verifyPayment(
      reference,
      ctx.user!.id
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      booking: result.data!.booking,
      success: true,
      message: 'Payment verified successfully',
    };
  }

  /**
   * Confirm funds received (for lister)
   */
  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async confirmFundsReceived(
    @Arg("bookingId") bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.confirmFundsReceived(
      bookingId,
      ctx.user!.id
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      booking: result.data!.booking,
      success: true,
      message: 'Funds confirmed successfully',
    };
  }

  /**
   * Step 4: Confirm payment
   */
  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async confirmBookingPayment(
    @Arg("reference") reference: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.bookingService.confirmBookingPayment({
      reference,
      userId: ctx.user!.id,
    });
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return true;
  }

  /**
   * Get host's booking requests
   */
  @Query(() => PaginatedBookingsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async myBookingRequests(
    @Ctx() ctx: Context,
    @Arg("page", () => Int, { nullable: true, defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { nullable: true, defaultValue: 10 }) limit: number,
    @Arg("status", () => BookingStatus, { nullable: true }) status?: BookingStatus
  ): Promise<PaginatedBookingsResponse> {
    const result = await this.bookingService.getHostBookingRequests(
      ctx.user!.id,
      page,
      limit,
      status
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      items: result.data!.items,
      pagination: {
        page: result.data!.pagination.currentPage,
        totalPages: result.data!.pagination.totalPages,
        totalItems: result.data!.totalCount,
        hasNextPage: result.data!.pagination.hasNextPage,
        hasPreviousPage: result.data!.pagination.hasPreviousPage,
        limit: result.data!.pagination.limit,
      },
      totalCount: result.data!.totalCount,
      success: true,
    };
  }

  /**
   * Get renter's bookings
   */
  @Query(() => PaginatedBookingsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async myBookings(
    @Ctx() ctx: Context,
    @Arg("page", () => Int, { nullable: true, defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { nullable: true, defaultValue: 10 }) limit: number,
    @Arg("status", () => BookingStatus, { nullable: true }) status?: BookingStatus
  ): Promise<PaginatedBookingsResponse> {
    const result = await this.bookingService.getRenterBookings(
      ctx.user!.id,
      page,
      limit,
      status
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      items: result.data!.items,
      pagination: {
        page: result.data!.pagination.currentPage,
        totalPages: result.data!.pagination.totalPages,
        totalItems: result.data!.totalCount,
        hasNextPage: result.data!.pagination.hasNextPage,
        hasPreviousPage: result.data!.pagination.hasPreviousPage,
        limit: result.data!.pagination.limit,
      },
      totalCount: result.data!.totalCount,
      success: true,
    };
  }

  /**
   * Get a specific booking
   */
  @Query(() => BookingResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER, RoleEnum.LISTER, RoleEnum.ADMIN))
  async getBooking(
    @Arg("id", () => String) id: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.getUserBookingById(id, ctx.user!.id);
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      booking: result.data!,
      success: true,
      message: "Booking retrieved successfully",
    };
  }

  /**
   * Cancel a booking
   */
  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER, RoleEnum.LISTER))
  async cancelBooking(
    @Arg("bookingId") bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.updateBookingStatus({
      bookingId,
      status: BookingStatus.CANCELLED,
      userId: ctx.user!.id,
    });
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      booking: result.data!.booking,
      success: true,
      message: "Booking cancelled successfully",
    };
  }

  /**
   * Complete a booking (for hosts)
   */
  // @Mutation(() => BookingResponse)
  // @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  // async completeBooking(
  //   @Arg("bookingId") bookingId: string,
  //   @Ctx() ctx: Context
  // ): Promise<BookingResponse> {
  //   const result = await this.bookingService.updateBookingStatus({
  //     bookingId,
  //     status: BookingStatus.COMPLETED,
  //     userId: ctx.user!.id,
  //   });
    
  //   if (!result.success) {
  //     throw new Error(result.message);
  //   }

  //   return {
  //     booking: result.data!.booking,
  //     success: true,
  //     message: "Booking completed successfully",
  //   };
  // }

  /**
   * Retry payment for a booking
   */
  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER))
  async retryPayment(
    @Arg("bookingId") bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    // Call the payment service to generate a new payment URL
    const result = await this.paymentService.retryPayment(bookingId, ctx.user!.id);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to retry payment');
    }
    
    // Get the updated booking with payment URL
    const bookingResult = await this.bookingService.getUserBookingById(bookingId, ctx.user!.id);
    
    if (!bookingResult.success || !bookingResult.data) {
      throw new Error('Failed to retrieve booking after payment retry');
    }
    
    return {
      booking: bookingResult.data,
      paymentUrl: result.data.paymentUrl,
      success: true,
      message: 'Payment URL generated successfully',
    };
  }

  /**
   * Admin: Get user bookings
   */
  @Query(() => PaginatedBookingsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
  async getUserBookings(
    @Arg("userId") userId: string,
    @Ctx() ctx: Context,
    @Arg("page", () => Int, { nullable: true, defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { nullable: true, defaultValue: 10 }) limit: number,
    @Arg("status", () => BookingStatus, { nullable: true }) status?: BookingStatus
  ): Promise<PaginatedBookingsResponse> {
    const result = await this.bookingService.getRenterBookings(
      userId,
      page,
      limit,
      status
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      items: result.data!.items,
      pagination: {
        page: result.data!.pagination.currentPage,
        totalPages: result.data!.pagination.totalPages,
        totalItems: result.data!.totalCount,
        hasNextPage: result.data!.pagination.hasNextPage,
        hasPreviousPage: result.data!.pagination.hasPreviousPage,
        limit: result.data!.pagination.limit,
      },
      totalCount: result.data!.totalCount,
      success: true,
    };
  }
}