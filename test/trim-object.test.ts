import { expect } from 'chai';
import { Loupe } from '../src';

describe('#trimObject', function() {
  let l = new Loupe(`
    type Artist {
      name: String!
      album: String!
      song: String!
    }
  `);

  it('trims an object based on a simple, flat type', function() {
    const artist = {
      name: 'The Bleachers',
      album: 'Strange Desire',
      released: '2014'
    };

    const result = l.path('Artist').trimObject(artist);

    expect(result).to.deep.equal({
      artist: 'The Bleachers',
      album: 'Strange Desire'
    });
  });
});
