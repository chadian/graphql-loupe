import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#isNonNull', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('returns true for a non-null field', function () {
    expect(l.path('Person.socialSecurityNumber').isNonNull).to.be.true;
  });

  it('returns false for a nullable field', function () {
    expect(l.path('Person.name').isNonNull).to.be.false;
  });

  it('returns false for a type', function () {
    expect(l.path('Person').isNonNull).to.be.false;
  });

  it('returns false for the Schema', function () {
    expect(l.isNonNull).to.be.false;
  });
});
