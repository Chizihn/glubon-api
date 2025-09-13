import { GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { Decimal } from '@prisma/client/runtime/library';

export const GraphQLDecimal = new GraphQLScalarType({
  name: 'Decimal',
  description: 'The `Decimal` scalar type to represent decimal values with high precision',
  
  serialize(value: unknown): string {
    if (!(value instanceof Decimal)) {
      throw new Error(`Value is not an instance of Decimal: ${value}`);
    }
    return value.toString();
  },

  parseValue(value: unknown): Decimal {
    if (typeof value !== 'string') {
      throw new Error(`Value is not a string: ${value}`);
    }
    return new Decimal(value);
  },

  parseLiteral(ast: ValueNode): Decimal {
    if (ast.kind !== Kind.STRING) {
      throw new Error(`Can only parse strings to Decimal but got a: ${ast.kind}`);
    }
    return new Decimal(ast.value);
  },
});
