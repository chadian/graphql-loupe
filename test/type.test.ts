import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#unwrappedType', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('returns the type from a schema', function () {
    expect(l.unwrappedType).to.equal('#Schema');
  });

  it('returns the type name from a type', function () {
    expect(l.path('Query').unwrappedType).to.equal('Query');
  });

  it('returns the return type of a field', function () {
    expect(l.path('Person.name').unwrappedType).to.equal('String');
  });

  it('returns the unwrapped non-null type', function () {
    expect(l.path('Person.socialSecurityNumber').unwrappedType).to.equal('String');
  });

  it('returns the unwrapped list type', function () {
    expect(l.path('Person.friends').unwrappedType).to.equal('Person');
  });
});
