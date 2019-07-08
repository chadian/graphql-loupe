import { GraphQLSchema } from "graphql";

export class Loupe {
  constructor(schema: string);
  _schema: GraphQLSchema
}
