// modules/tickets/ticket.types.ts
import { Field, GraphQLISODateTime, ID, ObjectType, registerEnumType } from 'type-graphql';
import { Ticket as PrismaTicket, TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';
import { PaginationInfo } from '../../types';
import { User } from '../user/user.types';

registerEnumType(TicketStatus, { name: 'TicketStatus' });
registerEnumType(TicketPriority, { name: 'TicketPriority' });
registerEnumType(TicketCategory, { name: 'TicketCategory' });

@ObjectType()
export class Ticket implements PrismaTicket {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  subject: string;

  @Field(() => String)
  description: string;

  @Field(() => TicketStatus)
  status: TicketStatus;

  @Field(() => TicketPriority)
  priority: TicketPriority;

  @Field(() => TicketCategory)
  category: TicketCategory;

  @Field(() => GraphQLISODateTime,)
  createdAt: Date;

  @Field(() => GraphQLISODateTime,)
  updatedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  closedAt: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  assignedAt: Date | null;

  @Field(() => User)
  createdBy: User;

  @Field(() => User, { nullable: true })
  assignedTo?: User;

  @Field(() => ID)
  createdById: string;

  @Field(() => ID, { nullable: true })
  assignedToId: string | null;
}

@ObjectType()
export class PaginatedTickets {
  @Field(() => [Ticket])
  data: Ticket[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
}

@ObjectType()
export class PriorityStats {
  @Field() LOW: number;
  @Field() MEDIUM: number;
  @Field() HIGH: number;
  @Field() URGENT: number;
}

@ObjectType()
export class CategoryStats {
  @Field() ACCOUNT: number;
  @Field() PAYMENT: number;
  @Field() TECHNICAL: number;
  @Field() GENERAL: number;
  @Field() FEEDBACK: number;
  @Field() OTHER: number;
}

@ObjectType()
export class TicketStats {
  @Field() open: number;
  @Field() inProgress: number;
  @Field() resolved: number;
  @Field() closed: number;
  @Field() reopened: number;
  @Field() total: number;

  @Field(() => PriorityStats)
  byPriority: PriorityStats;

  @Field(() => CategoryStats)
  byCategory: CategoryStats;
}