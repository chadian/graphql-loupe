const t = require('graphql-ast-types');
const gql = require('graphql');
const expect = require('chai').expect;
const R = require('ramda');

const { addMockFunctionsToSchema } = require('graphql-tools');

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

function followPath(type, pathOfFieldnames, fieldPath=[]) {
  if (!pathOfFieldnames.length) {
    return fieldPath;
  }

  let [fieldName, ...shiftedPath] = pathOfFieldnames
  const typeFields = type.getFields()
  const field = typeFields[fieldName]

  fieldPath.push(field);

  if (t.isObjectTypeDefinition(field.type.astNode)) {
    return followPath(field.type, shiftedPath, fieldPath)
  }

  return fieldPath;
}

class Loupe {
  constructor(schema) {
    if (typeof schema === 'string') {
      schema = gql.buildSchema(schema);
    }

    this._schema = schema;
    this.root = this.schema.astNode;
    this.pathScope = [this.root]
  }

  get isRoot() {
    return t.isSchemaDefinition(this.scope)
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
    let pathScope;

    if (this.pathScope.length > 1) {
      pathScope = this.pathScope.splice(0, this.pathScope.length - 1);
    } else {
      pathScope = this.root;
    }

    const l = new Loupe(this.schema);
    l.pathScope = pathScope;
    return l;
  }

  path(pathString) {
    let requestedPath = pathString.split('.');
    const pathScope = [].concat(this.pathScope);

    if (this.isRoot) {
      const [typeString, ...shiftedPath] = requestedPath;
      const type = this.schema.getType(typeString);
      // push type on to path
      pathScope.push(type);

      // reset requestedPath to start with fields on type
      requestedPath = shiftedPath;
    }

    let fieldPaths = [];
    if (requestedPath.length > 0) {
      fieldPaths = followPath(pathScope[pathScope.length - 1], requestedPath);
    }

    pathScope.push(...fieldPaths);

    const l = new Loupe(this.schema);

    // set new instance with updated pathScope
    l.pathScope = pathScope;
    return l;
  }

  async query(queryString) {
    return gql.graphql(this.schema, queryString);
  }

  mock(mockObject) {
    for (let [key, value] of Object.entries(mockObject)) {
      if (typeof value === 'object') {
        mockObject[key] = () => value;
      }
    }

    addMockFunctionsToSchema({
      schema: this.schema,
      mocks: mockObject
    });

    return this;
  }
}


function l(schema) {
  return new Loupe(schema);
}

describe('loupe', function() {
  let loupe;

  beforeEach(() => {
    loupe = l(schemaString);
  });

  it('accepts a schema string', function () {
    expect(loupe).to.be.instanceOf(Loupe);
  });

  context('navigating', function() {
    context('traversing down a path', function() {
      it('scopes a path to a type', function() {
        const result = loupe.path('Person');
        expect(result.scope.name).to.equal('Person')
        expect(t.isObjectTypeDefinition(result.scope.astNode)).to.be.true
      });

      it('scopes a path to the `Query` type', function () {
        const result = loupe.path('Query');
        expect(result.scope.name).to.equal('Query')
        expect(t.isObjectTypeDefinition(result.scope.astNode)).to.be.true
      });

      it('scopes a path to a field on a type', function() {
        const result = loupe.path('Person.name');
        expect(result.scope.name).to.equal('name')
        expect(result.scope.type.name).to.equal('String')
        expect(t.isFieldDefinition(result.scope.astNode)).to.be.true;
      });

      it('scopes a path to a nested field on a type', function() {
        const result = loupe.path('Person.address.city');
        expect(t.isFieldDefinition(result.scope.astNode)).to.be.true;
        expect(result.scope.name).to.equal('city');
        expect(result.scope.type.name).to.equal('String');
      });

      it('scopes a path to a field on the root `Query` type', function() {
        const result = loupe.path('Query.people');
        expect(result.scope.name).to.equal('people');
        expect(result.scope.type.name).to.equal('Person');
      });
    });

    context('traversing up', function() {
      it('can traverse up from a Type to the root schema', function () {
        const result = loupe.path('Person').parent;
        expect(result.isRoot).to.be.true;
        expect(result.scope.kind).to.equal('SchemaDefinition');
        expect(t.isSchemaDefinition(result.scope)).to.be.true
      });

      it('can traverse up from a field to its type', function () {
        const result = loupe.path('Person.name').parent;
        expect(result.scope.name).to.equal('Person')
        expect(t.isObjectTypeDefinition(result.scope.astNode)).to.be.true
      });
    });
  });

  describe('mocking types', function() {
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

    context('with functions', function() {
      it('can mock at the root level', async function() {
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

        expect(result.data.people.name).to.equal('Sam Malone');
        expect(result.data.people.address.city).to.equal('Boston');
      });
    });

    context('with objects', function() {
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

        expect(result.data.people.name).to.equal('Sam Malone');
        expect(result.data.people.address.city).to.equal('Boston');
      });
    });
  });

  describe('mocking queries', function() {
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

    it('can mock a query on the Query type', async function() {
      const mocks = {
        Query: {
          people: () => ({
            name: 'Batman',
            address: {
              city: 'Gotham City'
            }
          })
        }
      };

      let result = await loupe
        .mock(mocks)
        .query(query);

      expect(result.data.people.name).to.equal('Batman');
      expect(result.data.people.address.city).to.equal('Gotham City');
    });
  });
});

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

  function resolverList(...args) {
    args.__resolverList = true;
    return args;
  }

  function mergeRightAll(...objects) {
    return objects.reduce(((merged, obj) => {
      return R.mergeDeepWith((_a, b) => b, merged, obj);
    }), {})
  }

  const reduceResolvers = async (resolvers) => {
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

  async function resolve(resolver) {
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


  async function traverseResolvers(mocks) {
    const resolved = {};

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

// test cases
// * overwrite existing mock with new one
// * handle variables and arguments
// * ast getter
// * path movement, up, down, siblings
