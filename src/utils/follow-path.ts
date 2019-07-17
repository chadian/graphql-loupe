import * as Loupe from '../index'
import { GraphQLObjectType } from 'graphql';

export function followPath(fieldsPath: Loupe.Field[], pathOfFieldnames: string[]): Loupe.Pathable[] {
  if (!pathOfFieldnames.length) {
    return fieldsPath;
  }

  const lastFieldInPath = fieldsPath[fieldsPath.length - 1];

  if (lastFieldInPath.type instanceof GraphQLObjectType) {
    const [fieldName, ...shiftedPath] = pathOfFieldnames;
    const typeFields = lastFieldInPath.type.getFields();
    const childField = typeFields[fieldName];

    if (childField) {
      return followPath([...fieldsPath, childField], shiftedPath)
    } else {
      throw `Could not find ${fieldName}`;
    }
  }

  return fieldsPath;
}
