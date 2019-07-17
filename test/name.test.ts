import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#name', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('returns #Schema for the name of the GraphQLSchema', function () {
    const result = l.name;
    expect(result).to.equal('#Schema');
  });

  it('returns the name of a type', function () {
    const result = l.path('Query').name;
    expect(result).to.equal('Query');
  });

  it('returns the name of a nested scalar', function () {
    const result = l.path("Query.people").name;
    expect(result).to.equal("people");
  });
});
