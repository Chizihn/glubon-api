import { GraphQLJSONObject } from "graphql-type-json";
import { Field, InputType } from "type-graphql";

@InputType()
export class RequestWithdrawalInput {
    @Field(() => Number)
    amount: number;

    @Field(() => String)
    paymentMethod: string;

    @Field(() => GraphQLJSONObject, { nullable: true })
    details?: string;
}

