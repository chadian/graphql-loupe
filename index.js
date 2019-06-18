const t = require('graphql-ast-types');
const gql = require('graphql');

const schema = gql.buildSchema(`
  schema {
    query: Query
  }

  type Query {
    people: Person
  }

  type Person {
    name: String
  }
`);

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

