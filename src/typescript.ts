/**
 * Generate typescript interface from table schema
 * Created by xiamx on 2016-08-10.
 */

import * as _ from 'lodash'

import { TableDefinition } from './schemaInterfaces'
import Options from './options'

function nameIsReservedKeyword(name: string): boolean {
  const reservedKeywords = [
    'string',
    'number',
    'package',
    'public',
  ]
  return reservedKeywords.indexOf(name) !== -1
}

export function normalizeName(name: string, options: Options): string {
  if (nameIsReservedKeyword(name)) {
    return name + '_'
  } else {
    return name
  }
}

export function generateTableInterface(tableNameRaw: string, tableDefinition: TableDefinition, options: Options) {
  const tableName = options.transformTypeName(tableNameRaw);
  let
    selectableMembers = '',
    insertableMembers = '';

  Object.keys(tableDefinition).forEach(columnNameRaw => {
    const
      columnName = options.transformColumnName(columnNameRaw),
      columnDef = tableDefinition[columnNameRaw],
      possiblyOrNull = columnDef.nullable ? ' | null' : '',
      insertablyOptional = columnDef.nullable || columnDef.hasDefault ? '?' : '',
      dateAsString = columnDef.tsType === 'Date' ? ' | DateString' : '',
      possiblyOrDefault = columnDef.nullable || columnDef.hasDefault ? ' | DefaultType' : '';

    selectableMembers += `${columnName}: ${columnDef.tsType}${possiblyOrNull};\n`;
    insertableMembers += `${columnName}${insertablyOptional}: ${columnDef.tsType}${dateAsString}${possiblyOrNull}${possiblyOrDefault} | SQLFragment;\n`;
  })

  const normalizedTableName = normalizeName(tableName, options);
  return `
        export namespace ${normalizedTableName} {
          export type Table = "${tableName}";
          export interface Selectable {
            ${selectableMembers} }
          export type JSONSelectable = { [K in keyof Selectable]:
            Extract<Selectable[K], Date> extends Date ? Exclude<Selectable[K], Date> | DateString : Selectable[K] };
          export interface Insertable {
            ${insertableMembers} }
          export interface Updatable extends Partial<Insertable> { };
          export type Whereable = { [K in keyof Insertable]?: Exclude<Insertable[K] | ParentColumn, null | DefaultType> };
          export interface UpsertReturnable extends JSONSelectable, UpsertAction { };
          export type Column = keyof Selectable;
          export type OnlyCols<T extends readonly Column[]> = Pick<Selectable, T[number]>;
          export type JSONOnlyCols<T extends readonly Column[]> = Pick<JSONSelectable, T[number]>;
          export type SQLExpression = GenericSQLExpression | Table | Whereable | Column | ColumnNames<Updatable | (keyof Updatable)[]> | ColumnValues<Updatable>;
          export type SQL = SQLExpression | SQLExpression[];
          export interface OrderSpec {
            by: SQL;
            direction: 'ASC' | 'DESC';
            nulls?: 'FIRST' | 'LAST';
          }
          export interface SelectOptions<C extends Column[], L extends SQLFragmentsMap, E extends SQLFragmentsMap> {
              order?: OrderSpec[];
              limit?: number;
              offset?: number;
              columns?: C;
              extras?: E,
              lateral?: L;
              alias?: string;
          }
          type BaseSelectReturnType<C extends Column[]> = C extends undefined ? JSONSelectable : JSONOnlyCols<C>;
          type EnhancedSelectReturnType<C extends Column[], L extends SQLFragmentsMap, E extends SQLFragmentsMap> =
              L extends undefined ?
              (E extends undefined ? BaseSelectReturnType<C> : BaseSelectReturnType<C> & PromisedSQLFragmentReturnTypeMap<E>) :
              (E extends undefined ?
                  BaseSelectReturnType<C> & PromisedSQLFragmentReturnTypeMap<L> :
                  BaseSelectReturnType<C> & PromisedSQLFragmentReturnTypeMap<L> & PromisedSQLFragmentReturnTypeMap<E>);
          export type FullSelectReturnType<C extends Column[], L extends SQLFragmentsMap, E extends SQLFragmentsMap, M extends SelectResultMode> =
              M extends SelectResultMode.Many ? EnhancedSelectReturnType<C, L, E>[] :
              M extends SelectResultMode.One ? EnhancedSelectReturnType<C, L, E> | undefined : number;
        }
  `;
}

export function generateEnumType(enumObject: any, options: Options) {
  let enumString = ''
  for (let enumNameRaw in enumObject) {
    const enumName = options.transformTypeName(enumNameRaw)
    enumString += `export type ${enumName} = `
    enumString += enumObject[enumNameRaw].map((v: string) => `'${v}'`).join(' | ')
    enumString += ';\n'
    enumString += `export namespace every {\n`
    enumString += `  export type ${enumName} = [`
    enumString += enumObject[enumNameRaw].map((v: string) => `'${v}'`).join(', ') + '];\n'
    enumString += '}\n'
  }
  return enumString
}

export function generateTableTypes(tableNameRaw: string, tableDefinition: TableDefinition, options: Options) {
  const tableName = options.transformTypeName(tableNameRaw)
  let fields = ''
  Object.keys(tableDefinition).forEach((columnNameRaw) => {
    let type = tableDefinition[columnNameRaw].tsType
    let nullable = tableDefinition[columnNameRaw].nullable ? '| null' : ''
    const columnName = options.transformColumnName(columnNameRaw)
    fields += `export type ${normalizeName(columnName, options)} = ${type}${nullable};\n`
  })

  return `
        export namespace ${tableName}Fields {
        ${fields}
        }
    `
}
