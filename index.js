const t = require('graphql-ast-types');
const gql = require('graphql');
const expect = require('chai').expect;


const schemaString = `
  schema {
    query: Query
  }

  type Query {
    people: Person
  }

  type Person {
    name: String
  }
`;

const schema = gql.buildSchema(schemaString);

const PersonType = schema.getType('Person')

const query = `
query {
  people {
    name
  }
}
`;

const queryAst = gql.parse(query);
// queryAst.definitions[0].selectionSet.selections

function followPath(type, path) {
  if (!path.length) {
    return type;
  }

  let [fieldName, ...shiftedPath] = path
  const typeFields = type.getFields()
  const field = typeFields[fieldName]

  if (t.isObjectTypeDefinition()) {
    return followPath(field, shiftedPath)
  }

  return field;
}

class Loupe {
  constructor(schemaString) {
    this.schemaString = schemaString
    this.schema = gql.buildSchema(schemaString)
    this.scope = this.root = this.schema.astNode
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
      scope = followPath(scope, path);
    }

    const l = new Loupe(this.schemaString);
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
  })

  it('accepts a schema string', function() {
    expect(loupe).to.be.instanceOf(Loupe);
  });

  it('can scope to a path in the AST', function() {
    const result = loupe.path('Person.name');

    expect(t.isFieldDefinition(result.scope.astNode)).to.be.true
    expect(result.scope.type.name).to.equal('String')
    expect(result.scope.name).to.equal('name')
  })
});
