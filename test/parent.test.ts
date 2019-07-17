import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe, Field } from '../src';
import { GraphQLSchema } from 'graphql';

describe('#parent', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('when traversing past the schema it returns itself', function () {
    const result = l.parent;
    expect(result).to.equal(l);
  });

  it('can traverse up from a Type to the root schema', function () {
    const result = l.path('Person').parent;
    expect(result.isRoot).to.be.true;
    expect(result.scope instanceof GraphQLSchema).to.be.true;
  });

  it('can traverse up from a field to its type', function () {
    const result = l.path('Person.name').parent;
    const scope = result.scope as Field;
    expect(scope.name).to.equal('Person')
  });
});
