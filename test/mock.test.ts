import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#mock', function () {
  let l: Loupe;

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

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('can mock types directly', async function () {
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

    expect(result.data!.people[0].name).to.equal('Sam Malone');
    expect(result.data!.people[0].address.city).to.equal('Boston');
  });

  it('can mock at the root level', async function () {
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
    expect(result.data!.people[0].name).to.equal('Sam Malone');
    expect(result.data!.people[0].address.city).to.equal('Boston');
  });

  it("can mock a field on the Query type", async function () {
    const mocks = {
      Query: {
        people: () => ([{
          name: "Batman",
          address: {
            city: "Gotham City"
          }
        }])
      }
    };

    let result = await l.mock(mocks).query(query);

    expect(result.data!.people[0].name).to.equal("Batman");
    expect(result.data!.people[0].address.city).to.equal("Gotham City");
  });
});
