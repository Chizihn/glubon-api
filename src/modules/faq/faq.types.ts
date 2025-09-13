import { Field, ObjectType } from 'type-graphql';
import { FAQ } from '@prisma/client';

@ObjectType()
export class FAQType implements FAQ {
  @Field(() => String)
  id: string;

  @Field(() => String)
  question: string;

  @Field(() => String)
  answer: string;

  @Field(() => String)
  category: string;

  @Field(() => Number)
  order: number;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => String)
  updatedBy: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class FAQCategoryType {
  @Field(() => String)
  name: string;

  @Field(() => Number)
  count: number;
}
