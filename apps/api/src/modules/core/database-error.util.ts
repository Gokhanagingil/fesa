import { QueryFailedError } from 'typeorm';

const RECOVERABLE_SCHEMA_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '42704', // undefined_object
]);

export function isRecoverableSchemaError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  if (code && RECOVERABLE_SCHEMA_CODES.has(code)) {
    return true;
  }

  return /does not exist|undefined table|undefined column/i.test(error.message);
}

export function isMissingTableError(error: unknown): boolean {
  return isRecoverableSchemaError(error);
}

export function isMissingRelationError(error: unknown): boolean {
  return isRecoverableSchemaError(error);
}

export function isRelationTableMissingError(error: unknown): boolean {
  return isRecoverableSchemaError(error);
}
