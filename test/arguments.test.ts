import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#arguments', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

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
