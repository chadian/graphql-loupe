import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#isList', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('returns true for a non-null field', function () {
    expect(l.path('Person.friends').isList).to.be.true;
  });

  it('returns false for a nullable field', function () {
    expect(l.path('Person.name').isList).to.be.false;
  });

  it('returns false for a type', function () {
    expect(l.path('Person').isList).to.be.false;
  });

  it('returns false for the Schema', function () {
    expect(l.isList).to.be.false;
  });
});
