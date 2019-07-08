"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
// import t from 'graphql-ast-types';
var graphql_1 = require("graphql");
var chai_1 = require("chai");
var graphql_tools_1 = require("graphql-tools");
var schemaString = "\n  schema {\n    query: Query\n  }\n\n  type Query {\n    people: Person\n  }\n\n  type Person {\n    name: String\n    address: Address\n  }\n\n  type Address {\n    city: String\n  }\n";
function followPath(type, pathOfFieldnames, fieldPath) {
    if (!pathOfFieldnames.length) {
        return fieldPath;
    }
    var fieldName = pathOfFieldnames[0], shiftedPath = pathOfFieldnames.slice(1);
    var typeFields = type.getFields();
    var field = typeFields[fieldName];
    var fieldType = graphql_1.getNamedType(field.type);
    if (fieldType) {
        fieldPath.push(graphql_1.getNamedType(field.type));
    }
    if (fieldType instanceof graphql_1.GraphQLObjectType) {
        return followPath(fieldType, shiftedPath, fieldPath);
    }
    return fieldPath;
}
var Loupe = /** @class */ (function () {
    function Loupe(schema) {
        if (typeof schema === 'string') {
            schema = graphql_1["default"].buildSchema(schema);
        }
        this._schema = schema;
        this.pathScope = [this.schema];
    }
    Object.defineProperty(Loupe.prototype, "isRoot", {
        get: function () {
            return this.scope instanceof graphql_1.GraphQLSchema;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Loupe.prototype, "scope", {
        get: function () {
            return this.pathScope[this.pathScope.length - 1];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Loupe.prototype, "schema", {
        get: function () {
            return this._schema;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Loupe.prototype, "ast", {
        get: function () {
            return this.scope.astNode;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Loupe.prototype, "parent", {
        get: function () {
            var pathScope;
            if (this.pathScope.length > 1) {
                pathScope = this.pathScope.splice(0, this.pathScope.length - 1);
            }
            else {
                pathScope = [this.schema];
            }
            var l = new Loupe(this.schema);
            l.pathScope = pathScope;
            return l;
        },
        enumerable: true,
        configurable: true
    });
    Loupe.prototype.path = function (pathString) {
        var requestedPath = pathString.split('.');
        var pathScope = Object.assign([], this.pathScope);
        if (this.isRoot) {
            var typeString = requestedPath[0], shiftedPath = requestedPath.slice(1);
            var type = this.schema.getType(typeString);
            // push type on to path
            pathScope.push(type);
            // reset requestedPath to start with fields on type
            requestedPath = shiftedPath;
        }
        var fieldPaths = [];
        if (requestedPath.length > 0) {
            fieldPaths = followPath(pathScope[pathScope.length - 1], requestedPath);
        }
        pathScope.push.apply(pathScope, fieldPaths);
        var l = new Loupe(this.schema);
        // set new instance with updated pathScope
        l.pathScope = pathScope;
        return l;
    };
    Loupe.prototype.query = function (queryString) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, graphql_1["default"].graphql(this.schema, queryString)];
            });
        });
    };
    Loupe.prototype.mock = function (mockObject) {
        var _loop_1 = function (key, value) {
            if (typeof value === 'object') {
                mockObject[key] = function () { return value; };
            }
        };
        for (var _i = 0, _a = Object.entries(mockObject); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            _loop_1(key, value);
        }
        graphql_tools_1.addMockFunctionsToSchema({
            schema: this.schema,
            mocks: mockObject
        });
        return this;
    };
    return Loupe;
}());
function l(schema) {
    return new Loupe(schema);
}
describe('loupe', function () {
    var loupe;
    beforeEach(function () {
        loupe = l(schemaString);
    });
    it('accepts a schema string', function () {
        chai_1.expect(loupe).to.be.instanceOf(Loupe);
    });
    context('navigating', function () {
        context('traversing down a path', function () {
            it('scopes a path to a type', function () {
                var result = loupe.path('Person');
                chai_1.expect(result.scope.name).to.equal('Person');
            });
            it('scopes a path to the `Query` type', function () {
                var result = loupe.path('Query');
                chai_1.expect(result.scope.name).to.equal('Query');
            });
            it('scopes a path to a field on a type', function () {
                var result = loupe.path('Person.name');
                chai_1.expect(result.scope.name).to.equal('name');
                debugger;
                // expect(result.scope.type.name).to.equal('String')
            });
            // it('scopes a path to a nested field on a type', function() {
            //   const result = loupe.path('Person.address.city');
            //   expect(t.isFieldDefinition(result.scope.astNode)).to.be.true;
            //   expect((result.scope as GraphQLNamedType).name).to.equal('city');
            //   expect(result.scope.type.name).to.equal('String');
            // });
            // it('scopes a path to a field on the root `Query` type', function() {
            //   const result = loupe.path('Query.people');
            //   expect((result.scope as GraphQLNamedType).name).to.equal('people');
            //   expect(result.scope.type.name).to.equal('Person');
            // });
        });
        // context('traversing up', function() {
        //   it('can traverse up from a Type to the root schema', function () {
        //     const result = loupe.path('Person').parent;
        //     expect(result.isRoot).to.be.true;
        //     expect(result.scope.kind).to.equal('SchemaDefinition');
        //     expect(t.isSchemaDefinition(result.scope)).to.be.true
        //   });
        //   it('can traverse up from a field to its type', function () {
        //     const result = loupe.path('Person.name').parent;
        //     expect(result.scope.name).to.equal('Person')
        //     expect(t.isObjectTypeDefinition(result.scope.astNode)).to.be.true
        //   });
        // });
    });
    // describe('mocking types', function() {
    //   const query = `
    //     query {
    //       people {
    //         name
    //         address {
    //           city
    //         }
    //       }
    //     }
    //   `;
    //   context('with functions', function() {
    //     it('can mock at the root level', async function() {
    //       const mocks = {
    //         Person: () => ({
    //           name: 'Sam Malone'
    //         }),
    //         Address: () => ({
    //           city: 'Boston'
    //         })
    //       };
    //       let result = await loupe
    //         .mock(mocks)
    //         .query(query);
    //       expect(result.data.people.name).to.equal('Sam Malone');
    //       expect(result.data.people.address.city).to.equal('Boston');
    //     });
    //   });
    //   context('with objects', function() {
    //     it('can mock at the root level', async function() {
    //       const mocks = {
    //         Person: {
    //           name: 'Sam Malone'
    //         },
    //         Address: {
    //           city: 'Boston'
    //         }
    //       };
    //       let result = await loupe
    //         .mock(mocks)
    //         .query(query);
    //       expect(result.data.people.name).to.equal('Sam Malone');
    //       expect(result.data.people.address.city).to.equal('Boston');
    //     });
    //   });
    // });
    // describe('mocking queries', function() {
    //   const query = `
    //     query {
    //       people {
    //         name
    //         address {
    //           city
    //         }
    //       }
    //     }
    //   `;
    //   it('can mock a query on the Query type', async function() {
    //     const mocks = {
    //       Query: {
    //         people: () => ({
    //           name: 'Batman',
    //           address: {
    //             city: 'Gotham City'
    //           }
    //         })
    //       }
    //     };
    //     let result = await loupe
    //       .mock(mocks)
    //       .query(query);
    //     expect(result.data.people.name).to.equal('Batman');
    //     expect(result.data.people.address.city).to.equal('Gotham City');
    //   });
    // });
});
// it('resolves recursively', async function() {
//   const mocks = {
//     Query: resolverList({
//       people: [resolverList(
//         {
//           name: 'Jim Halpert',
//           branch: 'Scranton',
//         },
//         {
//           branch: 'Stamford',
//           likes: ['Swimming', 'Hiking']
//         },
//         {
//           branch: () => 'Scranton',
//           likes: () => ['paper']
//         },
//         {
//           likes: () => Promise.resolve(['pranking dwight'])
//         }
//       )]
//     })
//   }
//   function resolverList(...args) {
//     args.__resolverList = true;
//     return args;
//   }
//   function mergeRightAll(...objects) {
//     return objects.reduce(((merged, obj) => {
//       return R.mergeDeepWith((_a, b) => b, merged, obj);
//     }), {})
//   }
//   const reduceResolvers = async (resolvers) => {
//     const resolved = await Promise.all(resolvers.map(resolve));
//     const shouldMerge = typeof resolved[0] === 'object' && resolvers.__resolverList;
//     if (Array.isArray(resolved[0])) {
//       return resolved[resolved.length - 1];
//     }
//     if (shouldMerge) {
//       if (resolved.length > 1) {
//         return mergeRightAll(...resolved);
//       } else {
//         return resolved[0];
//       }
//     }
//     return resolved;
//   }
//   async function resolve(resolver) {
//     if (resolver.then) {
//       return await Promise.resolve(resolver);
//     }
//     if (Array.isArray(resolver)) {
//       return await reduceResolvers(resolver);
//     }
//     if (typeof resolver === 'object') {
//       return await traverseResolvers(resolver);
//     }
//     if (typeof resolver === 'function') {
//       return await resolve(resolver());
//     }
//     return resolver;
//   }
//   async function traverseResolvers(mocks) {
//     const resolved = {};
//     for (const [key, resolver] of Object.entries(mocks)) {
//       resolved[key] = await resolve(resolver);
//     }
//     return resolved;
//   }
//   expect(await traverseResolvers(mocks)).to.deep.equal({
//     Query: {
//       people: [{
//         name: 'Jim Halpert',
//         branch: 'Scranton',
//         likes: ['pranking dwight']
//       }]
//     }
//   })
// });
// test cases
// * overwrite existing mock with new one
// * handle variables and arguments
// * ast getter
// * path movement, up, down, siblings
