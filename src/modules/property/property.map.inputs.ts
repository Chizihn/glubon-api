import { Field, InputType, Float } from "type-graphql";

@InputType()
export class MapSearchInput {
  @Field(() => Float)
  latitude!: number;

  @Field(() => Float)
  longitude!: number;

  @Field(() => Float, { nullable: true, defaultValue: 10 })
  radiusInKm?: number; // Default 10km radius

  @Field(() => [String], { nullable: true })
  propertyTypes?: string[];

  @Field(() => [String], { nullable: true })
  amenities?: string[];

  @Field(() => Float, { nullable: true })
  minPrice?: number;

  @Field(() => Float, { nullable: true })
  maxPrice?: number;

  @Field(() => [String], { nullable: true })
  roomTypes?: string[];
}
