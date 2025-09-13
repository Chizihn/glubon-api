import { Field, ArgsType } from 'type-graphql';
import { AuditAction } from './audit-log.types';

@ArgsType()
export class AuditLogFilter {
  @Field(() => [String], { nullable: true })
  userIds?: string[];
  
  @Field(() => [AuditAction], { nullable: true })
  actions?: AuditAction[];
  
  @Field(() => [String], { nullable: true })
  resources?: string[];
  
  @Field(() => String, { nullable: true })
  resourceId?: string;
  
  @Field(() => Date, { nullable: true })
  startDate?: Date;
  
  @Field(() => Date, { nullable: true })
  endDate?: Date;
  
  @Field(() => Number, { nullable: true, defaultValue: 50 })
  limit?: number;
  
  @Field(() => Number, { nullable: true, defaultValue: 0 })
  offset?: number;
}

@ArgsType()
export class CreateAuditLogInput {
  @Field(() => String, { nullable: true })
  userId?: string;
  
  @Field(() => AuditAction)
  action: AuditAction;
  
  @Field(() => String)
  resource: string;
  
  @Field(() => String, { nullable: true })
  resourceId?: string;
  
  @Field(() => String, { nullable: true })
  ipAddress?: string;
  
  @Field(() => String, { nullable: true })
  userAgent?: string;
  
  @Field(() => String, { nullable: true })
  metadata?: string;
}
