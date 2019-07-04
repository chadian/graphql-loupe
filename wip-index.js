const t = require('graphql-ast-types');
const gql = require('graphql');
const expect = require('chai').expect;

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


function cloneSchema(schema) {
  return gql.buildSchema(gql.printSchema(schema));
}

class Loupe {
  constructor(schema) {
    if (typeof schema === 'string') {
      schema = gql.buildSchema(schema);
    }

    this.schema = schema;
    this.root = this.schema.astNode;
    this.pathScope = [this.root];
    this.mocks = [];
  }

  get isRoot() {
    return t.isSchemaDefinition(this.scope)
  }

  get scope() {
    return this.pathScope[this.pathScope.length - 1]
  }

  getSchema() {
    return this.schema;
  }

  mock(mockObject) {
    for (let [key, value] of Object.entries(mockObject)) {
      if (typeof value === 'object') {
        mockObject[key] = () => value;
      }
    }

    this.mocks.push(mockObject);

    return this;
  }

  async query(queryString) {
    const mocks = this.mocks;

    // okay, this is a bit of a hack. it runs the query
    // over every separate mock and merges the results.
    // TODO: Make this a smart merge compared against baseline of no mocks
    // maybe clean up each result based on the recursive context so that
    // the only thing that matters is the scoped response

    // each resolver function expects:
    // (root, args, context, info)

    // unique to relationship
    // https://www.prisma.io/blog/graphql-server-basics-the-schema-ac5e2950214e#9d03
    // root/data/parent provides the previously-fetched data from the parent field and
    // is useful for creating associations or context to fetch the requested data.

    // unique to resolver
    // args provide a map of key/value pairs corresponding to the arguments, if any, passed to the field.

    // shared by all resolvers
    // context is specific to a given request and provides the state information shared by resolvers.

    // https://www.prisma.io/blog/graphql-server-basics-demystifying-the-info-argument-in-graphql-resolvers-6f26249f613a
    //
    // info field provides various metadata about the request including the selection context.
    // This is often used to traverse the parent objects to provide contextual awareness to a given field.

    // 1. Given object or function
    // 1a. if object. done.
    // 1b. if function, call.
      // do above...
      // 1. compare against stock resolver
      // 2. trim
      // 3. return trimmed result

    // want to mix type resolvers with root resolvers
    // get this information from the schema to know
    // if the name of the root resolver is query or mutuation
    // use undefined in flattening


    // Option 2, recursively merge the resolvers LIFO style?

    // Option 3 check of the prisma blog, maybe this is way easier than expected
    // if we don't account for the recursive look up

    // if we do recursive look-ups, they should be bredth first
    // with last in overwriting...
    // this can then merge the context needed for the next layer.

    const results = (await Promise.all(
      mocks.map(mock => {
        const clonedSchema = cloneSchema(this.schema);
        gql.graphql(schema, queryString);
      })
    ));

    const result = Object.assign({}, ...results);
    return result;
    // return gql.graphql(this.schema, queryString);
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
}


function l(schema) {
  return new Loupe(schema);
}

describe('loupe', function() {
  let loupe;

  beforeEach(() => {
    loupe = l(schemaString);
  });

  it('accepts a schema string', function() {
    expect(loupe).to.be.instanceOf(Loupe);
  });

  it('scopes a path to a type', function() {
    const result = loupe.path('Person');
    expect(result.scope.name).to.equal('Person')
    expect(t.isObjectTypeDefinition(result.scope.astNode)).to.be.true
  });

  it('scopes a path to a field on a type', function() {
    const result = loupe.path('Person.name');
    expect(t.isFieldDefinition(result.scope.astNode)).to.be.true
    expect(result.scope.name).to.equal('name')
    expect(result.scope.type.name).to.equal('String')
  });

  it('scopes a path to a nested field on a type', function() {
    const result = loupe.path('Person.address.city');
    expect(t.isFieldDefinition(result.scope.astNode)).to.be.true;
    expect(result.scope.name).to.equal('city');
    expect(result.scope.type.name).to.equal('String');
  });

  it('scopes a path to the root `Query` type', function() {
    const result = loupe.path('Query');
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
            name: 'Jerry Seinfeld',
            address: {
              city: 'New York'
            }
          })
        }
      };

      let result = await loupe
        .mock(mocks)
        .query(query);

      expect(result.data.people.name).to.equal('Jerry Seinfeld');
      expect(result.data.people.address.city).to.equal('New York');
    });

    it('can layer multiple mocks', async function () {
      const mockName = {
        Query: {
          people: () => ({
            name: 'Jerry Seinfeld'
          })
        }
      };

      const mockCity = {
        Query: {
          people: () => ({
            address: () => ({
              city: 'New York'
            })
          })
        }
      };

      let result = await loupe
        .mock(mockCity)
        .mock(mockName)
        .query(query);

      expect(result.data.people.name).to.equal('Jerry Seinfeld');
      expect(result.data.people.address.city).to.equal('New York');
    });
  });
});

// test cases
// * overwrite existing mock with new one
// * handle variables and arguments
// * ast getter
// * path movement, up, down, siblings
