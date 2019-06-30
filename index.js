const t = require('graphql-ast-types');
const gql = require('graphql');
const expect = require('chai').expect;

const {TypeInfo, visit, visitWithTypeInfo} = gql;

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
    this.scope = this.root = this.schema.astNode;
  }

  get isRoot() {
    return t.isSchemaDefinition(this.scope)
  }

  path(pathString) {
    let path = pathString.split('.');
    let scope = this.scope;

    if (this.isRoot) {
      let [type, ...shiftedPath] = path;
      path = shiftedPath;
      scope = this.schema.getType(type);
    }

    if (path.length > 0) {
      const fieldPaths = followPath(scope, path);
      scope = fieldPaths[fieldPaths.length - 1]
    }

    const l = new Loupe(this.schema);
    l.scope = scope;
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
  })

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
  })
});

// describe('TypeInfo', function() {
//   let tInfo;
//   const schema = gql.buildSchema(schemaString);

//   beforeEach(() => {
//     tInfo = new TypeInfo(schema);
//   })

//   it('works', function() {
//     visit(gql.parse(`query { people }`), visitWithTypeInfo(tInfo, { enter(node) {
//       // tInfo.enter(node)
//       tInfo;
//       debugger
//     }, leave(node) {
//       // tInfo.leave(node)
//     } }));

//     debugger;
//   })
// })

// const schema = gql.buildSchema(schemaString);

// const PersonType = schema.getType('Person')

// const query = `
// query {
//   people {
//     name
//   }
// }
// `;

// const queryAst = gql.parse(query);
// queryAst.definitions[0].selectionSet.selections
