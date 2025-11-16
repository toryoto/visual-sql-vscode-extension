/**
 * SQL文を視認性の高い形式にフォーマットするモジュール
 */

import { ParsedStatement, ColumnType } from './sqlParser';

/**
 * SQL値を適切な形式にフォーマット
 */
function formatSQLValue(val: any, columnType: ColumnType): string {
    if (columnType === 'null') {
        return 'NULL';
    }

    if (val === null || val === undefined) {
        return 'NULL';
    }

    const strVal = String(val).trim();

    if (strVal === '') {
        if (columnType === 'string') {
            return "''";
        }
        return 'NULL';
    }

    switch (columnType) {
        case 'string':
            // 文字列型: シングルクォートで囲む
            const escapedValue = strVal.replace(/'/g, "''");
            return `'${escapedValue}'`;

        case 'number':
            // 数値型: クォートなし
            const numValue = Number(strVal);
            if (isNaN(numValue)) {
                return 'NULL';
            }
            return String(numValue);

        case 'boolean':
            // 真偽値型: TRUE/FALSE
            const boolVal = String(val).toLowerCase();
            return boolVal === 'true' || boolVal === '1' ? 'TRUE' : 'FALSE';

        default:
            // その他: 文字列として扱う
            const escapedDefault = strVal.replace(/'/g, "''");
            return `'${escapedDefault}'`;
    }
}

/**
 * INSERT文を整形
 *
 * 出力形式:
 * INSERT INTO table_name (
 *     col1,
 *     col2,
 *     col3
 * )
 * VALUES
 * (
 *     v1,
 *     v2,
 *     v3
 * ),
 * (
 *     v1,
 *     v2,
 *     v3
 * );
 */
function formatInsertStatement(statement: ParsedStatement): string {
    if (!statement.tableName || !statement.columns || !statement.values) {
        return '';
    }

    const { tableName, columns, values, columnTypes } = statement;

    // INSERT INTO とカラム一覧を縦並びで表示
    const columnsList = columns.map(col => `    ${col}`).join(',\n');
    const insertPart = `INSERT INTO ${tableName} (\n${columnsList}\n)`;

    // VALUES配下の各レコードを縦方向に展開
    const valuesPart = values.map((row, rowIndex) => {
        const formattedValues = row.map((val, colIndex) => {
            const formattedVal = formatSQLValue(val, columnTypes?.[colIndex] || 'string');
            return `    ${formattedVal}`;
        }).join(',\n');

        return `(\n${formattedValues}\n)`;
    }).join(',\n');

    return `${insertPart}\nVALUES\n${valuesPart};`;
}

/**
 * UPDATE文を整形
 *
 * 出力形式:
 * UPDATE table_name
 * SET
 *     col1 = val1,
 *     col2 = val2
 * WHERE condition;
 */
function formatUpdateStatement(statement: ParsedStatement): string {
    if (!statement.tableName || !statement.data) {
        return '';
    }

    const { tableName, data, where } = statement;

    const setPart = data.map(([col, val]) => {
        const formattedVal = formatSQLValue(val, 'string');
        return `    ${col} = ${formattedVal}`;
    }).join(',\n');

    const whereClause = where ? `\nWHERE ${where}` : '';

    return `UPDATE ${tableName}\nSET\n${setPart}${whereClause};`;
}

/**
 * DELETE文を整形
 *
 * 出力形式:
 * DELETE FROM table_name
 * WHERE condition;
 */
function formatDeleteStatement(statement: ParsedStatement): string {
    if (!statement.tableName) {
        return '';
    }

    const { tableName, where } = statement;
    const whereClause = where ? `\nWHERE ${where}` : '';

    return `DELETE FROM ${tableName}${whereClause};`;
}

/**
 * SELECT文を整形
 *
 * 出力形式:
 * SELECT
 *     col1,
 *     col2,
 *     col3
 * FROM table_name;
 */
function formatSelectStatement(statement: ParsedStatement): string {
    if (!statement.tableName || !statement.columns) {
        return '';
    }

    const { tableName, columns } = statement;

    const columnsList = columns.map(col => `    ${col}`).join(',\n');

    return `SELECT\n${columnsList}\nFROM ${tableName};`;
}

/**
 * SQL文を整形してフォーマットされた文字列を返す
 *
 * @param statement パース済みのSQL文
 * @returns フォーマットされたSQL文字列
 */
export function formatStatement(statement: ParsedStatement): string {
    switch (statement.type) {
        case 'insert':
            return formatInsertStatement(statement);
        case 'update':
            return formatUpdateStatement(statement);
        case 'delete':
            return formatDeleteStatement(statement);
        case 'select':
            return formatSelectStatement(statement);
        default:
            return '';
    }
}

/**
 * 複数のSQL文を整形して結合
 *
 * @param statements パース済みのSQL文の配列
 * @returns フォーマットされたSQL文字列（複数文は空行で区切る）
 */
export function formatStatements(statements: ParsedStatement[]): string {
    return statements
        .map(statement => formatStatement(statement))
        .filter(sql => sql)
        .join('\n\n');
}
