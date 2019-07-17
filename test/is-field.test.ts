import { expect } from 'chai';
import { schemaString } from './fixtures/schema';
import { Loupe, loupe } from '../src';

describe('#isField', function () {
  let l: Loupe;

  beforeEach(() => {
    l = loupe(schemaString);
  });

  it('#isField', function () {
    expect(l.isField).to.be.false;
    expect(l.path('Address').isField).to.be.false;
    expect(l.path('Address.city').isField).to.be.true;
  });
});
