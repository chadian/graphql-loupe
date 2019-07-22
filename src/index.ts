import { graphql, buildSchema, GraphQLSchema, GraphQLNamedType, GraphQLObjectType, GraphQLField, GraphQLScalarType, GraphQLFieldResolver, GraphQLArgument, GraphQLInputType, GraphQLNonNull, GraphQLList, GraphQLInputObjectType, isInputType, isOutputType, coerceValue, GraphQLType, isType, isScalarType, isObjectType } from 'graphql';
import { addMockFunctionsToSchema, IMockFn, IMocks as IGraphQLToolsMocks } from "graphql-tools";
import { followPath } from './utils/follow-path';
import { pick } from 'ramda';
import trim from 'ramda/es/trim';

interface IMocks {
  [key: string]: IMockFn | { [key: string]: IMockFn } | { [key: string]: any }
};

export type Field = GraphQLField<any, any>;
export type Pathable = GraphQLSchema | GraphQLObjectType | Field | GraphQLList<any> | GraphQLNonNull<any>;
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

    if (this.isField) {
      return (this.scope as Field).name;
    }

    return this.type;
  }

  get type(): String {
    if (this.isSchema) {
      return '#Schema';
    } else if (this.isObjectType) {
      return (this.scope as GraphQLObjectType).name;
    } else if (this.isList) {
      return `[${(this.scope as GraphQLList<any>).type.ofType.name}]`;
    } else if (this.isNonNull) {
      return `${this.scope.type.ofType.name}!`;
    } else if (this.isField && 'name' in (this.scope as Field).type) {
      return (this.scope && 'type' in this.scope && 'name' in this.scope.type && this.scope.type.name) || ""
    }

    throw new Error('Unable to determine type for ' + (this.scope as Field).name);
  }

  get unwrappedType(): String {
    if (this.scope && 'type' in this.scope && 'ofType' in this.scope.type) {
      return this.scope.type.ofType.name;
    } else {
      return this.type;
    }
  }

  get graphQLType() {
    if ('type' in this.scope) return this.scope.type;
    else return null;
  }

  get unwrappedGraphQLType() {
    if (this.scope && 'type' in this.scope) {
      if ('ofType' in this.scope.type) return this.scope.type.ofType;
      else return this.scope.type;
    }

    return null;
  }

  get isRoot() {
    return this.scope instanceof GraphQLSchema;
  }

  get isSchema() {
    return this.isRoot;
  }

  get isType() {
    return this.isGraphQLType;
  }

  get isGraphQLType() {
    return isType(this.scope);
  }

  get isScalarType() {
    return isScalarType(this.scope);
  }

  get isObjectType() {
    return isObjectType(this.scope);
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
    const unwrapType = (type: GraphQLType) => 'ofType' in type ? type.ofType : type;

    let requestedPath = pathString.split('.');
    const pathScope: Pathable[] = Object.assign([], this.pathScope);

    if (requestedPath.length === 0) {
      return this;
    }

    if (this.isRoot) {
      const typeString = requestedPath.shift() as string;
      let type = this.schema.getType(typeString);

      if (!(type instanceof GraphQLObjectType)) {
        throw new TypeError(`${typeString} was not found as known Type on the schema`);
      }

      type = unwrapType(type) as GraphQLObjectType;

      // push type on to path
      pathScope.push(type);

      // recurse with the remaining fields if there are any
      return this.clone(pathScope).path(requestedPath.join('.'));
    }

    let fields: Field[] = [];
    if (requestedPath.length > 0) {
      let startingField;

      if (this.isType) {
        const type = pathScope[pathScope.length - 1] as GraphQLObjectType;
        const fieldName = requestedPath.shift() as string;
        startingField = type.getFields()[fieldName];
      } else if (this.isField) {
        startingField = pathScope[pathScope.length - 1];
      }

      if (startingField) {
        fields = followPath([startingField as Field], requestedPath) as Field[];
      }
    }

    pathScope.push(...fields);

    return this.clone(pathScope);
  }

  trimObject(obj: any): any {
    if (!this.isGraphQLType && !this.isField) {
      return obj;
    }

    if (this.isList && Array.isArray(obj)) {
      return obj.map(item => this.trimObject(item));
    }

    let type;
    if (this.isField) {
      type = this.unwrappedGraphQLType
    } else {
      type = this.scope
    }

    if (!type) return;

    if (!('getFields' in type)) {
      throw new TypeError('trimObject only works with GraphQL types that have fields');
    }

    const fieldKeys = Object.keys(type.getFields());
    const trimmed = pick(fieldKeys, obj);

    for (let key of fieldKeys) {
      const fieldLoupe = this.path(key);
      const fieldType = fieldLoupe.unwrappedGraphQLType;

      if (fieldType instanceof GraphQLObjectType){
        trimmed[key] = fieldLoupe.trimObject(trimmed[key])
      }
    }

    return trimmed;
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
