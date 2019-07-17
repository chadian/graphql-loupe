import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#path', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('scopes a path to the `Query` type', function () {
    const result = l.path('Query');
    expect((result.scope as GraphQLNamedType).name).to.equal('Query')
  });

  it('scopes a path to a type', function () {
    const result = l.path('Person');
    expect((result.scope as GraphQLNamedType).name).to.equal('Person')
  });

  it('scopes a path to a field on a type', function () {
    const result = l.path('Person.name');
    expect((result.scope as GraphQLNamedType).name).to.equal('name')
  });

  it('scopes a path to a nested field on a type', function () {
    const result = l.path('Person.address.city');
    const scope = result.scope as Field;
    expect(scope.name).to.equal('city');
    expect((scope.type as GraphQLScalarType).name).to.equal('String');
  });

  it('scopes a path to a field on the root `Query` type', function () {
    const result = l.path('Query.people');
    const scope = result.scope as Field;
    expect(scope.name).to.equal('people');
    expect((scope.type as GraphQLObjectType).name).to.equal('Person');
  });
});
