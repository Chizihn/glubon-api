// modules/tickets/ticket.inputs.ts
import { Field, InputType } from 'type-graphql';
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
import { PaginationInput, SortInput } from '../../types';

@InputType()
export class CreateTicketInput {
  @Field()
  subject: string;

  @Field()
  description: string;

  @Field(() => TicketPriority, { nullable: true })
  priority?: TicketPriority;

  @Field(() => TicketCategory, { nullable: true })
  category?: TicketCategory;
}

@InputType()
export class UpdateTicketInput {
  @Field()
  id: string;

  @Field(() => TicketStatus, { nullable: true })
  status?: TicketStatus;

  @Field(() => TicketPriority, { nullable: true })
  priority?: TicketPriority;

  @Field(() => TicketCategory, { nullable: true })
  category?: TicketCategory;

  @Field({ nullable: true })
  assignedTo?: string;
}

@InputType()
export class TicketFilterInput {
  @Field(() => [TicketStatus], { nullable: true })
  status?: TicketStatus[];

  @Field(() => [TicketPriority], { nullable: true })
  priority?: TicketPriority[];

  @Field(() => [TicketCategory], { nullable: true })
  category?: TicketCategory[];

  @Field({ nullable: true })
  assignedTo?: string;

  @Field({ nullable: true })
  createdBy?: string;

  @Field(() => Date, { nullable: true })
  dateFrom?: Date;

  @Field(() => Date, { nullable: true })
  dateTo?: Date;

  @Field({ nullable: true })
  search?: string;

  @Field(() => PaginationInput, { nullable: true })
  pagination?: PaginationInput;

  @Field(() => SortInput, { nullable: true })
  sort?: SortInput;
}


