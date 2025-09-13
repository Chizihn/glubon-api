import { Field, ObjectType, registerEnumType } from 'type-graphql';
import { GraphQLJSON } from 'graphql-type-json';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  OTHER = 'OTHER',
}

registerEnumType(AuditAction, {
  name: 'AuditAction',
  description: 'The type of action that was performed',
});

@ObjectType()
export class AuditLogType {
  @Field(() => String)
  id: string;

  @Field(() => String)
  action: string;

  @Field(() => String, { nullable: true })
  userId: string | null;

  @Field(() => String, { nullable: true })
  resource: string | null;

  @Field(() => String, { nullable: true })
  resourceId: string | null;

  @Field(() => String, { nullable: true })
  ipAddress: string | null;

  @Field(() => String, { nullable: true })
  userAgent: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata: Record<string, any> | null;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class AuditLogsResponse {
  @Field(() => [AuditLogType])
  logs: AuditLogType[];

  @Field(() => Number)
  total: number;
}
