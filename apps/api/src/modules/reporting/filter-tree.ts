import { BadRequestException } from '@nestjs/common';
import type {
  ReportEntityKey,
  ReportFieldDefinition,
  ReportFilterCondition,
  ReportFilterGroup,
  ReportFilterNode,
  ReportFilterOperator,
  ReportFieldType,
} from '@amateur/shared-types';
import { getFieldDefinition } from './catalog';

const MAX_DEPTH = 6;
const MAX_NODES = 64;
const MAX_IN_VALUES = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCondition(node: ReportFilterNode): node is ReportFilterCondition {
  return node && typeof node === 'object' && (node as { type?: string }).type === 'condition';
}

function isGroup(node: ReportFilterNode): node is ReportFilterGroup {
  return node && typeof node === 'object' && (node as { type?: string }).type === 'group';
}

/**
 * Validates a filter tree against the catalog for a given entity. Throws
 * BadRequestException with a helpful message when malformed; otherwise returns
 * a structurally normalized tree.
 *
 * Tenant isolation is *never* part of the tree — it's enforced unconditionally
 * by the query compiler at runtime.
 */
export function validateFilterTree(
  entity: ReportEntityKey,
  node: ReportFilterNode | null | undefined,
): ReportFilterNode | null {
  if (!node) return null;

  let nodeCount = 0;
  const visit = (current: ReportFilterNode, depth: number): ReportFilterNode => {
    nodeCount += 1;
    if (nodeCount > MAX_NODES) {
      throw new BadRequestException(`Filter is too large (max ${MAX_NODES} nodes).`);
    }
    if (depth > MAX_DEPTH) {
      throw new BadRequestException(`Filter is too deeply nested (max depth ${MAX_DEPTH}).`);
    }

    if (isGroup(current)) {
      if (current.combinator !== 'and' && current.combinator !== 'or') {
        throw new BadRequestException(`Invalid filter combinator "${String(current.combinator)}".`);
      }
      if (!Array.isArray(current.children)) {
        throw new BadRequestException('Filter group must declare a children array.');
      }
      const children = current.children.map((child) => visit(child, depth + 1));
      return {
        type: 'group',
        combinator: current.combinator,
        not: Boolean(current.not),
        children,
      };
    }

    if (!isCondition(current)) {
      throw new BadRequestException('Filter node must be a group or condition.');
    }

    const field = getFieldDefinition(entity, current.field);
    if (!field) {
      throw new BadRequestException(`Unknown filter field "${String(current.field)}" for entity "${entity}".`);
    }

    if (!field.operators.includes(current.operator)) {
      throw new BadRequestException(
        `Operator "${String(current.operator)}" is not allowed on field "${field.key}".`,
      );
    }

    const normalizedValue = normalizeValue(field, current.operator, current.value);

    return {
      type: 'condition',
      field: field.key,
      operator: current.operator,
      value: normalizedValue,
    };
  };

  return visit(node, 0);
}

function normalizeValue(
  field: ReportFieldDefinition,
  operator: ReportFilterOperator,
  value: unknown,
): unknown {
  if (operator === 'isEmpty' || operator === 'isNotEmpty' || operator === 'exists' || operator === 'notExists') {
    return null;
  }

  if (operator === 'in' || operator === 'notIn') {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`Operator "${operator}" requires an array value on field "${field.key}".`);
    }
    if (value.length === 0) {
      throw new BadRequestException(`Operator "${operator}" requires at least one value on field "${field.key}".`);
    }
    if (value.length > MAX_IN_VALUES) {
      throw new BadRequestException(`Operator "${operator}" supports up to ${MAX_IN_VALUES} values.`);
    }
    return value.map((entry) => coerceScalar(field, entry));
  }

  if (operator === 'between') {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new BadRequestException(`Operator "between" requires a [min, max] tuple on field "${field.key}".`);
    }
    return [coerceScalar(field, value[0]), coerceScalar(field, value[1])];
  }

  return coerceScalar(field, value);
}

function coerceScalar(field: ReportFieldDefinition, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  return coerceByType(field.type, raw, field.key, field.options?.map((option) => option.value));
}

function coerceByType(
  type: ReportFieldType,
  raw: unknown,
  fieldKey: string,
  enumOptions?: string[],
): string | number | boolean | null {
  switch (type) {
    case 'string':
    case 'currency':
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
      throw new BadRequestException(`Field "${fieldKey}" expects text, got ${typeof raw}.`);
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(n)) {
        throw new BadRequestException(`Field "${fieldKey}" expects a number.`);
      }
      return n;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === 1 || raw === '1') return true;
      if (raw === 'false' || raw === 0 || raw === '0') return false;
      throw new BadRequestException(`Field "${fieldKey}" expects a boolean.`);
    }
    case 'enum': {
      const stringValue = String(raw);
      if (enumOptions && enumOptions.length > 0 && !enumOptions.includes(stringValue)) {
        throw new BadRequestException(
          `Field "${fieldKey}" only accepts: ${enumOptions.join(', ')}. Got "${stringValue}".`,
        );
      }
      return stringValue;
    }
    case 'uuid': {
      const stringValue = String(raw);
      if (!UUID_RE.test(stringValue)) {
        throw new BadRequestException(`Field "${fieldKey}" expects a UUID, got "${stringValue}".`);
      }
      return stringValue;
    }
    case 'date':
    case 'datetime': {
      const stringValue = typeof raw === 'string' ? raw : String(raw);
      const parsed = new Date(stringValue);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`Field "${fieldKey}" expects an ISO date, got "${stringValue}".`);
      }
      return parsed.toISOString();
    }
    default:
      return String(raw);
  }
}
