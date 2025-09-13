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
import { prisma } from "../../config";
import { redis } from "../../config";
import { AuthMiddleware, RequireRole } from "../../middleware/auth";
import { BookingService,  } from "../../services/booking";
import { BookingStatus, RoleEnum } from "@prisma/client";
import { 
  CreateBookingInput, 
  CreateBookingRequestInput, 
  RespondToBookingRequestInput 
} from "./booking.inputs";
import { 
  BookingResponse, 
  BookingRequestResponse,
  PaginatedBookingsResponse
} from "./booking.types";
import { ServiceResponse } from "../../types";

@Resolver()
export class BookingResolver {
  private bookingService: BookingService;

  constructor() {
    this.bookingService = new BookingService(prisma, redis);
  }

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
    if (!result.success) throw new Error(result.message);
    return {
      booking: result.data!.booking,
      success: true,
      message: 'Booking request created successfully. Waiting for host approval.'
    };
  }

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
    if (!result.success) throw new Error(result.message);
    return {
      booking: result.data!.booking,
      success: true,
      message: input.accept 
        ? 'Booking request accepted successfully' 
        : 'Booking request declined'
    };
  }

  @Query(() => PaginatedBookingsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.RENTER, RoleEnum.LISTER))
  async myBookingRequests(
    @Ctx() ctx: Context,
    @Arg('page', () => Int, { nullable: true, defaultValue: 1 }) page: number,
    @Arg('limit', () => Int, { nullable: true, defaultValue: 10 }) limit: number,
    @Arg('status', () => BookingStatus, { nullable: true }) status?: BookingStatus
  ): Promise<PaginatedBookingsResponse> {
    let result;
    if (ctx.user!.role === RoleEnum.LISTER) {
      result = await this.bookingService.getHostBookingRequests(
        ctx.user!.id,
        page,
        limit,
        status
      );
    } else {
      result = await this.bookingService.getRenterBookingRequests(
        ctx.user!.id,
        page,
        limit,
        status
      );
    }
    if (!result.success) throw new Error(result.message);
    return {
      items: result.data!.items,
      pagination: {
        currentPage: result.data!.pagination.currentPage,
        totalPages: result.data!.pagination.totalPages,
        totalItems: result.data!.totalCount,
        hasNextPage: result.data!.pagination.hasNextPage,
        hasPreviousPage: result.data!.pagination.hasPreviousPage,
        limit: result.data!.pagination.limit
      },
      totalCount: result.data!.totalCount,
      success: true
    };
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async createBooking(
    @Arg("input") input: CreateBookingInput,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const serviceInput: import("../../services/booking").CreateBookingInput = {
      ...input,
      units: input.unitIds
    };
    const result = await this.bookingService.createBooking(
      serviceInput,
      ctx.user!.id
    );
    if (!result.success) throw new Error(result.message);
    return {
      booking: result.data!.booking,
      paymentUrl: result.data!.paymentUrl,
      success: true,
      message: 'Booking created successfully'
    };
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async confirmBookingPayment(
    @Arg("reference") reference: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.bookingService.confirmBookingPayment({
      reference,
      userId: ctx.user!.id
    });
    if (!result.success) throw new Error(result.message);
    return true;
  }

  @Query(() => PaginatedBookingsResponse)
  @UseMiddleware(AuthMiddleware)
  async getUserBookings(
    @Ctx() ctx: Context,
    @Arg('page', () => Int, { nullable: true, defaultValue: 1 }) page: number,
    @Arg('limit', () => Int, { nullable: true, defaultValue: 10 }) limit: number,
    @Arg('userId', () => String, { nullable: true }) userId?: string,
    @Arg('status', () => BookingStatus, { nullable: true }) status?: BookingStatus
  ): Promise<PaginatedBookingsResponse> {
    const targetUserId = userId || ctx.user!.id;
    
    // Build the input object with type assertion to handle the status field
    const input = {
      targetUserId,
      currentUserRole: ctx.user!.role,
      currentUserId: ctx.user!.id,
      page,
      limit,
      ...(status !== undefined && { status })
    } as const;
    
    const result = await this.bookingService.getUserBookings(input);
    if (!result.success) throw new Error(result.message);
    return {
      items: result.data!.items,
      pagination: {
        currentPage: result.data!.pagination.currentPage,
        totalPages: result.data!.pagination.totalPages,
        totalItems: result.data!.totalCount,
        hasNextPage: result.data!.pagination.hasNextPage,
        hasPreviousPage: result.data!.pagination.hasPreviousPage,
        limit: result.data!.pagination.limit
      },
      totalCount: result.data!.totalCount,
      success: true
    };
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async confirmBooking(
    @Arg("bookingId") bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.updateBookingStatus({
      bookingId,
      status: BookingStatus.CONFIRMED,
      userId: ctx.user!.id
    });
    if (!result.success) throw new Error(result.message);
    return {
      booking: result.data!.booking,
      paymentUrl: '',
      success: true,
      message: 'Booking confirmed successfully'
    };
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async rejectBooking(
    @Arg("bookingId") bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const result = await this.bookingService.updateBookingStatus({
      bookingId,
      status: BookingStatus.CANCELLED,
      userId: ctx.user!.id
    });
    if (!result.success) throw new Error(result.message);
    return {
      booking: result.data!.booking,
      paymentUrl: '',
      success: true,
      message: 'Booking rejected successfully'
    };
  }
}