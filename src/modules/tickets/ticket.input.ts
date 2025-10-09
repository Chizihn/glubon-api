// import { Field, InputType } from 'type-graphql';
// import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
// import { PaginationInput } from '../transaction/transaction.types';

// @InputType()
// export class CreateTicketInput {
//   @Field(() => String)
//   subject: string;

//   @Field(() => String)
//   description: string;

//   @Field(() => TicketPriority, { nullable: true })
//   priority?: TicketPriority;

//   @Field(() => TicketCategory, { nullable: true })
//   category?: TicketCategory;

//   @Field(() => [String], { nullable: true })
//   attachments?: string[];
// }

// @InputType()
// export class UpdateTicketInput {
//   @Field(() => TicketStatus, { nullable: true })
//   status?: TicketStatus;

//   @Field(() => TicketPriority, { nullable: true })
//   priority?: TicketPriority;

//   @Field(() => TicketCategory, { nullable: true })
//   category?: TicketCategory;

//   @Field(() => String, { nullable: true })
//   assignedTo?: string;
// }

// @InputType()
// export class AddMessageInput {
//   @Field(() => String)
//   ticketId: string;

//   @Field(() => String)
//   content: string;

//   @Field(() => Boolean, { nullable: true })
//   isInternal?: boolean;

//   @Field(() => [String], { nullable: true })
//   attachments?: string[];
// }

// @InputType()
// export class TicketFilterInput {
//   @Field(() => [TicketStatus], { nullable: true })
//   status?: TicketStatus[];

//   @Field(() => [TicketPriority], { nullable: true })
//   priority?: TicketPriority[];

//   @Field(() => [TicketCategory], { nullable: true })
//   category?: TicketCategory[];

//   @Field(() => String, { nullable: true })
//   assignedTo?: string;

//   @Field(() => String, { nullable: true })
//   createdBy?: string;

//   @Field(() => Date, { nullable: true })
//   dateFrom?: Date;

//   @Field(() => Date, { nullable: true })
//   dateTo?: Date;

//   @Field(() => String, { nullable: true })
//   search?: string;

//   @Field(() => PaginationInput, { nullable: true })
//   pagination?: PaginationInput;

//   @Field(() => SortInput, { nullable: true })
//   sort?: SortInput;
// }

// @InputType()
// export class SortInput {
//   @Field(() => String, { nullable: true })
//   field?: string;

//   @Field(() => String, { nullable: true })
//   order?: 'asc' | 'desc';
// }