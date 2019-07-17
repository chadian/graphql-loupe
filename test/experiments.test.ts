import { expect } from 'chai';
import R from 'ramda';

describe('experimental proof of concept recursive mocking, not implemented...', function () {
  // test cases
  // * handle variables and arguments
  // * need to be able to satisfy resolver args in functions,
  //   including the data resolved from the parent.
  // * add typescript typings
  // * overwrite existing mock with new one

  it('resolves recursively', async function () {
    const mocks = {
      Query: resolverList({
        people: [resolverList(
          {
            name: 'Jim Halpert',
            branch: 'Scranton',
          },
          {
            branch: 'Stamford',
            likes: ['Swimming', 'Hiking']
          },
          {
            branch: () => 'Scranton',
            likes: () => ['paper']
          },
          {
            likes: () => Promise.resolve(['pranking dwight'])
          }
        )]
      })
    }

    function resolverList(...args: any) {
      args.__resolverList = true;
      return args;
    }

    function mergeRightAll(...objects: any) {
      return objects.reduce(((merged: any, obj: any) => {
        return R.mergeDeepWith((_a, b) => b, merged, obj);
      }), {})
    }

    const reduceResolvers = async (resolvers: any) => {
      const resolved = await Promise.all(resolvers.map(resolve));
      const shouldMerge = typeof resolved[0] === 'object' && resolvers.__resolverList;

      if (Array.isArray(resolved[0])) {
        return resolved[resolved.length - 1];
      }

      if (shouldMerge) {
        if (resolved.length > 1) {
          return mergeRightAll(...resolved);
        } else {
          return resolved[0];
        }
      }

      return resolved;
    }

    async function resolve(resolver: any): Promise<any> {
      if (resolver.then) {
        return await Promise.resolve(resolver);
      }

      if (Array.isArray(resolver)) {
        return await reduceResolvers(resolver);
      }

      if (typeof resolver === 'object') {
        return await traverseResolvers(resolver);
      }

      if (typeof resolver === 'function') {
        return await resolve(resolver());
      }

      return resolver;
    }


    async function traverseResolvers(mocks: any) {
      const resolved: any = {};

      for (const [key, resolver] of Object.entries(mocks)) {
        resolved[key] = await resolve(resolver);
      }

      return resolved;
    }

    expect(await traverseResolvers(mocks)).to.deep.equal({
      Query: {
        people: [{
          name: 'Jim Halpert',
          branch: 'Scranton',
          likes: ['pranking dwight']
        }]
      }
    })
  });
});
