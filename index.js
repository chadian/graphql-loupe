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

class Loupe {
  constructor(schema) {
    if (typeof schema === 'string') {
      schema = gql.buildSchema(schema);
    }

    this.schema = schema;
    this.root = this.schema.astNode;
    this.pathScope = [this.root]
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

    addMockFunctionsToSchema({
      schema: this.schema,
      mocks: mockObject
    });

    return this;
  }

  async query(queryString) {
    return gql.graphql(this.schema, queryString);
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
            name: 'Batman',
            address: {
              city: 'New York'
            }
          })
        }
      };

      let result = await loupe
        .mock(mocks)
        .query(query);

      expect(result.data.people.name).to.equal('Batman');
      expect(result.data.people.address.city).to.equal('New York');
    });
  });
});

// test cases
// * overwrite existing mock with new one
// * handle variables and arguments
// * ast getter
// * path movement, up, down, siblings
