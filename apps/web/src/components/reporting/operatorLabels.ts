import type { TFunction } from 'i18next';
import type { ReportFilterOperator } from '../../lib/reporting-types';

const OPERATOR_LABEL_KEYS: Record<ReportFilterOperator, string> = {
  is: 'pages.reports.operators.is',
  isNot: 'pages.reports.operators.isNot',
  in: 'pages.reports.operators.in',
  notIn: 'pages.reports.operators.notIn',
  contains: 'pages.reports.operators.contains',
  notContains: 'pages.reports.operators.notContains',
  startsWith: 'pages.reports.operators.startsWith',
  endsWith: 'pages.reports.operators.endsWith',
  gt: 'pages.reports.operators.gt',
  gte: 'pages.reports.operators.gte',
  lt: 'pages.reports.operators.lt',
  lte: 'pages.reports.operators.lte',
  between: 'pages.reports.operators.between',
  isEmpty: 'pages.reports.operators.isEmpty',
  isNotEmpty: 'pages.reports.operators.isNotEmpty',
  exists: 'pages.reports.operators.exists',
  notExists: 'pages.reports.operators.notExists',
};

export function getOperatorLabel(t: TFunction, operator: ReportFilterOperator): string {
  return t(OPERATOR_LABEL_KEYS[operator]);
}

const VALUELESS = new Set<ReportFilterOperator>(['isEmpty', 'isNotEmpty', 'exists', 'notExists']);

export function operatorWantsValue(operator: ReportFilterOperator): boolean {
  return !VALUELESS.has(operator);
}

export function operatorWantsList(operator: ReportFilterOperator): boolean {
  return operator === 'in' || operator === 'notIn';
}

export function operatorWantsRange(operator: ReportFilterOperator): boolean {
  return operator === 'between';
}
