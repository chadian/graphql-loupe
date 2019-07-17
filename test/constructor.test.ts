import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#construction', function() {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('accepts a schema string', function () {
    expect(l).to.be.instanceOf(Loupe);
  });
});

