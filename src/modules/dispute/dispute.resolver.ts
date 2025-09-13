// src/resolvers/dispute.resolver.ts
import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
  FieldResolver,
  Root,
} from "type-graphql";
import { Context } from "../../types";
import {  Booking } from "../booking/booking.types";
import { DisputeService } from "../../services/dispute";
import { AuthMiddleware } from "../../middleware";
import { CreateDisputeInput, ResolveDisputeInput } from "./dispute.inputs";
import { ResolveDisputeInput as ServiceResolveDisputeInput } from "../../types/services/booking";
import { ServiceResponse } from "../../types";
import { Dispute, PaginatedDisputes } from "./dispute.types";
import { User } from "../user/user.types";

@Resolver(() => Dispute)
export class DisputeResolver {
  constructor(private readonly disputeService: DisputeService) {}

  @FieldResolver(() => Booking, { nullable: true })
  async booking(@Root() dispute: Dispute): Promise<Booking | null> {
    // If booking is already loaded, return it
    if ((dispute as any).booking) {
      return (dispute as any).booking;
    }
    
    // Otherwise, fetch it from the database
    const booking = await this.disputeService.getDisputeWithRelations(dispute.id);
    return booking?.booking || null;
  }

  @FieldResolver(() => User, { nullable: true })
  async initiator(@Root() dispute: Dispute): Promise<User | null> {
    // If initiator is already loaded, return it
    if ((dispute as any).initiator) {
      return (dispute as any).initiator;
    }
    
    // Otherwise, fetch it from the database
    const disputeWithInitiator = await this.disputeService.getDisputeWithRelations(dispute.id);
    return disputeWithInitiator?.initiator || null;
  }

  @Mutation(() => Dispute)
  @UseMiddleware(AuthMiddleware)
  async createDispute(
    @Arg("input") input: CreateDisputeInput,
    @Ctx() ctx: Context
  ): Promise<Dispute> {
    const result = await this.disputeService.createDispute(input, ctx.user!.id);
    if (result && 'success' in result) {
      if (!result.success) throw new Error(result.message);
      // The service returns a plain object, we need to ensure it matches the Dispute type
      const disputeData = result.data as any;
      return {
        ...disputeData,
        booking: null, // Will be resolved by the field resolver
        initiator: null // Will be resolved by the field resolver
      } as unknown as Dispute;
    }
    // If it's not a ServiceResponse, it's already a Dispute
    const dispute = result as any;
    return {
      ...dispute,
      booking: null,
      initiator: null
    } as unknown as Dispute;
  }

  @Mutation(() => Dispute)
  @UseMiddleware(AuthMiddleware)
  async resolveDispute(
    @Arg("input") input: ResolveDisputeInput,
    @Ctx() ctx: Context
  ): Promise<Dispute> {
    // Create service input with proper type handling for refundAmount
    const serviceInput: ServiceResolveDisputeInput = {
      disputeId: input.disputeId,
      status: input.status,
      resolution: input.resolution,
    };
    
    // Only include refundAmount if it's a valid number
    if (typeof input.refundAmount === 'number') {
      serviceInput.refundAmount = input.refundAmount;
    }

    const result = await this.disputeService.resolveDispute(
      serviceInput,
      ctx.user!.id
    );

    if (result && 'success' in result) {
      if (!result.success) throw new Error(result.message);
      // The service returns a plain object, we need to ensure it matches the Dispute type
      const disputeData = result.data as any;
      return {
        ...disputeData,
        booking: null, // Will be resolved by the field resolver
        initiator: null // Will be resolved by the field resolver
      } as unknown as Dispute;
    }
    // If it's not a ServiceResponse, it's already a Dispute
    const dispute = result as any;
    return {
      ...dispute,
      booking: null,
      initiator: null
    } as unknown as Dispute;
  }

  @Query(() => PaginatedDisputes)
  @UseMiddleware(AuthMiddleware)
  async getPendingDisputes(): Promise<PaginatedDisputes> {
    const response = await this.disputeService.getPendingDisputes();
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to retrieve disputes');
    }
    
    return response.data;
  }
}