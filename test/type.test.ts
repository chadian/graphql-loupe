import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#type', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('returns the type from a schema', function () {
    expect(l.type).to.equal('#Schema');
  });

  it('returns the type name from a type', function () {
    expect(l.path('Query').type).to.equal('Query');
  });

  it('returns the return type of a field', function () {
    expect(l.path('Person.name').type).to.equal('String');
  });

  it('returns the unwrapped non-null type', function () {
    expect(l.path('Person.socialSecurityNumber').type).to.equal('String');
  });

  it('returns the unwrapped list type', function () {
    expect(l.path('Person.friends').type).to.equal('Person');
  });
});
