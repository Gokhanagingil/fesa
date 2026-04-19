import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const IMPORT_ENTITY_KEYS = [
  'athletes',
  'guardians',
  'athlete_guardians',
  'groups',
] as const;
export type ImportEntityKey = (typeof IMPORT_ENTITY_KEYS)[number];

export const MAX_IMPORT_ROWS = 500;

export class ImportRowDto {
  /** 1-indexed row identifier from the source spreadsheet (best-effort). */
  @IsOptional()
  @IsInt()
  rowNumber?: number;

  /** Raw cell values keyed by source column name. */
  @IsObject()
  cells!: Record<string, string | number | boolean | null>;
}

export class ImportPreviewDto {
  @IsString()
  @IsIn(IMPORT_ENTITY_KEYS as unknown as string[])
  entity!: ImportEntityKey;

  /**
   * Mapping from source column name → target field key. Source columns not
   * present here are ignored; unmapped target fields fall back to defaults.
   */
  @IsObject()
  columnMapping!: Record<string, string>;

  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];

  /**
   * For athlete imports: optional default sport branch id used when a row
   * leaves the sport branch column blank (clubs that only run one branch).
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  defaultSportBranchId?: string;

  /**
   * For athlete↔guardian relationship imports: when true, missing guardians
   * or athletes still produce row-level errors but do not block other rows.
   */
  @IsOptional()
  @IsBoolean()
  skipUnknownReferences?: boolean;
}

export class ImportCommitDto extends ImportPreviewDto {}
