import * as Loupe from '../index'
import { GraphQLObjectType, GraphQLList, isNonNullType, isListType, GraphQLType } from 'graphql';

const unwrapType = (type: GraphQLType) => 'ofType' in type ? type.ofType : type;

export function followPath(fieldsPath: Loupe.Field[], pathOfFieldnames: string[]): Loupe.Pathable[] {
  if (!pathOfFieldnames.length) {
    return fieldsPath;
  }

  const lastFieldInPath = fieldsPath[fieldsPath.length - 1];
  let type = unwrapType(lastFieldInPath.type);

  if (type instanceof GraphQLObjectType) {
    const [fieldName, ...shiftedPath] = pathOfFieldnames;

    let childField;
    if ('getFields' in type) {
      const typeFields = type.getFields();
      childField = typeFields[fieldName];
    }

    if (childField) {
      return followPath([...fieldsPath, childField], shiftedPath)
    } else {
      throw `Could not find ${fieldName}`;
    }
  }

  return fieldsPath;
}
