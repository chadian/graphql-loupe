import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe, Field } from '../src';
import { GraphQLNamedType, GraphQLScalarType, GraphQLObjectType } from 'graphql';

describe('#path', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('scopes a path to the `Query` type', function () {
    const result = l.path('Query');
    expect(result.type).to.equal('Query');
  });

  it('scopes a path to a type', function () {
    const result = l.path('Person');
    expect(result.type).to.equal('Person');
  });

  it('scopes a path to a field on a type', function () {
    const result = l.path('Person.name');
    expect((result.scope as GraphQLNamedType).name).to.equal('name')
  });

  it('scopes a path to a nested field on a type', function () {
    const result = l.path('Person.address.city');
    expect(result.name).to.equal('city');
    expect(result.type).to.equal('String');
  });

  it('scopes a path to a field on the root `Query` type', function () {
    const result = l.path('Query.person');
    expect(result.name).to.equal('person');
    expect(result.type).to.equal('Person');
  });

  it('scopes a path on the unwrapped type of a List type', function () {
    const result = l.path('Query.people');
    expect(result.name).to.equal('people');
    expect(result.type).to.equal('[Person]');
    expect(result.unwrappedType).to.equal('Person');
  });

  it('scopes a path through a List type to its unwrapped type', function () {
    // In this example people is a List of Person
    const result = l.path('Query.people.address.city');
    expect(result.name).to.equal('city');
    expect(result.type).to.equal('String');
  });
});
