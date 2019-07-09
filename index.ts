import { graphql, buildSchema, GraphQLSchema, GraphQLNamedType, GraphQLObjectType, GraphQLField, GraphQLScalarType, GraphQLFieldResolver } from 'graphql';
import { addMockFunctionsToSchema, IMockFn, IMocks as IGraphQLToolsMocks } from "graphql-tools";
import { expect } from 'chai';
import R from 'ramda';


interface IMocks {
  [key: string]: IMockFn | { [key: string]: IMockFn } | { [key: string]: any }
};

const schemaString = `
  schema {
    query: Query
  }

  type Query {
    people: Person
  }

  type Person {
    name: String
    address: Address
  }

  type Address {
    city: String
  }
`;

function followPath(fields: Field[], pathOfFieldnames: string[]): pathable[] {
  if (!pathOfFieldnames.length) {
    return fields;
  }

  const field = fields[fields.length - 1];

  if (field.type instanceof GraphQLObjectType) {
    const [fieldName, ...shiftedPath] = pathOfFieldnames;
    const typeFields = field.type.getFields();
    const childField = typeFields[fieldName];

    if (childField) {
      return followPath([...fields, childField], shiftedPath)
    } else {
      throw `Could not find ${fieldName}`;
    }
  }

  return fields;
}

type Field = GraphQLField<any, any>;
type pathable = GraphQLSchema | GraphQLObjectType | Field;
type schemable = string | GraphQLSchema;

class Loupe {
  private _schema: GraphQLSchema;
  pathScope: pathable[];

  constructor(schema: schemable) {
    if (typeof schema === 'string') {
      schema = buildSchema(schema);
    }

    this._schema = schema;
    this.pathScope = [this.schema]
  }

  get isRoot() {
    return this.scope instanceof GraphQLSchema;
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

  get parent() {
    let pathScope: pathable[];

    if (this.pathScope.length > 1) {
      pathScope = this.pathScope.splice(0, this.pathScope.length - 1);
    } else {
      pathScope = [this.schema];
    }

    const l = new Loupe(this.schema);
    l.pathScope = pathScope;
    return l;
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
        throw new TypeError(`${typeString} is not an Object Type that can be used for the path`);
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

    const l = new Loupe(this.schema);
    // set new instance with updated pathScope
    l.pathScope = pathScope;
    return l;
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
}


function l(schema: schemable) {
  return new Loupe(schema);
}

describe('loupe', function() {
  let loupe: Loupe;

  beforeEach(() => {
    loupe = l(schemaString);
  });

  it('accepts a schema string', function () {
    expect(loupe).to.be.instanceOf(Loupe);
  });

  context('navigating', function() {
    context('traversing down a path', function() {
      it('scopes a path to the `Query` type', function () {
        const result = loupe.path('Query');
        expect((result.scope as GraphQLNamedType).name).to.equal('Query')
      });

      it('scopes a path to a type', function() {
        const result = loupe.path('Person');
        expect((result.scope as GraphQLNamedType).name).to.equal('Person')
      });

      it('scopes a path to a field on a type', function() {
        const result = loupe.path('Person.name');
        expect((result.scope as GraphQLNamedType).name).to.equal('name')
      });

      it('scopes a path to a nested field on a type', function() {
        const result = loupe.path('Person.address.city');
        const scope = result.scope as Field;
        expect(scope.name).to.equal('city');
        expect((scope.type as GraphQLScalarType).name).to.equal('String');
      });

      it('scopes a path to a field on the root `Query` type', function() {
        const result = loupe.path('Query.people');
        const scope = result.scope as Field;
        expect(scope.name).to.equal('people');
        expect((scope.type as GraphQLObjectType).name).to.equal('Person');
      });
    });

    context('traversing up', function() {
      it('can traverse up from a Type to the root schema', function () {
        const result = loupe.path('Person').parent;
        expect(result.isRoot).to.be.true;
        expect(result.scope instanceof GraphQLSchema).to.be.true;
      });

      it('can traverse up from a field to its type', function () {
        const result = loupe.path('Person.name').parent;
        const scope = result.scope as Field;
        expect(scope.name).to.equal('Person')
      });
    });
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

      let result = await loupe
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
      let result = await loupe
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

      let result = await loupe.mock(mocks).query(query);

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
