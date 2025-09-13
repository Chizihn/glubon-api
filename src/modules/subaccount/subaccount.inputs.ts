import {
  InputType,
  Field,
  Float,
  Int,
} from "type-graphql";

@InputType()
export class CreateSubaccountInput {
  @Field()
  accountNumber: string;

  @Field()
  bankCode: string;

  @Field()
  businessName: string;

  @Field(() => Float, { defaultValue: 85 })
  percentageCharge: number;
}

@InputType()
export class UpdateBankDetailsInput {
  @Field()
  accountNumber: string;

  @Field()
  bankCode: string;

  @Field({ nullable: true })
  businessName?: string;
}

@InputType()
export class AccountResolveInput {
  @Field()
  accountNumber: string;

  @Field()
  bankCode: string;
}

@InputType()
export class SuspendSubaccountInput {
  @Field()
  reason: string;
}
