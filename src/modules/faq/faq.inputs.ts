import { Field, InputType } from 'type-graphql';

@InputType()
export class CreateFAQInput {
  @Field(() => String)
  question: string;

  @Field(() => String)
  answer: string;

  @Field(() => String)
  category: string;

  @Field(() => Number, { nullable: true })
  order?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class UpdateFAQInput {
  @Field(() => String, { nullable: true })
  question?: string;

  @Field(() => String, { nullable: true })
  answer?: string;

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => Number, { nullable: true })
  order?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class FAQFilter {
  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
