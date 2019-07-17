import { graphql, buildSchema, GraphQLSchema, GraphQLNamedType, GraphQLObjectType, GraphQLField, GraphQLScalarType, GraphQLFieldResolver, GraphQLArgument, GraphQLInputType, GraphQLNonNull, GraphQLList } from 'graphql';
import { addMockFunctionsToSchema, IMockFn, IMocks as IGraphQLToolsMocks } from "graphql-tools";
import { followPath } from './utils/follow-path';

interface IMocks {
  [key: string]: IMockFn | { [key: string]: IMockFn } | { [key: string]: any }
};


export type Field = GraphQLField<any, any>;
export type Pathable = GraphQLSchema | GraphQLObjectType | Field;
type Schemable = string | GraphQLSchema;


// Make a key on type optional
// https://stackoverflow.com/questions/43159887/make-a-single-property-optional-in-typescript
type Overwrite<T1, T2> = {
    [P in Exclude<keyof T1, keyof T2>]: T1[P]
} & T2;

type GraphQLInputTypeWithOptionalName = Overwrite<GraphQLInputType, {
  name?: String
}>

type Argument = {
  readonly name: GraphQLArgument["name"]
  readonly description?: GraphQLArgument["description"]
  readonly defaultValue?: GraphQLArgument["defaultValue"]
  readonly type: GraphQLInputTypeWithOptionalName;
  readonly astNode?: GraphQLArgument["astNode"]
  raw: GraphQLArgument
}

export class Loupe {
  private _schema: GraphQLSchema;
  pathScope: Pathable[];

  constructor(schema: Schemable) {
    if (typeof schema === 'string') {
      schema = buildSchema(schema);
    }

    this._schema = schema;
    this.pathScope = [this.schema]
  }

  get scope() {
    return this.pathScope[this.pathScope.length - 1]
  }

  get schema() {
    return this._schema;
  }

  get ast() {
    return this.scope.astNode;
  }

  get name() {
    if (this.scope instanceof GraphQLSchema) {
      return '#Schema';
    }

    return this.scope.name;
  }

  get type() {
    if (this.scope instanceof GraphQLSchema) {
      return '#Schema';
    } else if (this.scope instanceof GraphQLObjectType) {
      // If we're looking at a type, the type is it's own name
      return this.scope.name;
    } else if ('ofType' in this.scope.type) {
      // handle the cases where it's non-null or a list
      return this.scope.type.ofType.name;
    } else if ('name' in this.scope.type) {
      return this.scope.type.name;
    }
  }

  get isRoot() {
    return this.scope instanceof GraphQLSchema;
  }

  get isSchema() {
    return this.isRoot;
  }

  get isType() {
    return this.scope instanceof GraphQLSchema;
  }

  get isField() {
      return this.scope.astNode && this.scope.astNode.kind === 'FieldDefinition';
  }

  get isNonNull() {
    if (this.isField) {
      return (this.scope as Field).type instanceof GraphQLNonNull;
    }

    return false;
  }

  get isList() {
    if (this.isField) {
      return (this.scope as Field).type instanceof GraphQLList;
    }

    return false;
  }

  get arguments(): Argument[] | null {
    if (this.scope instanceof GraphQLSchema || this.scope instanceof GraphQLObjectType) {
      return null;
    }

    return this.scope.args.map(arg => {
      const argument = {
        ...arg,
        raw: arg
      };

      return argument;
    })
  }

  get parent() {
    if (this.pathScope.length === 1) {
      return this;
    }

    let pathScope: Pathable[];
    pathScope = this.pathScope.splice(0, this.pathScope.length - 1);
    return this.clone(pathScope);
  }

  path(pathString: string) {
    let requestedPath = pathString.split('.');
    const pathScope: Pathable[] = Object.assign([], this.pathScope);

    if (requestedPath.length < 1) {
      return this;
    }

    if (this.isRoot) {
      const typeString = requestedPath.shift() as string;
      const type = this.schema.getType(typeString);

      if (!(type instanceof GraphQLObjectType)) {
        throw new TypeError(`${typeString} was not found as known Type on the schema`);
      }

      // push type on to path
      pathScope.push(type);
    }

    let fields: Field[] = [];
    if (requestedPath.length > 0) {
      let startingField;

      if (pathScope.length === 2) {
        const type = pathScope[pathScope.length - 1] as GraphQLObjectType;
        const fieldName = requestedPath.shift() as string;
        startingField = type.getFields()[fieldName];
      } else {
        startingField = pathScope[pathScope.length - 1];
      }

      if (startingField) {
        fields = followPath([startingField as Field], requestedPath) as Field[];
      }
    }

    pathScope.push(...fields);

    return this.clone(pathScope);
  }

  async query(queryString: string) {
    return graphql(this.schema, queryString);
  }

  mock(mockObject: IMocks) {
    let mocks: IGraphQLToolsMocks = {};

    for (let [key, value] of Object.entries(mockObject)) {
      if (typeof value !== 'function') {
        mocks[key] = () => value;
      } else {
        mocks[key] = value as GraphQLFieldResolver<any, any>;
      }
    }

    addMockFunctionsToSchema({
      schema: this.schema,
      mocks
    });

    return this;
  }

  clone(pathScope: Pathable[]) {
    if (!pathScope) {
      pathScope = this.pathScope
    }

    const newLoupe = new Loupe(this.schema);
    newLoupe.pathScope = pathScope;
    return newLoupe;
  }
}


export function loupe(schema: Schemable) {
  return new Loupe(schema);
}
