import { Field, ObjectType, Int } from "type-graphql";

export interface IBaseResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  timestamp?: Date;
}

@ObjectType()
export class BaseResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field()
  timestamp: Date;

  @Field(() => [String], { nullable: true })
  errors?: string[];

  constructor(success: boolean, message: string, errors: any[] = []) {
    this.success = success;
    this.message = message;
    this.errors = errors;
    this.timestamp = new Date();
  }
}

@ObjectType()
export class PaginationInfo {
  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Int, { nullable: true })
  totalItems: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;

  constructor(page: number, limit: number, totalItems: number) {
    this.page = page;
    this.limit = limit;
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / limit);
    this.hasNextPage = page < this.totalPages;
    this.hasPreviousPage = page > 1;
  }
}

@ObjectType()
export abstract class PaginatedResponse<T> {
  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
  items: T[];

  constructor(items: T[], page: number, limit: number, totalItems: number) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

@ObjectType()
export class PaginationMeta {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  paymentUrl?: string;
  errors?: any[];
}
