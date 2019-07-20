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

  it('can trim a List to its corresponding type', function() {
    let l = new Loupe(`
      type Album {
        name: String
        tracks: [Track]
      }

      type Track {
        song: String
        artists: [String]
      }
    `);

    const album = {
      name: 'Hamilton (Original Broadway Cast Recording)',
      releaseYear: '2015',
      tracks: [
        {
          song: 'I Know Him',
          artists: ['Jonathan Groff'],
          length: '1:38'
        },
        {
          song: 'Dear Theodosia',
          artists: [
            'Lin-Manuel Miranda',
            'Leslie Odom Jr.'
          ],
          length: '3:04'
        },
        {
          song: 'Helpless',
          artists: [
            'Phillipa Soo',
            'Original Broadway Cast of Hamilton'
          ],
          length: '4:10'
        }
      ]
    };

    const result = l
      .path('Album')
      .trimObject(album);

    expect(result).to.deep.equal({
      name: 'Hamilton (Original Broadway Cast Recording)',
      tracks: [
        {
          song: 'I Know Him',
          artists: ['Jonathan Groff'],
        },
        {
          song: 'Dear Theodosia',
          artists: [
            'Lin-Manuel Miranda',
            'Leslie Odom Jr.'
          ],
        },
        {
          song: 'Helpless',
          artists: [
            'Phillipa Soo',
            'Original Broadway Cast of Hamilton'
          ]
        }
      ]
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

    const track = {
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
      .trimObject(track);

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
