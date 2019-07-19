import { expect } from 'chai';
import { Loupe } from '../src';

describe('#trimObject', function() {
  it('trims an object based on a simple, flat type', function() {
    let l = new Loupe(`
      type Track {
        artist: String
        album: String
        song: String
      }
    `);

    const track = {
      artist: 'The Bleachers',
      album: 'Strange Desire',
      released: '2014'
    };

    const result = l
      .path('Track')
      .trimObject(track);

    expect(result).to.deep.equal({
      artist: 'The Bleachers',
      album: 'Strange Desire'
    });
  });

  it('recursively trims an object based on a type with nesting', function() {
    let l = new Loupe(`
      type Track {
        artist: String
        song: String
        album: Album
      }

      type Album {
        name: String
        releaseYear: String
      }
    `);

    const artist = {
      artist: 'Arcade Fire',
      song: 'Rebellion (Lies)',
      length: '5:11',
      album: {
        name: 'Funeral',
        releaseYear: '2004',
        rating: 9.7
      }
    };

    const result = l
      .path('Track')
      .trimObject(artist);

    expect(result).to.deep.equal({
      artist: 'Arcade Fire',
      song: 'Rebellion (Lies)',
      album: {
        name: 'Funeral',
        releaseYear: '2004'
      }
    });
  });
});
