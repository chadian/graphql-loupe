import { graphql, buildSchema, GraphQLSchema, GraphQLNamedType, GraphQLObjectType, GraphQLField, GraphQLScalarType, GraphQLFieldResolver, GraphQLArgument, GraphQLInputType, GraphQLNonNull, GraphQLList } from 'graphql';
import { addMockFunctionsToSchema, IMockFn, IMocks as IGraphQLToolsMocks, ExpandAbstractTypes } from "graphql-tools";
import { expect } from 'chai';
import R from 'ramda';


interface IMocks {
  [key: string]: IMockFn | { [key: string]: IMockFn } | { [key: string]: any }
};

function followPath(fieldsPath: Field[], pathOfFieldnames: string[]): pathable[] {
  if (!pathOfFieldnames.length) {
    return fieldsPath;
  }

  const lastFieldInPath = fieldsPath[fieldsPath.length - 1];

  if (lastFieldInPath.type instanceof GraphQLObjectType) {
    const [fieldName, ...shiftedPath] = pathOfFieldnames;
    const typeFields = lastFieldInPath.type.getFields();
    const childField = typeFields[fieldName];

    if (childField) {
      return followPath([...fieldsPath, childField], shiftedPath)
    } else {
      throw `Could not find ${fieldName}`;
    }
  }

  return fieldsPath;
}

type Field = GraphQLField<any, any>;
type pathable = GraphQLSchema | GraphQLObjectType | Field;
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

class Loupe {
  private _schema: GraphQLSchema;
  pathScope: pathable[];

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
    // TODO: Handle case for GraphQLList, `type.name` doesn't exist on it
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

    let pathScope: pathable[];
    pathScope = this.pathScope.splice(0, this.pathScope.length - 1);
    return this.clone(pathScope);
  }

  path(pathString: string) {
    let requestedPath = pathString.split('.');
    const pathScope: pathable[] = Object.assign([], this.pathScope);

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

  clone(pathScope: pathable[]) {
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

describe('loupe', function() {
  const schemaString = `
    schema {
      query: Query
    }

    type Query {
      people(
        """
        pageCount is used for pagination
        Specify the numbebr of people to include per page
        """
        pageCount: Int = 10
      ): Person
    }

    type Person {
      name: String
      address: Address
      socialSecurityNumber: String!
      friends: [Person]
    }

    type Address {
      city: String
    }
  `;

  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('accepts a schema string', function () {
    expect(l).to.be.instanceOf(Loupe);
  });

  context('navigating', function() {
    context('#path', function() {
      it('scopes a path to the `Query` type', function () {
        const result = l.path('Query');
        expect((result.scope as GraphQLNamedType).name).to.equal('Query')
      });

      it('scopes a path to a type', function() {
        const result = l.path('Person');
        expect((result.scope as GraphQLNamedType).name).to.equal('Person')
      });

      it('scopes a path to a field on a type', function() {
        const result = l.path('Person.name');
        expect((result.scope as GraphQLNamedType).name).to.equal('name')
      });

      it('scopes a path to a nested field on a type', function() {
        const result = l.path('Person.address.city');
        const scope = result.scope as Field;
        expect(scope.name).to.equal('city');
        expect((scope.type as GraphQLScalarType).name).to.equal('String');
      });

      it('scopes a path to a field on the root `Query` type', function() {
        const result = l.path('Query.people');
        const scope = result.scope as Field;
        expect(scope.name).to.equal('people');
        expect((scope.type as GraphQLObjectType).name).to.equal('Person');
      });

      context('#parent', function () {
        it('when traversing past the schema it returns itself', function () {
          const result = l.parent;
          expect(result).to.equal(l);
        });

        it('can traverse up from a Type to the root schema', function () {
          const result = l.path('Person').parent;
          expect(result.isRoot).to.be.true;
          expect(result.scope instanceof GraphQLSchema).to.be.true;
        });

        it('can traverse up from a field to its type', function () {
          const result = l.path('Person.name').parent;
          const scope = result.scope as Field;
          expect(scope.name).to.equal('Person')
        });
      });
    });
  });

  context('#name', function () {
    it('returns #Schema for the name of the GraphQLSchema', function () {
      const result = l.name;
      expect(result).to.equal('#Schema');
    });

    it('returns the name of a type', function () {
      const result = l.path('Query').name;
      expect(result).to.equal('Query');
    });

    it('returns the name of a nested scalar', function () {
      const result = l.path("Query.people").name;
      expect(result).to.equal("people");
    });
  });

  context('#type', function() {
    it('returns the type from a schema', function() {
      expect(l.type).to.equal('#Schema');
    });

    it('returns the type name from a type', function() {
      expect(l.path('Query').type).to.equal('Query');
    });

    it('returns the return type of a field', function() {
      expect(l.path('Person.name').type).to.equal('String');
    });

    it('returns the unwrapped non-null type', function() {
      expect(l.path('Person.socialSecurityNumber').type).to.equal('String');
    });

    it('returns the unwrapped list type', function() {
      expect(l.path('Person.friends').type).to.equal('Person');
    });
  });

  context('#isNonNull', function() {
    it('returns true for a non-null field', function() {
      expect(l.path('Person.socialSecurityNumber').isNonNull).to.be.true;
    });

    it('returns false for a nullable field', function() {
      expect(l.path('Person.name').isNonNull).to.be.false;
    });

    it('returns false for a type', function() {
      expect(l.path('Person').isNonNull).to.be.false;
    });

    it('returns false for the Schema', function() {
      expect(l.isNonNull).to.be.false;
    });
  });

  context('#isList', function() {
    it('returns true for a non-null field', function() {
      expect(l.path('Person.friends').isList).to.be.true;
    });

    it('returns false for a nullable field', function() {
      expect(l.path('Person.name').isList).to.be.false;
    });

    it('returns false for a type', function() {
      expect(l.path('Person').isList).to.be.false;
    });

    it('returns false for the Schema', function() {
      expect(l.isList).to.be.false;
    });
  });

  context('#arguments', function() {
    it('returns null for the Schema and GraphQLObjectType', function () {
      expect(l.arguments).to.equal(null);
      expect(l.path('Query').arguments).to.equal(null);
    });

    it('returns an empty array when there are no field arguments', function () {
      expect(l.path('Address.city').arguments).to.eql([]);
    });

    it('returns an array of arguments when there are arguments', function () {
      const [argument] = l.path("Query.people").arguments as Argument[];
      expect(argument.name).to.equal('pageCount');
      expect(argument.type.name).to.equal('Int');
      expect(argument.defaultValue).to.eql(10);
      expect(argument.description).to.eql(
        'pageCount is used for pagination\nSpecify the numbebr of people to include per page'
      );
    });
  });

  it('#isField', function() {
    expect(l.isField).to.be.false;
    expect(l.path('Address').isField).to.be.false;
    expect(l.path('Address.city').isField).to.be.true;
  });

  describe('mocking', function() {
    const query = `
      query {
        people {
          name
          address {
            city
          }
        }
      }
    `;

    it('can mock types directly', async function() {
      const mocks = {
        Person: () => ({
          name: 'Sam Malone'
        }),
        Address: () => ({
          city: 'Boston'
        })
      };

      let result = await l
        .mock(mocks)
        .query(query);

      expect(result.data!.people.name).to.equal('Sam Malone');
      expect(result.data!.people.address.city).to.equal('Boston');
    });

    it('can mock at the root level', async function() {
      const mocks = {
        Person: {
          name: 'Sam Malone'
        },
        Address: {
          city: 'Boston'
        }
      };
      let result = await l
        .mock(mocks)
        .query(query);
      expect(result.data!.people.name).to.equal('Sam Malone');
      expect(result.data!.people.address.city).to.equal('Boston');
    });

    it("can mock a field on the Query type", async function() {
      const mocks = {
        Query: {
          people: () => ({
            name: "Batman",
            address: {
              city: "Gotham City"
            }
          })
        }
      };

      let result = await l.mock(mocks).query(query);

      expect(result.data!.people.name).to.equal("Batman");
      expect(result.data!.people.address.city).to.equal("Gotham City");
    });
  });
});

describe('experimental proof of concept recursive mocking, not implemented...', function() {
  // test cases
  // * handle variables and arguments
  // * need to be able to satisfy resolver args in functions,
  //   including the data resolved from the parent.
  // * add typescript typings
  // * overwrite existing mock with new one

  it('resolves recursively', async function() {
    const mocks = {
      Query: resolverList({
        people: [resolverList(
          {
            name: 'Jim Halpert',
            branch: 'Scranton',
          },
          {
            branch: 'Stamford',
            likes: ['Swimming', 'Hiking']
          },
          {
            branch: () => 'Scranton',
            likes: () => ['paper']
          },
          {
            likes: () => Promise.resolve(['pranking dwight'])
          }
        )]
      })
    }

    function resolverList(...args: any) {
      args.__resolverList = true;
      return args;
    }

    function mergeRightAll(...objects: any) {
      return objects.reduce(((merged: any, obj: any) => {
        return R.mergeDeepWith((_a, b) => b, merged, obj);
      }), {})
    }

    const reduceResolvers = async (resolvers: any) => {
      const resolved = await Promise.all(resolvers.map(resolve));
      const shouldMerge = typeof resolved[0] === 'object' && resolvers.__resolverList;

      if (Array.isArray(resolved[0])) {
        return resolved[resolved.length - 1];
      }

      if (shouldMerge) {
        if (resolved.length > 1) {
          return mergeRightAll(...resolved);
        } else {
          return resolved[0];
        }
      }

      return resolved;
    }

    async function resolve(resolver: any): Promise<any> {
      if (resolver.then) {
        return await Promise.resolve(resolver);
      }

      if (Array.isArray(resolver)) {
        return await reduceResolvers(resolver);
      }

      if (typeof resolver === 'object') {
        return await traverseResolvers(resolver);
      }

      if (typeof resolver === 'function') {
        return await resolve(resolver());
      }

      return resolver;
    }


    async function traverseResolvers(mocks: any) {
      const resolved: any = {};

      for (const [key, resolver] of Object.entries(mocks)) {
        resolved[key] = await resolve(resolver);
      }

      return resolved;
    }

    expect(await traverseResolvers(mocks)).to.deep.equal({
      Query: {
        people: [{
          name: 'Jim Halpert',
          branch: 'Scranton',
          likes: ['pranking dwight']
        }]
      }
    })
  });
});
