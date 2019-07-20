export const schemaString = `
    schema {
      query: Query
    }

    type Query {
      person(name: String): Person

      people(
        """
        pageCount is used for pagination
        Specify the numbebr of people to include per page
        """
        pageCount: Int = 10
      ): [Person]
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
