// import { Field, ObjectType, registerEnumType } from 'type-graphql';
// import { Ticket as PrismaTicket, TicketMessage as PrismaTicketMessage, TicketStatus, TicketPriority, TicketCategory, User } from '@prisma/client';
// import { PaginationInfo } from '../../types/responses';

// registerEnumType(TicketStatus, {
//   name: 'TicketStatus',
//   description: 'The current status of a support ticket',
// });

// registerEnumType(TicketPriority, {
//   name: 'TicketPriority',
//   description: 'The priority level of a support ticket',
// });

// registerEnumType(TicketCategory, {
//   name: 'TicketCategory',
//   description: 'The category of a support ticket',
// });

// @ObjectType()
// export class Ticket implements PrismaTicket {
//   @Field(() => String)
//   id: string;

//   @Field(() => String)
//   subject: string;

//   @Field(() => String)
//   description: string;

//   @Field(() => TicketStatus)
//   status: TicketStatus;

//   @Field(() => TicketPriority)
//   priority: TicketPriority;

//   @Field(() => TicketCategory)
//   category: TicketCategory;

//   @Field(() => Date)
//   createdAt: Date;

//   @Field(() => Date)
//   updatedAt: Date;

//   @Field(() => Date, { nullable: true })
//   resolvedAt?: Date;

//   @Field(() => Date, { nullable: true })
//   closedAt?: Date;

//   @Field(() => Date, { nullable: true })
//   assignedAt?: Date;

//   @Field(() => User)
//   createdBy: User;

//   @Field(() => User, { nullable: true })
//   assignedTo?: User;

//   @Field(() => [TicketMessage])
//   messages: TicketMessage[];

//   @Field(() => [String])
//   attachments: string[];
// }

// @ObjectType()
// export class TicketMessage implements PrismaTicketMessage {
//   @Field(() => String)
//   id: string;

//   @Field(() => String)
//   content: string;

//   @Field(() => Boolean)
//   isInternal: boolean;

//   @Field(() => [String])
//   attachments: string[];

//   @Field(() => Date)
//   createdAt: Date;

//   @Field(() => Date)
//   updatedAt: Date;

//   @Field(() => User)
//   sender: User;
// }

// @ObjectType()
// export class PaginatedTicketsResponse {
//   @Field(() => [Ticket])
//   data: Ticket[];

//   @Field(() => PaginationInfo)
//   pagination: PaginationInfo;
// }

// @ObjectType()
// export class TicketStats {
//   @Field(() => Number)
//   open: number;

//   @Field(() => Number)
//   inProgress: number;

//   @Field(() => Number)
//   resolved: number;

//   @Field(() => Number)
//   closed: number;

//   @Field(() => Number)
//   total: number;

//   @Field(() => Object)
//   byPriority: { [key in TicketPriority]: number };

//   @Field(() => Object)
//   byCategory: { [key in TicketCategory]: number };
// }